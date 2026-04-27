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
      co.created_at AS "createdAt",
      COUNT(c.id)::int AS "clientCount"
    FROM crm_companies co
    LEFT JOIN crm_clients c ON c.company_id = co.id
    GROUP BY co.id, co.name, co.created_at
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

  if (!name) {
    return NextResponse.json({ error: "El nombre de la empresa es obligatorio" }, { status: 400 });
  }

  await ensureCrmSchema();
  const pool = getPool();

  // Si ya existe una empresa con el mismo nombre (case-insensitive) la
  // devolvemos en vez de crear duplicado. Permite que el combobox haga
  // "create or get" sin tener que chequear primero.
  const existing = await pool.query(
    `SELECT id, name, created_at AS "createdAt" FROM crm_companies WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [name]
  );
  if (existing.rows[0]) {
    return NextResponse.json({ company: existing.rows[0], created: false });
  }

  const id = `cmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const inserted = await pool.query(
    `
      INSERT INTO crm_companies (id, name)
      VALUES ($1, $2)
      RETURNING id, name, created_at AS "createdAt"
    `,
    [id, name]
  );

  return NextResponse.json({ company: inserted.rows[0], created: true });
}
