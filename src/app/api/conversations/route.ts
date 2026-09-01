import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { mergeStateRecords } from '@/lib/state-merge';
import { pickNextSeller } from '@/lib/round-robin';
import { appendNotification } from '@/lib/server-notifications';
import { sendAdvisorNeededEmail } from '@/lib/advisor-alert-email';
import { ExtraContact, contactIsNovel, extractEmailsFromText, mergeExtraContacts } from '@/lib/extra-contacts';
import { applyExtraContactsToClient } from '@/lib/extra-contacts-apply';

export interface WidgetConversation {
  id: string;
  lead: {
    name: string;
    email: string;
    phone: string;
    city: string;
    company: string;
  };
  messages: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    /** 'advisor' = lo escribió una persona desde el CRM (no el bot). */
    via?: 'advisor';
  }[];
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'closed';
  clientId?: string;
  source: 'widget' | 'whatsapp';
  /**
   * Contactos ADICIONALES capturados en pleno chat — nombre/correo/teléfono
   * de otra persona, dictados p. ej. cuando el bot pide datos para escalar a
   * un asesor (caso PRANA, 12-ago-2026). Los llena de forma estructurada
   * /api/assistant → widget, y el POST los complementa con un barrido de
   * correos sobre los mensajes nuevos. Se aplican a la ficha del cliente
   * vinculado (emails_extra + nota); JAMÁS tocan su identidad principal.
   */
  extraContacts?: ExtraContact[];
}

/** Llave de identidad de un mensaje — la misma del merge append-only y la del widget. */
const msgKey = (m: WidgetConversation['messages'][number]) => `${m.role}|${m.timestamp}|${m.content}`;

