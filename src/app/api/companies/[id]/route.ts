import { NextRequest, NextResponse } from "next/server";
import { ensureCrmSchema, getPool, hasDatabase } from "@/lib/postgres";

/**
 * /api/companies/[id] — operaciones individuales sobre una empresa.
 *
 * - PUT: renombrar la empresa. El nombre se chequea contra el índice único
 *   case-insensitive — si otra empresa ya lo tiene, devolvemos 409 para que
 *   el front muestre un error legible y no rompa la unique constraint.
 *   Cuando el rename funciona, propagamos el nuevo nombre al campo
 *   denormalizado `crm_clients.company` para que listados/PDFs queden
 *   consistentes inmediatamente sin esperar a otro flujo.
 *
 * - DELETE: borrar la empresa. Los contactos enlazados quedan SIN empresa
 *   (company_id = NULL) pero conservan el string `company` como snapshot
 *   histórico — si la empresa se borra por error, no perdemos el contexto
 *   del lead. La cotización tampoco se borra; mantiene el companyId apuntando
 *   a un id que ya no existe (lo cual es OK porque el detalle de empresa lo
 *   ignora si no encuentra la fila).
 */

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const { id } = await params;
  const payload = await request.json().catch(() => ({}));
  const newName = String(payload?.name || "").trim();

  if (!newName) {
    return NextResponse.json({ error: "El nombre de la empresa es obligatorio" }, { status: 400 });
  }

  await ensureCrmSchema();
  const pool = getPool();

  // Conflicto: ya existe OTRA empresa con ese nombre (case-insensitive). El
  // user puede o renombrar a algo distinto, o borrar esta y mover los
  // contactos manualmente — no hacemos merge automático para no arrastrar
  // sorpresas con cotizaciones históricas.
  const conflict = await pool.query(
    `SELECT id FROM crm_companies WHERE LOWER(name) = LOWER($1) AND id <> $2 LIMIT 1`,
    [newName, id]
  );
  if (conflict.rows[0]) {
    return NextResponse.json(
      { error: "Ya existe otra empresa con ese nombre. Probá con uno distinto." },
      { status: 409 }
    );
  }

  const updated = await pool.query(
    `UPDATE crm_companies SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name`,
    [newName, id]
  );
  if (!updated.rows[0]) {
    return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
  }

  // Propagar el rename al snapshot denormalizado de cada contacto.
  await pool.query(
    `UPDATE crm_clients SET company = $1, updated_at = NOW() WHERE company_id = $2 AND company <> $1`,
    [newName, id]
  );

  return NextResponse.json({ company: updated.rows[0] });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const { id } = await params;
  await ensureCrmSchema();
  const pool = getPool();

  // Desvincular: los contactos se quedan en el sistema, pierden el FK pero
  // conservan el nombre de empresa como string histórico. Mucho menos
  // destructivo que borrar también los leads.
  await pool.query(
    `UPDATE crm_clients SET company_id = NULL, updated_at = NOW() WHERE company_id = $1`,
    [id]
  );

  const result = await pool.query(`DELETE FROM crm_companies WHERE id = $1`, [id]);
  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
