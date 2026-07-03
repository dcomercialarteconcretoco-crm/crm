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

// Singleton: ejecutamos los CREATE/ALTER IF NOT EXISTS una sola vez por
// proceso. Antes corrían en cada request, sumando varios cientos de ms a cada
// endpoint que llama a la DB. En Vercel cada lambda warm reusa esta promesa.
let schemaPromise: Promise<void> | null = null;

export async function ensureCrmSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = doEnsureCrmSchema().catch(err => {
      // Si falla, permitimos retry en la próxima request.
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

async function doEnsureCrmSchema() {
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

  // ── Cargo del contacto ──────────────────────────────────────────────────
  // Texto libre que el asesor escribe para identificar el rol del contacto
  // dentro de la empresa: "Director de Compras", "Asistente Administrativo",
  // "Gerente General", etc. No es taxonomía cerrada porque el universo de
  // títulos en B2B es infinito y el asesor sabe mejor que cualquier dropdown.
  //
  // OJO con "position": es palabra reservada SQL (función POSITION). Postgres
  // la acepta como columna pero la quoteamos siempre — y por seguridad mejor
  // aún, usamos un nombre alternativo como columna fall-back si el ALTER
  // anterior falló sin quotes (caso de algún deploy intermedio).
  await pool.query(`ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS "position" TEXT;`);

  // ── Notas internas del cliente ──────────────────────────────────────────
  // Bitácora de notas que el asesor escribe sobre el lead/cliente (visitas,
  // llamadas, contexto del proyecto). Antes esta columna NO existía: el front
  // mandaba `notes` en el PUT de /api/clients/[id] pero el server las tiraba a
  // la basura, y en producción localStorage para crm_clients está deshabilitado
  // → la nota desaparecía en el primer F5. Reportado 18-jun-2026 ("subimos
  // notas y al recargar no quedan"). Se guarda como array JSONB de
  // { text, date, author }. Default '[]' para que los clientes existentes
  // queden con bitácora vacía en vez de NULL.
  await pool.query(`ALTER TABLE crm_clients ADD COLUMN IF NOT EXISTS notes JSONB NOT NULL DEFAULT '[]'::jsonb;`);

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

  // ── Bandeja de Leads Crudos ─────────────────────────────────────────────
  // Universo de leads "previos al directorio". El SuperAdmin sube datos
  // masivos (CSV o manual) que el equipo aún no ha calificado. Cuando un
  // vendedor (o el SuperAdmin) decide que un raw lead es buen prospecto, se
  // promueve a crm_clients y desaparece de acá.
  //
  // Estados:
  //   - new:        recién subido, sin asignar
  //   - assigned:   ya tiene vendedor responsable
  //   - contacted:  el vendedor ya intentó contacto (registra timestamp)
  //   - approved:   movido a crm_clients (esta fila se borra al promover)
  //   - discarded:  vendedor/admin lo descartó (se conserva por auditoría)
  //
  // No imponemos UNIQUE en email ni documento legal — datos crudos pueden
  // venir duplicados desde la fuente; deduplicamos en la promoción.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_raw_leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      city TEXT,
      country TEXT,
      legal_id TEXT,
      reference TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      assigned_to TEXT,
      assigned_to_name TEXT,
      assigned_at TIMESTAMPTZ,
      contacted_at TIMESTAMPTZ,
      promoted_client_id TEXT,
      uploaded_by TEXT,
      uploaded_by_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  // Columnas para bases masivas (ej. +70k empresas CO). Se agregan vía ALTER
  // para no perder los registros existentes cuando ya hay tabla.
  await pool.query(`
    ALTER TABLE crm_raw_leads
      ADD COLUMN IF NOT EXISTS department TEXT,
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS activities TEXT[],
      ADD COLUMN IF NOT EXISTS company_size TEXT,
      ADD COLUMN IF NOT EXISTS id_type TEXT,
      ADD COLUMN IF NOT EXISTS legal_rep TEXT,
      ADD COLUMN IF NOT EXISTS registration_date DATE
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_raw_leads_status
    ON crm_raw_leads (status, created_at DESC);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_raw_leads_assigned
    ON crm_raw_leads (assigned_to, status);
  `);
  // Filtros por geografía y tamaño usados en la UI de Leads Crudos cuando hay
  // bases masivas. Btree porque la cardinalidad de departamento/tamaño es baja
  // y permitimos combinarlos con status.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_raw_leads_department
    ON crm_raw_leads (department) WHERE department IS NOT NULL;
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_raw_leads_city
    ON crm_raw_leads (city) WHERE city IS NOT NULL;
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_raw_leads_size
    ON crm_raw_leads (company_size) WHERE company_size IS NOT NULL;
  `);
  // GIN sobre array de actividades CIIU — soporta "match any of these" con &&.
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_raw_leads_activities
    ON crm_raw_leads USING GIN (activities);
  `);
  // ── Eventos de contacto (bitácora inmutable) ────────────────────────────
  //
  // Registro append-only de cada contacto real con un cliente: click en
  // WhatsApp, click en llamar, envío de correo y anotaciones. A diferencia de
  // crm_state.auditLogs (que el front sobreescribe completo y no retiene
  // historial), esta tabla solo recibe INSERTs, así que sirve para medir
  // tiempo de 1ª/2ª/3ª respuesta por asesor (auditoría de gestión, jul-2026).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_contact_events (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      client_name TEXT,
      seller_id TEXT,
      seller_name TEXT,
      type TEXT NOT NULL,
      detail TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_contact_events_client
    ON crm_contact_events (client_id, created_at ASC);
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_contact_events_seller
    ON crm_contact_events (seller_id, created_at DESC);
  `);

  // ── Cliente Oculto (mystery shopper) ────────────────────────────────────
  //
  // Misiones del programa de cliente oculto (plan URB jul-2026): el Auditor
  // contacta a la empresa con una identidad ficticia por un canal real y
  // registra acá todo el ciclo (1ª respuesta, cotización, seguimientos,
  // rúbrica de 100 puntos). El sistema cruza el alias contra crm_clients y
  // crm_contact_events para generar "avisos de incógnito" cuando el vendedor
  // no hace lo que debe. Solo la ven SuperAdmin/Admin/Auditor.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS crm_mystery_missions (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      profile TEXT NOT NULL,
      channel TEXT NOT NULL,
      alias_name TEXT NOT NULL,
      alias_company TEXT,
      alias_phone TEXT,
      alias_email TEXT,
      status TEXT NOT NULL DEFAULT 'planned',
      contact_at TIMESTAMPTZ,
      first_response_at TIMESTAMPTZ,
      quote_at TIMESTAMPTZ,
      quote_format TEXT,
      attended_by TEXT,
      scores JSONB NOT NULL DEFAULT '{}'::jsonb,
      touches JSONB NOT NULL DEFAULT '[]'::jsonb,
      notes TEXT,
      linked_client_id TEXT,
      created_by TEXT,
      created_by_name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_crm_mystery_status
    ON crm_mystery_missions (status, created_at DESC);
  `);

  // pg_trgm habilita búsqueda ILIKE rápida en 70k+ filas. Si la extensión no
  // está disponible (raro en Neon), seguimos con seq scan — funciona aunque
  // más lento.
  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_crm_raw_leads_name_trgm
      ON crm_raw_leads USING GIN (LOWER(name) gin_trgm_ops);
    `);
  } catch {
    // Sin trigram: la búsqueda ILIKE igual funciona, solo más lenta.
  }
}
