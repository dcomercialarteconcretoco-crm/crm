import { NextRequest, NextResponse } from "next/server";
import { ensureCrmSchema, getPool, hasDatabase } from "@/lib/postgres";

/**
 * /api/companies — Empresas (cliente corporativo)
 *
 * Una empresa agrupa varios contactos (rows en crm_clients). El listado se usa
 * para alimentar el combobox del formulario de lead/cliente: el vendedor ve las
 * empresas que ya existen y puede crear una nueva sin salir del form.
 *
 * - GET: lista todas las empresas con conteos de contactos y de cotizaciones
 *   (para que el listado pueda mostrar "Constructora X · 3 contactos · 5 cot.").
 * - POST: crea una empresa nueva o devuelve la existente si el nombre ya está
 *   tomado (case-insensitive). Idempotente para que el combobox pueda hacer
 *   "create-on-the-fly" sin temer duplicados.
 */

export async function GET() {
  if (!hasDatabase()) {
    return NextResponse.json({ companies: [], persistence: "local" });
  }

  await ensureCrmSchema();
  const pool = getPool();

  const { rows } = await pool.query(`
    SELECT
      co.id,
      co.name,
      co.nit,
      co.created_at AS "createdAt",
      COUNT(c.id)::int AS "clientCount"
    FROM crm_companies co
    LEFT JOIN crm_clients c ON c.company_id = co.id
    GROUP BY co.id, co.name, co.nit, co.created_at
    ORDER BY LOWER(co.name) ASC
  `);

  return NextResponse.json({ companies: rows, persistence: "postgres" });
}

export async function POST(request: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  const payload = await request.json().catch(() => ({}));
  const name = String(payload?.name || "").trim();
  const nit = String(payload?.nit || "").trim() || null;

  if (!name) {
    return NextResponse.json({ error: "El nombre de la empresa es obligatorio" }, { status: 400 });
  }

  await ensureCrmSchema();
  const pool = getPool();

  // Si ya existe una empresa con el mismo nombre (case-insensitive) la
  // devolvemos en vez de crear duplicado. Permite que el combobox haga
  // "create or get" sin tener que chequear primero. Si el caller trajo NIT y
  // la existente no lo tiene, lo completamos (COALESCE conserva el que ya
  // esté — un get-or-create nunca pisa un NIT digitado antes).
  const existing = await pool.query(
    `SELECT id, name, nit, created_at AS "createdAt" FROM crm_companies WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [name]
  );
  if (existing.rows[0]) {
    if (nit && !existing.rows[0].nit) {
      const { rows: filled } = await pool.query(
        `UPDATE crm_companies SET nit = COALESCE(nit, $2), updated_at = NOW() WHERE id = $1
         RETURNING id, name, nit, created_at AS "createdAt"`,
        [existing.rows[0].id, nit]
      );
      return NextResponse.json({ company: filled[0], created: false });
    }
    return NextResponse.json({ company: existing.rows[0], created: false });
  }

  const id = `cmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const inserted = await pool.query(
    `
      INSERT INTO crm_companies (id, name, nit)
      VALUES ($1, $2, $3)
      RETURNING id, name, nit, created_at AS "createdAt"
    `,
    [id, name, nit]
  );

  return NextResponse.json({ company: inserted.rows[0], created: true });
}
