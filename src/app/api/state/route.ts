import { NextRequest, NextResponse } from "next/server";
import { ensureCrmSchema, getPool, hasDatabase } from "@/lib/postgres";

type StateMap = Record<string, unknown>;

const DEFAULT_STATE: StateMap = {
  tasks: [],
  quotes: [],
  notifications: [],
  auditLogs: [],
  anomalies: [],
  events: [],
  forms: [],
  products: [],
  productSyncStatus: {
    lastResult: "idle",
    syncedCount: 0,
  },
};

export async function GET(req: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json({ ...DEFAULT_STATE, persistence: "local" });
  }

  await ensureCrmSchema();
  const pool = getPool();
  const keys = (req.nextUrl.searchParams.get("keys") || "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
  const requestedKeys = keys.length > 0 ? keys : Object.keys(DEFAULT_STATE);

  const { rows } = await pool.query(
    `SELECT key, value FROM crm_state WHERE key = ANY($1::text[])`,
    [requestedKeys]
  );

  const rowMap = new Map(rows.map((row) => [row.key, row.value]));
  const payload = requestedKeys.reduce<StateMap>((acc, key) => {
    acc[key] = rowMap.has(key) ? rowMap.get(key) : DEFAULT_STATE[key] ?? null;
    return acc;
  }, {});

  return NextResponse.json({ ...payload, persistence: "postgres" });
}

export async function PUT(req: NextRequest) {
  if (!hasDatabase()) {
    return NextResponse.json(
      { error: "Base de datos no configurada." },
      { status: 503 }
    );
  }

  const body = (await req.json()) as StateMap;
  const entries = Object.entries(body).filter(([, value]) => value !== undefined);

  if (entries.length === 0) {
    return NextResponse.json({ ok: true });
  }

  await ensureCrmSchema();
  const pool = getPool();

  for (const [key, value] of entries) {
    await pool.query(
      `
        INSERT INTO crm_state (key, value, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            updated_at = NOW()
      `,
      [key, JSON.stringify(value)]
    );
  }

  return NextResponse.json({ ok: true });
}
