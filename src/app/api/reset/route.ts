import { NextResponse } from "next/server";
import { ensureCrmSchema, getPool, hasDatabase } from "@/lib/postgres";

const PROTECTED_EMAIL = "juanchosierra@gmail.com";

export async function POST() {
  if (!hasDatabase()) {
    // No DB — just tell the frontend to clear localStorage
    return NextResponse.json({
      ok: true,
      persistence: "local",
      message: "No database configured — clear localStorage on the client.",
    });
  }

  await ensureCrmSchema();
  const pool = getPool();

  // 1. Delete all users EXCEPT the superadmin
  await pool.query(
    `DELETE FROM crm_users WHERE LOWER(email) != LOWER($1)`,
    [PROTECTED_EMAIL]
  );

  // 2. Clear all clients
  await pool.query(`DELETE FROM crm_clients`);

  // 3. Reset all crm_state keys to empty arrays
  const stateKeys = [
    "tasks",
    "quotes",
    "notifications",
    "auditLogs",
    "anomalies",
    "events",
    "forms",
    "clients",
  ];

  for (const key of stateKeys) {
    await pool.query(
      `UPDATE crm_state SET value = '[]'::jsonb, updated_at = NOW() WHERE key = $1`,
      [key]
    );
  }

  // 4. Reset productSyncStatus
  await pool.query(
    `UPDATE crm_state SET value = $1::jsonb, updated_at = NOW() WHERE key = 'productSyncStatus'`,
    [JSON.stringify({ lastResult: "idle", syncedCount: 0 })]
  );

  // 5. Get the preserved superadmin to return
  const { rows } = await pool.query(
    `SELECT id, name, role, email, username, status FROM crm_users WHERE LOWER(email) = LOWER($1)`,
    [PROTECTED_EMAIL]
  );

  return NextResponse.json({
    ok: true,
    persistence: "postgres",
    preservedUser: rows[0] || null,
    deleted: {
      users: "all except superadmin",
      clients: "all",
      state: stateKeys,
    },
  });
}
