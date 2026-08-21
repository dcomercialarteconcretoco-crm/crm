import { NextRequest, NextResponse } from "next/server";
import { ensureCrmSchema, getPool, hasDatabase } from "@/lib/postgres";
import { normalizeWhatsAppUser, isValidWhatsAppUser } from "@/lib/contact-links";
import { sanitizeExtraEmails } from "@/lib/client-emails";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const { id } = await params;
  const payload = await request.json();
  await ensureCrmSchema();
  const pool = getPool();

  // ── Agregar UNA nota: append atómico en el server ────────────────────────
  //
  // Incidente 20-ago-2026: las notas se "guardaban" y luego desaparecían.
  // Causa: el front mandaba el ARREGLO COMPLETO de notas dentro del PUT
  // general, y cualquier otra pestaña con estado viejo (un clic de WhatsApp
  // que actualiza last_contact, una reasignación) re-enviaba su copia vieja
  // del arreglo y pisaba la nota recién escrita. La bitácora inmutable
  // (crm_contact_events) sí conservó los textos — de ahí se recuperaron.
  //
  // Contrato nuevo: agregar nota = { addNote: { text, date, author } }.
  // El server la PREPENDE con `||` de jsonb en una sola sentencia — dos
  // asesores anotando al tiempo no se pisan jamás. Este branch NO toca
  // ningún otro campo del cliente.
  if (payload.addNote) {
    const n = payload.addNote;
    if (!n.text || typeof n.text !== 'string') {
      return NextResponse.json({ error: 'addNote.text requerido' }, { status: 400 });
    }
    const note = {
      text: String(n.text).slice(0, 4000),
      date: typeof n.date === 'string' ? n.date : new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }),
      author: typeof n.author === 'string' ? n.author : '',
    };
    const { rows } = await pool.query(
      `UPDATE crm_clients
       SET notes = $2::jsonb || COALESCE(notes, '[]'::jsonb), updated_at = NOW()
       WHERE id = $1
       RETURNING notes`,
      [id, JSON.stringify([note])]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Cliente no existe' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, notes: rows[0].notes });
  }

  // Misma lógica que /api/clients POST: si vino companyId valida; si vino un
  // nombre libre busca/crea. Permite que la pantalla de detalle del lead
  // asigne empresa a un cliente que no la tenía sin endpoint extra.
  let companyId: string | null = payload.companyId ?? null;
  let companyName: string = (payload.company || '').trim();

  if (companyId) {
    const { rows: cr } = await pool.query(
      `SELECT name FROM crm_companies WHERE id = $1 LIMIT 1`,
      [companyId]
    );
    if (cr[0]) companyName = cr[0].name;
    else companyId = null;
  } else if (companyName) {
    const { rows: existing } = await pool.query(
      `SELECT id, name FROM crm_companies WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      [companyName]
    );
    if (existing[0]) {
      companyId = existing[0].id;
      companyName = existing[0].name;
    } else {
      const newId = `cmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      await pool.query(
        `INSERT INTO crm_companies (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [newId, companyName]
      );
      companyId = newId;
    }
  }

  // Email vacío → NULL: ver comentario en /api/clients POST.
  const emailValue = (payload.email || '').trim() || null;
  const positionValue = (payload.position || '').trim() || null;

  // Usuario de WhatsApp. A diferencia del POST, acá sí se puede vaciar: este
  // es el endpoint del formulario de edición, y si el asesor borra el handle
  // (el cliente lo cambió, o lo había digitado mal) tiene que desaparecer.
  // Por eso distinguimos "no vino la llave" (undefined → conservar lo que hay)
  // de "vino vacía o inválida" (→ NULL), igual que se hace con `notes`.
  const waUserProvided = payload.whatsappUser !== undefined;
  const rawWaUser = normalizeWhatsAppUser(payload.whatsappUser || '');
  const whatsappUserValue = isValidWhatsAppUser(rawWaUser) ? rawWaUser : null;

  // Correos adicionales: mismo contrato que whatsapp_user — la llave ausente
  // conserva lo que hay; presente (aunque venga vacía) reemplaza, para que el
  // formulario pueda quitar correos.
  const extraProvided = payload.extraEmails !== undefined;
  const extraEmailsValue = JSON.stringify(sanitizeExtraEmails(payload.extraEmails, payload.email));

  try {
    await pool.query(
      `
        UPDATE crm_clients
        SET
          name = $2,
          company = $3,
          company_id = $4,
          "position" = $5,
          email = $6,
          phone = $7,
          status = $8,
          value_text = $9,
          ltv = $10,
          last_contact = $11,
          city = $12,
          score = $13,
          category = $14,
          registration_date = $15,
          assigned_to = COALESCE($16, assigned_to),
          assigned_to_name = COALESCE($17, assigned_to_name),
          source = COALESCE($18, source),
          notes = COALESCE($19::jsonb, notes),
          whatsapp_user = CASE WHEN $20::boolean THEN $21 ELSE whatsapp_user END,
          emails_extra = CASE WHEN $22::boolean THEN $23::jsonb ELSE emails_extra END,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        id,
        payload.name,
        companyName,
        companyId,
        positionValue,
        emailValue,
        payload.phone || '',
        payload.status || 'Activo',
        payload.value || '$0',
        payload.ltv || 0,
        payload.lastContact || new Date().toISOString().split('T')[0],
        payload.city || '',
        payload.score || 0,
        payload.category || 'General',
        payload.registrationDate || new Date().toISOString().split('T')[0],
        payload.assignedTo || null,
        payload.assignedToName || null,
        payload.source || null,
        // Notas: el PUT general IGNORA `payload.notes` a propósito (incidente
        // 20-ago-2026: updateClient siempre mandaba el cliente completo, con
        // el arreglo de notas VIEJO de esa pestaña, y pisaba las notas nuevas
        // de otros — el COALESCE de acá abajo las conserva al recibir null).
        // Agregar nota = { addNote } (branch atómico de arriba). Reemplazo
        // completo deliberado (editar/borrar) = { replaceNotes: [...] }.
        Array.isArray(payload.replaceNotes) ? JSON.stringify(payload.replaceNotes) : null,
        waUserProvided,
        whatsappUserValue,
        extraProvided,
        extraEmailsValue,
      ]
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '';
    console.error('Failed to update client', error);
    return NextResponse.json(
      { error: msg || 'No se pudo guardar el contacto.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, companyId });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const { id } = await params;
  await ensureCrmSchema();
  const pool = getPool();
  await pool.query(`DELETE FROM crm_clients WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