async function readConversations(): Promise<WidgetConversation[]> {
  if (!hasDatabase()) return [];
  await ensureCrmSchema();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT value FROM crm_state WHERE key = 'widget_conversations'`
  );
  return (rows[0]?.value as WidgetConversation[]) || [];
}

async function writeConversations(convs: WidgetConversation[]): Promise<void> {
  if (!hasDatabase()) return;
  const pool = getPool();
  await pool.query(
    `INSERT INTO crm_state (key, value, updated_at)
     VALUES ('widget_conversations', $1::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value, updated_at = NOW()`,
    [JSON.stringify(convs)]
  );
}

// GET /api/conversations — list all widget conversations
export async function GET() {
  try {
    const conversations = await readConversations();
    // Return most-recent first, limit 100
    return NextResponse.json({
      conversations: conversations.slice(0, 100),
      ok: true,
    });
  } catch (err: any) {
    return NextResponse.json({ conversations: [], error: err.message }, { status: 500 });
  }
}

// POST /api/conversations — upsert a conversation
// When a widget session first submits a lead with email/phone, we:
//   1. Upsert a crm_clients row with round-robin seller assignment
//   2. Stamp the conversation.clientId so the seller's file shows the full chat
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const conversation: WidgetConversation = body.conversation;
    if (!conversation?.id) {
      return NextResponse.json({ error: 'Missing conversation.id' }, { status: 400 });
    }

    if (!hasDatabase()) {
      return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
    }

    await ensureCrmSchema();
    const pool = getPool();

    const existing = await readConversations();
    const previous = existing.find(c => c.id === conversation.id);
    const previousMsgKeys = new Set((previous?.messages || []).map(msgKey));
    const previousUserMessages = (previous?.messages || []).filter(m => m.role === 'user').length;
    const incomingUserMessages = (conversation.messages || []).filter(m => m.role === 'user').length;
    const shouldNotifyInbound = incomingUserMessages > previousUserMessages;

    // Lead capture + seller assignment — only when we have enough info and no client yet
    let clientId = conversation.clientId || previous?.clientId || '';
    let ownerId: string | null = null;
    const lead = conversation.lead || {};
    const hasLeadInfo = Boolean((lead.email || '').trim() || (lead.phone || '').replace(/\D/g, '').length >= 7);
    if (!clientId && hasLeadInfo) {
      const rr = await pickNextSeller();
      ownerId = rr?.id || null;
      const ownerName = rr?.name || null;

      // Check-then-upsert by email (fallback to phone if no email)
      const { rows: existingClient } = lead.email
        ? await pool.query(`SELECT id, assigned_to, assigned_to_name FROM crm_clients WHERE email = $1 LIMIT 1`, [lead.email])
        : await pool.query(`SELECT id, assigned_to, assigned_to_name FROM crm_clients WHERE phone = $1 LIMIT 1`, [lead.phone]);

      const today = new Date().toISOString().split('T')[0];
      if (existingClient.length > 0) {
        clientId = existingClient[0].id;
        ownerId = existingClient[0].assigned_to || null;
        // Don't steal ownership from an existing owner
        await pool.query(
          `UPDATE crm_clients SET
             name = COALESCE(NULLIF($1, ''), name),
             phone = COALESCE(NULLIF($2, ''), phone),
             city = COALESCE(NULLIF($3, ''), city),
             company = COALESCE(NULLIF($4, ''), company),
             last_contact = $5,
             assigned_to = COALESCE(assigned_to, $6),
             assigned_to_name = COALESCE(assigned_to_name, $7),
             source = COALESCE(source, 'ConcreBOT Widget'),
             updated_at = NOW()
           WHERE id = $8`,
          [lead.name || '', lead.phone || '', lead.city || '', lead.company || '', today, ownerId, ownerName, clientId]
        );
      } else {
        clientId = `c-bot-${Date.now()}`;
        ownerId = rr?.id || null;
        await pool.query(
          `INSERT INTO crm_clients (
             id, name, company, email, phone, status, value_text, ltv, last_contact, city, score, category, registration_date,
             assigned_to, assigned_to_name, source, updated_at
           ) VALUES ($1,$2,$3,$4,$5,'Lead','Por cotizar',0,$6,$7,55,'ConcreBOT Widget',$8,$9,$10,'ConcreBOT Widget',NOW())`,
          [
            clientId,
            lead.name || 'Lead Bot',
            // Empresa vacía si el bot no la capturó — el `|| lead.name` creaba
            // una empresa fantasma con el nombre de la persona, y 'Sin empresa'
            // dejaba una empresa literal llamada así en crm_companies.
            lead.company || '',
            lead.email || '',
            lead.phone || '',
            today,
            lead.city || 'No especificada',
            today,
            ownerId,
            ownerName,
          ]
        );

        // Also drop a pipeline task so the seller sees it in their board.
        //
        // La etapa se lee de la configuración vigente en vez de hardcodearse.
        // Antes nacía en 'stage-1', un id que no existe en ninguna columna:
        // el negocio se creaba, se asignaba por round-robin y el asesor jamás
        // lo veía. Si el equipo renombra o reordena sus etapas desde /settings,
        // esto sigue funcionando; el fallback sólo aplica si nunca se guardaron.
        const { rows: stageRows } = await pool.query(
          `SELECT value->'pipelineStages'->0->>'id' AS first_stage FROM crm_state WHERE key = 'settings'`
        );
        const firstStageId = stageRows[0]?.first_stage || 'cotizado';

        const newTask = {
          id: `t-bot-${Date.now()}`,
          title: `ConcreBOT: ${lead.name || 'Lead'}`,
          // Rótulo del tablero: empresa si hay, si no el nombre de la persona.
          // Nunca la cadena 'Sin empresa', que se veía como cliente literal.
          client: lead.company || lead.name || 'Lead Bot',
          clientId,
          contactName: lead.name || '',
          value: 'Por definir', numericValue: 0,
          priority: 'Medium', tags: ['ConcreBOT', 'Widget'],
          aiScore: 60, source: 'ConcreBOT Widget',
          assignedTo: ownerId || '',
          assignedToName: ownerName || '',
          email: lead.email || '',
          phone: lead.phone || '',
          city: lead.city || '',
          activities: [{
            id: `act-${Date.now()}`,
            type: 'system',
            content: `Lead capturado por ConcreBOT. Revisa el chat completo en la ficha del cliente → pestaña ConcreBOT.`,
            timestamp: new Date().toISOString(),
          }],
          stageId: firstStageId,
        };
        // Merge-por-id: agrega SOLO esta task sin reescribir el arreglo entero.
        await mergeStateRecords(pool, { tasks: [newTask] });
      }
    } else if (clientId) {
      const { rows } = await pool.query(`SELECT assigned_to FROM crm_clients WHERE id = $1 LIMIT 1`, [clientId]);
      ownerId = rows[0]?.assigned_to || null;
    }

    // ── Contactos adicionales dictados en pleno chat ──────────────────────
    // Une (a) los estructurados que trae el widget (extractor de
    // /api/assistant), (b) los que la conversación guardada ya tenía y (c) un
    // barrido determinístico de CORREOS sobre los mensajes nuevos del
    // cliente. El barrido es la red de seguridad para cuando el bot está
    // callado (asesor activo) o el extractor falló: un correo en texto libre
    // es inconfundible. Los teléfonos NO se barren por regex — cantidades y
    // medidas parecen teléfonos — así que solo llegan por la vía
    // estructurada. Lo que repita el correo/teléfono del propio lead se
    // descarta: no es un contacto nuevo.
    const newUserMessages = (conversation.messages || []).filter(
      m => m?.role === 'user' && m.content && !previousMsgKeys.has(msgKey(m))
    );
    const sweptEmails: ExtraContact[] = [];
    for (const m of newUserMessages) {
      for (const email of extractEmailsFromText(m.content)) {
        sweptEmails.push({ email, capturedAt: m.timestamp });
      }
    }
    const extraContacts = mergeExtraContacts(
      previous?.extraContacts,
      conversation.extraContacts,
      sweptEmails
    ).filter(c => contactIsNovel(c, lead));

    // Now upsert the conversation with the resolved clientId
    const conversationToSave = { ...conversation, clientId: clientId || conversation.clientId, extraContacts };
    const idx = existing.findIndex(c => c.id === conversation.id);
    if (idx >= 0) {
      // MERGE append-only de mensajes. Antes el arreglo del caller REEMPLAZABA
      // al guardado: el widget mandaba su copia local y borraba de un plumazo
      // la respuesta que el asesor acababa de escribir en el CRM. Ahora se unen
      // por (rol|timestamp|contenido) y se ordenan por fecha, así ningún lado
      // pisa al otro (incidente 6-ago-2026).
      const merged = [...(existing[idx].messages || [])];
      const seen = new Set(merged.map(msgKey));
      for (const m of conversationToSave.messages || []) {
        if (!seen.has(msgKey(m))) { seen.add(msgKey(m)); merged.push(m); }
      }
      merged.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
      existing[idx] = { ...existing[idx], ...conversationToSave, messages: merged, updatedAt: new Date().toISOString() };
    } else {
      existing.unshift({ ...conversationToSave, updatedAt: new Date().toISOString() });
    }

    await writeConversations(existing);

    // Lleva los contactos adicionales a la ficha vinculada (emails_extra +
    // nota). Después de guardar la conversación a propósito: si esto falla,
    // el chat ya quedó persistido y los contactos siguen en la conversación
    // para reintentarse en el próximo guardado. Es idempotente: lo ya
    // aplicado se salta.
    if (clientId && extraContacts.length) {
      try {
        await applyExtraContactsToClient(pool, clientId, extraContacts);
      } catch (error) {
        console.error('[conversations] no se pudieron aplicar los contactos adicionales:', error);
      }
    }

    if (shouldNotifyInbound) {
      const lastUserMessage = [...(conversation.messages || [])].reverse().find(m => m.role === 'user');
      await appendNotification(pool, {
        title: conversation.source === 'whatsapp' ? 'WhatsApp entrante' : 'ConcreBOT activo',
        description: `${lead.name || lead.phone || lead.email || 'Nuevo visitante'}: ${(lastUserMessage?.content || '').slice(0, 120) || 'Escribió al CRM'}`,
        type: 'lead',
        targetUserId: ownerId,
        clientId: clientId || undefined,
      });
      sendAdvisorNeededEmail({
        leadName: lead.name,
        phone: lead.phone,
        email: lead.email,
        company: lead.company,
        city: lead.city,
        message: lastUserMessage?.content,
        source: conversation.source === 'whatsapp' ? 'WhatsApp' : 'ConcreBOT',
        conversationId: conversation.id,
        clientId,
        appUrl: process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin,
      }).catch(error => console.error('[advisor-alert] conversation email failed:', error));
    }

    return NextResponse.json({ ok: true, id: conversation.id, clientId });
  } catch (err: any) {
    console.error('POST /api/conversations error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
