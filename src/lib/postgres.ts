import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  "";

declare global {
  // eslint-disable-next-line no-var
  var __crmPool: Pool | undefined;
}

export function hasDatabase() {
  return Boolean(connectionString);
}

export function getPool() {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!global.__crmPool) {
    global.__crmPool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost")
        ? undefined
        : { rejectUnauthorized: false },
    });
  }

  return global.__crmPool;
}

export async function ensureCrmSchema() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT,
      role TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      username TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'Activo',
      sales TEXT,
      commission TEXT,
      password TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      status TEXT NOT NULL,
      value_text TEXT NOT NULL,
      ltv INTEGER NOT NULL DEFAULT 0,
      last_contact TEXT NOT NULL,
      city TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      category TEXT NOT NULL,
      registration_date TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_state (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}
