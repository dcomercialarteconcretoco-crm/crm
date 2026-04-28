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
      permissions JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Migrate: add permissions column to existing tables that predate it
  await pool.query(`
    ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS permissions JSONB;
  `);

  // Onboarding wizard — increments on each completion (0 never ran, 1 ran once = mandatory done,
  // 2 ran twice = skippable done, >=2 never shown again).
  await pool.query(`
    ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS onboarding_count INTEGER NOT NULL DEFAULT 0;
  `);

  // Round-robin participation flag — when false the seller is skipped by the rotation
  // for public leads (web form, biolink, WhatsApp, WooCommerce, bot). Default true
  // so existing members keep receiving leads without extra configuration.
  await pool.query(`
    ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS receives_leads BOOLEAN NOT NULL DEFAULT TRUE;
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
      assigned_to TEXT,
      assigned_to_name TEXT,
      source TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Migrate: add ownership columns to tables that predate them
  await pool.query(`ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS assigned_to TEXT;`);
  await pool.query(`ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS assigned_to_name TEXT;`);
  await pool.query(`ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS source TEXT;`);

  // ── Empresas (cliente corporativo) ────────────────────────────────────────
  // Una empresa agrupa varios contactos (Client). El nombre se mantiene en la
  // columna `company` de crm_clients como denormalización para no romper
  // consumidores existentes (PDFs, listados, dashboards), pero la fuente de
  // verdad pasa a ser company_id cuando existe. Leads sin empresa asignada
  // mantienen company_id = NULL.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  // Índice único case-insensitive para evitar "Constructora X" vs "constructora x"
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_companies_name_lower
    ON crm_companies (LOWER(name));
  `);
  await pool.query(`ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS company_id TEXT;`);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_clients_company_id
    ON crm_clients (company_id);
  `);

  // Backfill idempotente: por cada nombre de empresa distinto que aparezca en
  // crm_clients, crear la company (o usar la existente) y enlazar. Solo corre
  // sobre filas que aún no tienen company_id, así re-ejecutar es seguro.
  await pool.query(`
    INSERT INTO crm_companies (id, name)
    SELECT
      'cmp-' || md5(LOWER(TRIM(company))),
      TRIM(company)
    FROM crm_clients
    WHERE company IS NOT NULL
      AND TRIM(company) <> ''
      AND company_id IS NULL
    GROUP BY TRIM(company), LOWER(TRIM(company))
    ON CONFLICT DO NOTHING;
  `);
  await pool.query(`
    UPDATE crm_clients c
    SET company_id = co.id
    FROM crm_companies co
    WHERE c.company_id IS NULL
      AND c.company IS NOT NULL
      AND TRIM(c.company) <> ''
      AND LOWER(co.name) = LOWER(TRIM(c.company));
  `);

  // Normalización cosmética: pasamos los nombres a Title Case (Primera Letra
  // Mayúscula Por Palabra) usando INITCAP de Postgres. Es idempotente: si ya
  // está bien casado el WHERE no lo toca, así re-correr en cada boot no genera
  // churn ni updates innecesarios. Sirve para limpiar los nombres legados que
  // venían en MAYÚSCULAS desde imports CSV o desde WooCommerce.
  await pool.query(`
    UPDATE crm_companies
    SET name = INITCAP(name), updated_at = NOW()
    WHERE name <> INITCAP(name);
  `);
  // Propagamos a la denormalización en crm_clients para que listados/PDF que
  // leen client.company string también se vean limpios.
  await pool.query(`
    UPDATE crm_clients c
    SET company = co.name, updated_at = NOW()
    FROM crm_companies co
    WHERE c.company_id = co.id
      AND c.company <> co.name;
  `);

  // ── Email: dato, no clave ───────────────────────────────────────────────
  //
  // En B2B (constructoras, alcaldías, asociaciones — el universo del cliente)
  // los correos corporativos los comparten varias personas: `compras@x.co`
  // tiene a Juan, Marta y Andrés. Tratar el email como UNIQUE rompe ese
  // workflow: el segundo INSERT con el mismo correo rebota con violación de
  // constraint y el contacto se pierde silenciosamente. Eso fue lo que el
  // cliente encontró cuando dijo "no me deja cargar más de 2 contactos".
  //
  // La política ahora: el email es un dato más, igual que phone o city. El
  // identificador es `id`. Si dos contactos quedan con el mismo email, está
  // bien — es la realidad del negocio. Si en el futuro queremos detectar
  // duplicados accidentales, lo hacemos como un warning suave en el front,
  // no como una constraint que bloquea.
  //
  // Por compatibilidad con datos históricos:
  //   1) email pasa a NULL-able (queda así).
  //   2) Limpiamos `''` → NULL para que `WHERE email IS NULL` funcione.
  //   3) Quitamos cualquier UNIQUE / partial index sobre email que haya
  //      quedado de versiones anteriores. Re-correr esto es seguro.
  await pool.query(`ALTER TABLE crm_clients ALTER COLUMN email DROP NOT NULL;`);
  await pool.query(`UPDATE crm_clients SET email = NULL WHERE email IS NOT NULL AND TRIM(email) = '';`);
  await pool.query(`ALTER TABLE crm_clients DROP CONSTRAINT IF EXISTS crm_clients_email_unique;`);
  await pool.query(`DROP INDEX IF EXISTS idx_crm_clients_email_unique;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_state (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_documents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      filename TEXT NOT NULL,
      mimetype TEXT NOT NULL,
      size INTEGER NOT NULL,
      data TEXT NOT NULL,
      uploaded_by TEXT,
      uploaded_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_biolinks (
      id TEXT PRIMARY KEY,
      seller_id TEXT,
      slug TEXT UNIQUE NOT NULL,
      photo TEXT,
      name TEXT NOT NULL,
      title TEXT,
      phone TEXT,
      email TEXT,
      instagram TEXT,
      facebook TEXT,
      linkedin TEXT,
      whatsapp TEXT,
      website TEXT,
      youtube_url TEXT,
      maps_url TEXT,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_biolink_settings (
      id TEXT PRIMARY KEY DEFAULT 'global',
      form_fields JSONB NOT NULL DEFAULT '{"name":true,"email":true,"phone":true,"city":true}'::jsonb,
      theme TEXT NOT NULL DEFAULT 'dark',
      primary_color TEXT NOT NULL DEFAULT '#fab510',
      show_youtube BOOLEAN NOT NULL DEFAULT false,
      show_map BOOLEAN NOT NULL DEFAULT false,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    INSERT INTO crm_biolink_settings (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;
  `);

  // Migrate: corporate/global content fields used by every biolink.
  // Per-seller cards inherit these; only name, photo, title, phone, email are personal.
  await pool.query(`ALTER TABLE crm_biolink_settings ADD COLUMN IF NOT EXISTS company_name TEXT;`);
  await pool.query(`ALTER TABLE crm_biolink_settings ADD COLUMN IF NOT EXISTS company_tagline TEXT;`);
  await pool.query(`ALTER TABLE crm_biolink_settings ADD COLUMN IF NOT EXISTS company_description TEXT;`);
  await pool.query(`ALTER TABLE crm_biolink_settings ADD COLUMN IF NOT EXISTS company_logo TEXT;`);
  await pool.query(`ALTER TABLE crm_biolink_settings ADD COLUMN IF NOT EXISTS instagram TEXT;`);
  await pool.query(`ALTER TABLE crm_biolink_settings ADD COLUMN IF NOT EXISTS facebook TEXT;`);
  await pool.query(`ALTER TABLE crm_biolink_settings ADD COLUMN IF NOT EXISTS linkedin TEXT;`);
  await pool.query(`ALTER TABLE crm_biolink_settings ADD COLUMN IF NOT EXISTS tiktok TEXT;`);
  await pool.query(`ALTER TABLE crm_biolink_settings ADD COLUMN IF NOT EXISTS whatsapp TEXT;`);
  await pool.query(`ALTER TABLE crm_biolink_settings ADD COLUMN IF NOT EXISTS website TEXT;`);
  await pool.query(`ALTER TABLE crm_biolink_settings ADD COLUMN IF NOT EXISTS youtube_url TEXT;`);
  await pool.query(`ALTER TABLE crm_biolink_settings ADD COLUMN IF NOT EXISTS maps_url TEXT;`);
  await pool.query(`ALTER TABLE crm_biolink_settings ADD COLUMN IF NOT EXISTS featured_products JSONB NOT NULL DEFAULT '[]'::jsonb;`);
  await pool.query(`ALTER TABLE crm_biolink_settings ADD COLUMN IF NOT EXISTS catalog_title TEXT;`);
  await pool.query(`ALTER TABLE crm_biolink_settings ADD COLUMN IF NOT EXISTS videos JSONB NOT NULL DEFAULT '[]'::jsonb;`);

  // Backfill: if the old single youtube_url has a value but videos is empty, seed the array
  await pool.query(`
    UPDATE crm_biolink_settings
    SET videos = jsonb_build_array(jsonb_build_object('id', 'v-legacy', 'title', 'Video', 'url', youtube_url))
    WHERE id = 'global'
      AND (videos IS NULL OR videos = '[]'::jsonb)
      AND youtube_url IS NOT NULL
      AND youtube_url <> ''
  `);

  // Seed Arte Concreto defaults — only fills values that are currently empty/null.
  // Re-running this on every boot is safe because COALESCE + NULLIF leaves existing non-empty values untouched.
  await pool.query(`
    UPDATE crm_biolink_settings SET
      company_name         = COALESCE(NULLIF(company_name, ''), 'ArteConcreto'),
      company_tagline      = COALESCE(NULLIF(company_tagline, ''), 'Concretamos tus Ideas'),
      company_description  = COALESCE(NULLIF(company_description, ''), 'Diseñamos, producimos e instalamos piezas únicas para proyectos arquitectónicos.'),
      instagram            = COALESCE(NULLIF(instagram, ''), 'https://www.instagram.com/arteconcreto.mobiliario/'),
      facebook             = COALESCE(NULLIF(facebook, ''), 'https://www.facebook.com/arteconcreto.bga'),
      linkedin             = COALESCE(NULLIF(linkedin, ''), 'https://www.linkedin.com/company/arteconcreto-mobiliario'),
      whatsapp             = COALESCE(NULLIF(whatsapp, ''), '573178929477'),
      website              = COALESCE(NULLIF(website, ''), 'https://arteconcreto.co'),
      youtube_url          = COALESCE(NULLIF(youtube_url, ''), 'https://www.youtube.com/watch?v=bzfWrvZx9yM'),
      maps_url             = COALESCE(NULLIF(maps_url, ''), 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4964.908520958651!2d-73.11279222411343!3d7.061664716673781!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e683fa9858291df%3A0xd27c8e86694e23fb!2sArteconcreto!5e1!3m2!1ses-419!2sco!4v1776823822427!5m2!1ses-419!2sco'),
      catalog_title        = COALESCE(NULLIF(catalog_title, ''), 'Productos Destacados'),
      show_youtube         = TRUE,
      show_map             = TRUE,
      primary_color        = COALESCE(NULLIF(primary_color, ''), '#fab510'),
      theme                = COALESCE(NULLIF(theme, ''), 'dark')
    WHERE id = 'global';
  `);

  // Seed default featured videos if empty
  await pool.query(`
    UPDATE crm_biolink_settings
    SET videos = jsonb_build_array(
      jsonb_build_object('id', 'v-default-1', 'title', 'Conoce ArteConcreto', 'url', 'https://www.youtube.com/watch?v=bzfWrvZx9yM')
    )
    WHERE id = 'global' AND (videos IS NULL OR videos = '[]'::jsonb);
  `);

  // Seed default featured products if empty
  await pool.query(`
    UPDATE crm_biolink_settings
    SET featured_products = jsonb_build_array(
      jsonb_build_object(
        'id', 'p-mesa-hopper',
        'name', 'Mesa Hopper',
        'price', '$3.217.000',
        'url', 'https://arteconcreto.co/producto/mesa-hopper'
      ),
      jsonb_build_object(
        'id', 'p-banca-solut',
        'name', 'Banca Solut con Espaldar',
        'price', '$3.007.000',
        'url', 'https://arteconcreto.co/producto/banca-solut-con-espaldar'
      )
    )
    WHERE id = 'global' AND (featured_products IS NULL OR featured_products = '[]'::jsonb);
  `);

  // Per-client file attachments (old quotes, photos, signed contracts, etc.)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_client_attachments (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      name TEXT NOT NULL,
      filename TEXT NOT NULL,
      mimetype TEXT NOT NULL,
      size INTEGER NOT NULL,
      data TEXT NOT NULL,
      uploaded_by_id TEXT,
      uploaded_by_name TEXT,
      kind TEXT NOT NULL DEFAULT 'document',
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_client_attachments_client_id
    ON crm_client_attachments (client_id, uploaded_at DESC);
  `);
}
