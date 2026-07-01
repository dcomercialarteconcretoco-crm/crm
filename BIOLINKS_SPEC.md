# Tarjetas Digitales (BioLinks) — Spec de implementación

Módulo autocontenido para construir un sistema de **tarjetas de presentación digitales** estilo Linktree, con:

- Una página pública por tarjeta (`/b/{slug}`) con redes, foto, video YouTube, mapa, catálogo y CTA de captura de leads.
- Panel admin para CRUD de tarjetas y configuración de branding global.
- Generación de QR descargable.
- Descarga de contacto en formato vCard (`.vcf`).
- Captura de leads vía formulario público (con rate limit + notificación opcional por email).

**No incluye:** CRM, pipeline de ventas, usuarios/auth (excepto guard básico sobre el admin), integraciones con tiendas online.

---

## 1. Stack y dependencias

- **Next.js 15** (App Router, Server Components)
- **React 19**
- **Postgres** (cualquier proveedor: Neon, Supabase, Railway, RDS — el código usa `pg` standard)
- **TypeScript**

```bash
npm install pg qrcode lucide-react
npm install --save-dev @types/pg @types/qrcode
```

### Variables de entorno

```bash
# Postgres connection string
DATABASE_URL=postgres://user:pass@host:5432/db

# URL pública de la app (usado para QR y meta tags)
NEXT_PUBLIC_APP_URL=https://tu-dominio.com

# Opcional — email transaccional (Resend) para notificación de leads
RESEND_API_KEY=re_xxx
FROM_EMAIL=notificaciones@tu-dominio.com
LEAD_NOTIFICATION_EMAIL=marketing@tu-dominio.com
```

---

## 2. Modelo de datos

Dos tablas. Single-tenant — la config es un singleton (`id='global'`).

### `biolinks` — una fila por tarjeta

```sql
CREATE TABLE IF NOT EXISTS biolinks (
  id          TEXT PRIMARY KEY,            -- formato 'bl-{timestamp}'
  slug        TEXT UNIQUE NOT NULL,        -- URL: /b/{slug}
  name        TEXT NOT NULL,               -- nombre de la persona (requerido)
  photo       TEXT,                        -- data URL o URL remota
  title       TEXT,                        -- cargo, ej. "Asesor Comercial"
  phone       TEXT,
  email       TEXT,
  -- Overrides personales de redes (si vacío, hereda de biolink_settings)
  instagram   TEXT,
  facebook    TEXT,
  linkedin    TEXT,
  whatsapp    TEXT,
  website     TEXT,
  -- Overrides personales de contenido
  youtube_url TEXT,                        -- video individual (opcional)
  maps_url    TEXT,                        -- embed Google Maps (opcional)
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_biolinks_slug ON biolinks(slug);
```

### `biolink_settings` — configuración global (singleton)

```sql
CREATE TABLE IF NOT EXISTS biolink_settings (
  id                  TEXT PRIMARY KEY DEFAULT 'global',
  -- Toggles del formulario público
  form_fields         JSONB NOT NULL DEFAULT '{"name":true,"email":true,"phone":true,"city":true}'::jsonb,
  -- Branding
  theme               TEXT  NOT NULL DEFAULT 'dark',         -- 'dark' | 'light'
  primary_color       TEXT  NOT NULL DEFAULT '#fab510',
  show_youtube        BOOLEAN NOT NULL DEFAULT false,
  show_map            BOOLEAN NOT NULL DEFAULT false,
  -- Identidad de empresa
  company_name        TEXT,
  company_tagline     TEXT,
  company_description TEXT,
  company_logo        TEXT,                                  -- URL del logo
  -- Redes globales (heredadas por cada tarjeta que no defina la suya)
  instagram           TEXT,
  facebook            TEXT,
  linkedin            TEXT,
  tiktok              TEXT,
  whatsapp            TEXT,
  website             TEXT,
  youtube_url         TEXT,                                  -- legacy, ver `videos`
  maps_url            TEXT,
  -- Catálogo manual
  featured_products   JSONB NOT NULL DEFAULT '[]'::jsonb,
  catalog_title       TEXT,
  -- Lista de videos YouTube
  videos              JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO biolink_settings (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;
```

#### Forma de los JSONB

```ts
type FormFields = { name?: boolean; email?: boolean; phone?: boolean; city?: boolean };

type FeaturedProduct = {
  id: string;
  name: string;
  image?: string;      // URL
  price?: string;      // formateado, ej. "$3.217.000"
  url?: string;        // link al producto
};

type VideoEntry = {
  id: string;
  title: string;
  url: string;         // YouTube watch URL o youtu.be
};
```

### `biolink_leads` — leads capturados desde el formulario público

```sql
CREATE TABLE IF NOT EXISTS biolink_leads (
  id          TEXT PRIMARY KEY,            -- formato 'ld-{timestamp}'
  biolink_id  TEXT REFERENCES biolinks(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  phone       TEXT,
  city        TEXT,
  source_ip   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_biolink_leads_email ON biolink_leads(email);
CREATE INDEX IF NOT EXISTS idx_biolink_leads_biolink ON biolink_leads(biolink_id);
CREATE INDEX IF NOT EXISTS idx_biolink_leads_created ON biolink_leads(created_at DESC);
```

> **Nota:** `email` **NO** es UNIQUE — un mismo lead puede dejar sus datos en varias tarjetas distintas, y guardamos cada captura por separado para tener auditoría completa.

---

## 3. Estructura de archivos

```
src/
├── lib/
│   ├── db.ts                              # pool de Postgres + ensureSchema
│   └── rate-limit.ts                      # in-memory rate limiter
├── middleware.ts                          # guard de /api/biolinks (excepto /lead)
└── app/
    ├── b/[slug]/
    │   ├── page.tsx                       # Server Component: fetch + render
    │   └── BiolinkPublicCard.tsx          # Client Component: UI pública
    ├── biolinks/
    │   └── page.tsx                       # Admin: lista + editor de tarjetas
    ├── settings/biolinks/
    │   └── page.tsx                       # Admin: branding global
    └── api/biolinks/
        ├── route.ts                       # GET (list), POST (create)
        ├── [id]/route.ts                  # GET, PUT, DELETE
        ├── settings/route.ts              # GET, PUT (singleton)
        ├── lead/route.ts                  # POST (público)
        └── qr/[id]/route.ts               # GET (PNG)
```

---

## 4. Librerías utilitarias

### `src/lib/db.ts`

```ts
import { Pool } from 'pg';

let pool: Pool | null = null;

export function hasDatabase(): boolean {
  return !!process.env.DATABASE_URL;
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      // Habilita SSL para proveedores cloud (Neon, Supabase, Railway).
      // Omitir si tu DB es local sin SSL.
      ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
    });
  }
  return pool;
}

let schemaReady = false;

export async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  const p = getPool();

  await p.query(`
    CREATE TABLE IF NOT EXISTS biolinks (
      id          TEXT PRIMARY KEY,
      slug        TEXT UNIQUE NOT NULL,
      name        TEXT NOT NULL,
      photo       TEXT,
      title       TEXT,
      phone       TEXT,
      email       TEXT,
      instagram   TEXT,
      facebook    TEXT,
      linkedin    TEXT,
      whatsapp    TEXT,
      website     TEXT,
      youtube_url TEXT,
      maps_url    TEXT,
      active      BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_biolinks_slug ON biolinks(slug);`);

  await p.query(`
    CREATE TABLE IF NOT EXISTS biolink_settings (
      id                  TEXT PRIMARY KEY DEFAULT 'global',
      form_fields         JSONB NOT NULL DEFAULT '{"name":true,"email":true,"phone":true,"city":true}'::jsonb,
      theme               TEXT  NOT NULL DEFAULT 'dark',
      primary_color       TEXT  NOT NULL DEFAULT '#fab510',
      show_youtube        BOOLEAN NOT NULL DEFAULT false,
      show_map            BOOLEAN NOT NULL DEFAULT false,
      company_name        TEXT,
      company_tagline     TEXT,
      company_description TEXT,
      company_logo        TEXT,
      instagram           TEXT,
      facebook            TEXT,
      linkedin            TEXT,
      tiktok              TEXT,
      whatsapp            TEXT,
      website             TEXT,
      youtube_url         TEXT,
      maps_url            TEXT,
      featured_products   JSONB NOT NULL DEFAULT '[]'::jsonb,
      catalog_title       TEXT,
      videos              JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await p.query(`INSERT INTO biolink_settings (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;`);

  await p.query(`
    CREATE TABLE IF NOT EXISTS biolink_leads (
      id          TEXT PRIMARY KEY,
      biolink_id  TEXT REFERENCES biolinks(id) ON DELETE SET NULL,
      name        TEXT NOT NULL,
      email       TEXT NOT NULL,
      phone       TEXT,
      city        TEXT,
      source_ip   TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_biolink_leads_email   ON biolink_leads(email);`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_biolink_leads_biolink ON biolink_leads(biolink_id);`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_biolink_leads_created ON biolink_leads(created_at DESC);`);

  schemaReady = true;
}
```

### `src/lib/rate-limit.ts`

```ts
// Rate limiter in-memory. Se resetea en cold start (suficiente para anti-spam).
// Para producción multi-instancia, usar Redis/Upstash con la misma firma.

const store = new Map<string, { count: number; resetAt: number }>();

const DEFAULT_WINDOW_MS = 60_000;  // 1 minuto
const DEFAULT_MAX_REQUESTS = 10;   // máx peticiones por IP por ventana

export function rateLimit(
  ip: string,
  opts: { maxRequests?: number; windowMs?: number; key?: string } = {}
): { ok: boolean; retryAfter: number } {
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = opts.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const key = opts.key ? `${opts.key}:${ip}` : ip;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  return { ok: true, retryAfter: 0 };
}
```

---

## 5. Middleware

`src/middleware.ts` debe:

1. Permitir `POST /api/biolinks/lead` sin autenticación (es público).
2. Permitir las páginas `/b/{slug}` sin autenticación.
3. Bloquear el resto de `/api/biolinks/*` y `/biolinks` (admin) si no hay sesión válida.

Si el sistema destino **no tiene un sistema de auth** todavía, dejar comentado el bloque de auth y aceptar todo — pero **mantener** las cabeceras CORS y el rate limit en `/lead`, porque es el único endpoint expuesto a internet.

Esqueleto mínimo (adaptar al auth del sistema destino):

```ts
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_API_PREFIXES = [
  '/api/biolinks/lead',  // formulario público
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/api/')) return NextResponse.next();
  if (PUBLIC_API_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next();

  // TODO: validar sesión del usuario admin aquí.
  // Mientras no exista auth, dejar pasar; agregar el guard cuando el sistema
  // destino tenga su mecanismo (cookie, JWT, etc.).
  return NextResponse.next();
}

export const config = { matcher: ['/api/:path*'] };
```

---

## 6. API endpoints

### `GET /api/biolinks` — listar todas

`src/app/api/biolinks/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase, getPool, ensureSchema } from '@/lib/db';

function slug(name: string, id: string) {
  return name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    + '-' + id.slice(-4);
}

export async function GET() {
  if (!hasDatabase()) return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
  await ensureSchema();
  const { rows } = await getPool().query(`
    SELECT id, slug, name, photo, title, phone, email,
           instagram, facebook, linkedin, whatsapp, website,
           youtube_url, maps_url, active, created_at, updated_at
    FROM biolinks
    ORDER BY created_at DESC
  `);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!hasDatabase()) return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
  await ensureSchema();
  const body = await req.json();
  const id = `bl-${Date.now()}`;
  const cardSlug = body.slug?.trim() || slug(body.name || 'tarjeta', id);

  const { rows } = await getPool().query(`
    INSERT INTO biolinks
      (id, slug, name, photo, title, phone, email,
       instagram, facebook, linkedin, whatsapp, website,
       youtube_url, maps_url, active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    RETURNING *
  `, [
    id, cardSlug, body.name || '', body.photo || null, body.title || null,
    body.phone || null, body.email || null,
    body.instagram || null, body.facebook || null, body.linkedin || null,
    body.whatsapp || null, body.website || null,
    body.youtube_url || null, body.maps_url || null,
    body.active !== false,
  ]);
  return NextResponse.json(rows[0], { status: 201 });
}
```

### `GET / PUT / DELETE /api/biolinks/[id]`

`src/app/api/biolinks/[id]/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase, getPool, ensureSchema } from '@/lib/db';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDatabase()) return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
  await ensureSchema();
  const { rows } = await getPool().query(`SELECT * FROM biolinks WHERE id=$1 LIMIT 1`, [id]);
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDatabase()) return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
  await ensureSchema();
  const body = await req.json();

  const { rows } = await getPool().query(`
    UPDATE biolinks SET
      slug=COALESCE(NULLIF($1,''), slug), photo=$2, name=$3, title=$4,
      phone=$5, email=$6, instagram=$7, facebook=$8, linkedin=$9,
      whatsapp=$10, website=$11, youtube_url=$12, maps_url=$13, active=$14,
      updated_at=NOW()
    WHERE id=$15 RETURNING *
  `, [
    body.slug?.trim() || '', body.photo || null, body.name || '', body.title || null,
    body.phone || null, body.email || null,
    body.instagram || null, body.facebook || null, body.linkedin || null,
    body.whatsapp || null, body.website || null,
    body.youtube_url || null, body.maps_url || null,
    body.active !== false, id,
  ]);
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(rows[0]);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasDatabase()) return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
  await ensureSchema();
  await getPool().query(`DELETE FROM biolinks WHERE id=$1`, [id]);
  return NextResponse.json({ ok: true });
}
```

### `GET / PUT /api/biolinks/settings`

`src/app/api/biolinks/settings/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase, getPool, ensureSchema } from '@/lib/db';

const DEFAULTS = {
  id: 'global',
  form_fields: { name: true, email: true, phone: true, city: true },
  theme: 'dark' as const,
  primary_color: '#fab510',
  show_youtube: false,
  show_map: false,
  company_name: '',
  company_tagline: '',
  company_description: '',
  company_logo: '',
  instagram: '',
  facebook: '',
  linkedin: '',
  tiktok: '',
  whatsapp: '',
  website: '',
  youtube_url: '',
  maps_url: '',
  featured_products: [] as Array<{ id: string; name: string; image?: string; price?: string; url?: string }>,
  catalog_title: '',
  videos: [] as Array<{ id: string; title: string; url: string }>,
};

export async function GET() {
  if (!hasDatabase()) return NextResponse.json(DEFAULTS);
  await ensureSchema();
  const { rows } = await getPool().query(`SELECT * FROM biolink_settings WHERE id='global' LIMIT 1`);
  return NextResponse.json({ ...DEFAULTS, ...(rows[0] || {}) });
}

export async function PUT(req: NextRequest) {
  if (!hasDatabase()) return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
  await ensureSchema();
  const body = await req.json();
  const m = { ...DEFAULTS, ...body };

  const { rows } = await getPool().query(`
    INSERT INTO biolink_settings (
      id, form_fields, theme, primary_color, show_youtube, show_map,
      company_name, company_tagline, company_description, company_logo,
      instagram, facebook, linkedin, tiktok, whatsapp, website,
      youtube_url, maps_url, featured_products, catalog_title, videos, updated_at
    ) VALUES (
      'global', $1::jsonb, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12, $13, $14, $15,
      $16, $17, $18::jsonb, $19, $20::jsonb, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      form_fields=$1::jsonb, theme=$2, primary_color=$3,
      show_youtube=$4, show_map=$5,
      company_name=$6, company_tagline=$7, company_description=$8, company_logo=$9,
      instagram=$10, facebook=$11, linkedin=$12, tiktok=$13, whatsapp=$14, website=$15,
      youtube_url=$16, maps_url=$17,
      featured_products=$18::jsonb, catalog_title=$19, videos=$20::jsonb,
      updated_at=NOW()
    RETURNING *
  `, [
    JSON.stringify(m.form_fields || {}),
    m.theme, m.primary_color, !!m.show_youtube, !!m.show_map,
    m.company_name || '', m.company_tagline || '', m.company_description || '', m.company_logo || '',
    m.instagram || '', m.facebook || '', m.linkedin || '', m.tiktok || '', m.whatsapp || '', m.website || '',
    m.youtube_url || '', m.maps_url || '',
    JSON.stringify(m.featured_products || []),
    m.catalog_title || '',
    JSON.stringify(Array.isArray(m.videos) ? m.videos : []),
  ]);
  return NextResponse.json(rows[0]);
}
```

### `POST /api/biolinks/lead` — captura de lead público

`src/app/api/biolinks/lead/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase, getPool, ensureSchema } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  const rl = rateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Demasiadas solicitudes. Intenta en ${rl.retryAfter}s` },
      { status: 429, headers: { ...CORS_HEADERS, 'Retry-After': String(rl.retryAfter) } }
    );
  }

  try {
    const { name, email, phone, city, biolinkId, employeeName } = await req.json();

    if (!name || !email) {
      return NextResponse.json({ error: 'name y email son requeridos' },
        { status: 400, headers: CORS_HEADERS });
    }
    // Validación mínima de email — evita basura tipo "asdf"
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim())) {
      return NextResponse.json({ error: 'Correo electrónico no válido.' },
        { status: 400, headers: CORS_HEADERS });
    }

    if (!hasDatabase()) {
      return NextResponse.json({ ok: true, message: 'Sin DB — datos no persisted' },
        { headers: CORS_HEADERS });
    }

    await ensureSchema();
    const pool = getPool();

    const id = `ld-${Date.now()}`;
    await pool.query(`
      INSERT INTO biolink_leads (id, biolink_id, name, email, phone, city, source_ip)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [id, biolinkId || null, name, email, phone || null, city || null, ip]);

    // Notificación opcional por email (fire-and-forget, no bloquea la respuesta)
    const resendKey = process.env.RESEND_API_KEY;
    const to = process.env.LEAD_NOTIFICATION_EMAIL;
    const from = process.env.FROM_EMAIL || 'notificaciones@example.com';
    if (resendKey && to) {
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [to],
          subject: employeeName
            ? `Nuevo lead desde tarjeta de ${employeeName}`
            : 'Nuevo lead desde tarjeta digital',
          html: `<p><strong>${name}</strong> dejó sus datos${employeeName ? ` en la tarjeta de <strong>${employeeName}</strong>` : ''}.</p>
                 <p>Email: ${email}<br>Tel: ${phone || '—'}<br>Ciudad: ${city || '—'}</p>`,
        }),
      }).catch(console.error);
    }

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (err: any) {
    console.error('biolinks/lead error:', err);
    return NextResponse.json({ error: err.message || 'Error' },
      { status: 500, headers: CORS_HEADERS });
  }
}
```

### `GET /api/biolinks/qr/[id]` — QR PNG descargable

`src/app/api/biolinks/qr/[id]/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase, getPool, ensureSchema } from '@/lib/db';
import QRCode from 'qrcode';

export const runtime = 'nodejs';  // qrcode requires Node, not Edge

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let slug = id;

  if (hasDatabase()) {
    await ensureSchema();
    const { rows } = await getPool().query(`SELECT slug FROM biolinks WHERE id=$1 LIMIT 1`, [id]);
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    slug = rows[0].slug;
  }

  const url = `${APP_URL}/b/${slug}`;
  const png = await QRCode.toBuffer(url, {
    type: 'png',
    width: 600,
    margin: 2,
    color: { dark: '#111111', light: '#FFFFFF' },
  });

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="qr-${slug}.png"`,
      'Cache-Control': 'no-store',
    },
  });
}
```

---

## 7. Página pública

### `src/app/b/[slug]/page.tsx` — Server Component

```tsx
import { notFound } from 'next/navigation';
import { hasDatabase, getPool, ensureSchema } from '@/lib/db';
import BiolinkPublicCard from './BiolinkPublicCard';

export interface Biolink {
  id: string; slug: string; name: string; title?: string; photo?: string;
  phone?: string; email?: string;
  instagram?: string; facebook?: string; linkedin?: string;
  whatsapp?: string; website?: string;
  youtube_url?: string; maps_url?: string; active: boolean;
}

export interface FeaturedProduct { id: string; name: string; image?: string; price?: string; url?: string; }
export interface VideoEntry { id: string; title: string; url: string; }

export interface Settings {
  form_fields: Record<string, boolean>;
  theme: string;
  primary_color: string;
  show_youtube: boolean;
  show_map: boolean;
  company_name?: string;
  company_tagline?: string;
  company_description?: string;
  company_logo?: string;
  instagram?: string; facebook?: string; linkedin?: string;
  tiktok?: string; whatsapp?: string; website?: string;
  youtube_url?: string; maps_url?: string;
  featured_products?: FeaturedProduct[];
  catalog_title?: string;
  videos?: VideoEntry[];
}

const DEFAULT_SETTINGS: Settings = {
  form_fields: { name: true, email: true, phone: true, city: true },
  theme: 'dark', primary_color: '#fab510',
  show_youtube: false, show_map: false,
  featured_products: [], videos: [],
};

async function getData(slug: string): Promise<{ card: Biolink; settings: Settings } | null> {
  if (!hasDatabase()) return null;
  try {
    await ensureSchema();
    const p = getPool();
    const [cardRes, settingsRes] = await Promise.all([
      p.query(`SELECT * FROM biolinks WHERE slug=$1 AND active=true LIMIT 1`, [slug]),
      p.query(`SELECT * FROM biolink_settings WHERE id='global' LIMIT 1`),
    ]);
    if (!cardRes.rows.length) return null;

    const raw = settingsRes.rows[0] || {};
    let videos: VideoEntry[] = Array.isArray(raw.videos) ? raw.videos : [];
    // Fallback: si videos[] está vacío pero hay youtube_url legacy, sintetizar entrada
    if (videos.length === 0 && raw.youtube_url) {
      videos = [{ id: 'v-legacy', title: 'Video', url: raw.youtube_url }];
    }
    const settings: Settings = { ...DEFAULT_SETTINGS, ...raw, videos };

    // Merge: campos personales ganan; si vacíos, hereda de global
    const rawCard = cardRes.rows[0];
    const card: Biolink = {
      ...rawCard,
      instagram:   rawCard.instagram   || settings.instagram   || '',
      facebook:    rawCard.facebook    || settings.facebook    || '',
      linkedin:    rawCard.linkedin    || settings.linkedin    || '',
      whatsapp:    rawCard.whatsapp    || settings.whatsapp    || '',
      website:     rawCard.website     || settings.website     || '',
      youtube_url: rawCard.youtube_url || settings.youtube_url || '',
      maps_url:    rawCard.maps_url    || settings.maps_url    || '',
    };
    return { card, settings };
  } catch {
    return null;
  }
}

export default async function BiolinkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getData(slug);
  if (!data) notFound();
  return <BiolinkPublicCard card={data.card} settings={data.settings} />;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getData(slug);
  if (!data) return { title: 'Tarjeta no encontrada' };
  const company = data.settings.company_name || '';
  return {
    title: company ? `${data.card.name} — ${company}` : data.card.name,
    description: data.card.title || data.settings.company_tagline || 'Tarjeta digital profesional',
    openGraph: { images: data.card.photo ? [data.card.photo] : [] },
  };
}
```

### `src/app/b/[slug]/BiolinkPublicCard.tsx` — Client Component

Es el componente más grande. Estructura:

1. **Hero** — logo de empresa (izquierda) + foto circular del titular (derecha) + nombre, cargo, descripción.
2. **Social links** — fila de iconos circulares (Phone, WhatsApp, Email, Instagram, Facebook, LinkedIn, TikTok, Web). Cada uno con su color de marca.
3. **CTAs**:
   - Botón primario **"DEJAR MIS DATOS"** que despliega formulario inline. Campos según `settings.form_fields`. Estados: idle / loading / success / error.
   - Botón secundario **"DESCARGAR CONTACTO"** que genera `.vcf` (vCard 3.0) y dispara descarga.
4. **Videos YouTube** — si `show_youtube`, render de `videos[]` como iframes 16:9 con título.
5. **Mapa** — si `show_map` y hay `maps_url`, iframe del embed de Google Maps.
6. **Catálogo** — grid 2-cols de `featured_products`. Cada item: imagen cuadrada + nombre + precio. Si tiene `url`, es link.
7. **Footer** — pequeño "Powered by …".

Copiar tal cual de [BiolinkPublicCard.tsx](src/app/b/[slug]/BiolinkPublicCard.tsx) en el sistema actual. Ajustes a hacer en el destino:

- **Línea del `<img src="/api/logo">`**: reemplazar por el `settings.company_logo` (URL directa) o por la ruta del logo del sistema destino.
- **`downloadVCard(card, settings.company_name || 'Arte Concreto S.A.S')`**: cambiar el fallback de `'Arte Concreto S.A.S'` por el nombre de empresa del cliente nuevo.
- **Footer "Powered by MiWibiCRM"**: ajustar o quitar.

**Funciones auxiliares clave** (incluidas dentro del componente):

```ts
function getYoutubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    let id = '';
    if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1);
    else id = u.searchParams.get('v') || '';
    return id ? `https://www.youtube.com/embed/${id}` : null;
  } catch { return null; }
}

function escapeVCard(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

function downloadVCard(card: Biolink, companyName: string) {
  const parts = card.name.trim().split(/\s+/);
  // Para iOS/macOS: N = Family;Given;Middle;Prefix;Suffix
  const family = parts.length >= 3 ? parts.slice(-2).join(' ') : (parts[parts.length - 1] || '');
  const given  = parts.length >= 3 ? parts.slice(0, -2).join(' ') : (parts.slice(0, -1).join(' ') || parts[0] || '');
  const vcf = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeVCard(family)};${escapeVCard(given)};;;`,
    `FN:${escapeVCard(card.name)}`,
    card.title    ? `TITLE:${escapeVCard(card.title)}` : '',
    `ORG:${escapeVCard(companyName)}`,
    card.phone    ? `TEL;TYPE=CELL,VOICE:${card.phone}` : '',
    card.email    ? `EMAIL;TYPE=WORK:${card.email}` : '',
    card.website  ? `URL:${card.website}` : '',
    card.instagram ? `X-SOCIALPROFILE;TYPE=instagram:${card.instagram}` : '',
    card.photo    ? `PHOTO;VALUE=URL:${card.photo}` : '',
    'END:VCARD',
  ].filter(Boolean).join('\r\n');

  const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${card.name.replace(/\s+/g, '_')}.vcf`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(a.href);
}
```

**POST al endpoint de lead** desde el handler del form:

```ts
const res = await fetch('/api/biolinks/lead', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...form, biolinkId: card.id, employeeName: card.name }),
});
```

---

## 8. Páginas de admin

### `/biolinks` — Lista + editor de tarjetas

`src/app/biolinks/page.tsx`

Funcionalidad mínima:

- Grid de cards: foto, nombre, cargo, slug `/b/{slug}`, estado (Activa/Inactiva), iconos de redes configuradas.
- Botones por card: **Ver** (abre `/b/{slug}` en nueva pestaña), **QR** (descarga PNG vía `GET /api/biolinks/qr/{id}`), **Editar**, **Eliminar**.
- Botón "Nueva tarjeta" arriba.
- Modal/drawer editor con:
  - Inputs: `name*`, `title`, `phone`, `email`, `slug` (auto si vacío)
  - Upload `photo` (convertir a data URL en cliente con `FileReader.readAsDataURL`)
  - Inputs de redes personales (overrides): `instagram`, `facebook`, `linkedin`, `whatsapp`, `website`
  - Inputs avanzados: `youtube_url`, `maps_url`
  - Toggle `active`
- Preview panel opcional con el render del componente público (mismo `BiolinkPublicCard`).

**Operaciones:**

```ts
// listar
const cards = await fetch('/api/biolinks').then(r => r.json());

// crear
await fetch('/api/biolinks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(form),
});

// actualizar
await fetch(`/api/biolinks/${id}`, { method: 'PUT', ... });

// borrar
await fetch(`/api/biolinks/${id}`, { method: 'DELETE' });

// QR
window.open(`/api/biolinks/qr/${id}`);
```

### `/settings/biolinks` — Configuración global

Form único contra `GET / PUT /api/biolinks/settings`. Secciones:

1. **Tema** — radio Oscuro/Claro
2. **Color principal** — color picker + input HEX
3. **Campos del formulario** — toggles para `form_fields.name|email|phone|city`
4. **Visibilidad** — toggles `show_youtube`, `show_map`
5. **Empresa** — `company_name`, `company_tagline`, `company_description`, `company_logo` (URL)
6. **Redes globales** — `instagram`, `facebook`, `linkedin`, `tiktok`, `whatsapp`, `website`
7. **Mapa global** — `maps_url` (embed URL completa de Google Maps)
8. **Videos** — editor de lista `videos[]`. Cada fila: `title` + `url`. Botón "Agregar" y "Eliminar" por item.
9. **Catálogo** — `catalog_title` + editor de lista `featured_products[]`. Cada fila: `name`, `image` URL, `price` (string libre), `url`. Botones "Agregar" y "Eliminar".

Guardar con un único `PUT` que envía el objeto completo.

---

## 9. Flujos clave

### Flujo de captura de lead

```
Usuario en /b/{slug}
   ↓ click "DEJAR MIS DATOS"
   ↓ rellena form (name, email, phone, city)
   ↓ submit
POST /api/biolinks/lead { name, email, phone, city, biolinkId, employeeName }
   ↓
Rate limit por IP (10/min, 429 si excede)
   ↓
Validación: name y email requeridos, email con regex básica
   ↓
INSERT en biolink_leads (siempre inserta — múltiples capturas permitidas)
   ↓
[Opcional] Notificación Resend a LEAD_NOTIFICATION_EMAIL (fire-and-forget)
   ↓
{ ok: true } → UI muestra panel verde "¡Gracias!"
```

### Flujo de generación de slug

Cuando se crea una tarjeta sin slug explícito:

```
input: name="Juan Pérez", id="bl-1735200000000"
   ↓ normalize NFD + remove diacritics → "Juan Perez"
   ↓ lowercase + replace non-alphanumeric con "-" → "juan-perez"
   ↓ trim leading/trailing "-" → "juan-perez"
   ↓ append last 4 chars of id → "juan-perez-0000"
output: "juan-perez-0000"
```

El slug es UNIQUE en la tabla. Si dos personas se llaman igual, los últimos 4 chars del ID (timestamp) los diferencian.

### Flujo de herencia de redes (override personal vs global)

Cada tarjeta tiene campos personales opcionales: `instagram`, `facebook`, `linkedin`, `whatsapp`, `website`, `youtube_url`, `maps_url`.

En `page.tsx` server-side, antes de pasar al componente cliente:

```ts
card.instagram = card.instagram || settings.instagram || '';
// ...mismo para los demás
```

Resultado:
- Si la tarjeta tiene `instagram = "https://instagram.com/juan"` → muestra el del seller.
- Si la tarjeta tiene `instagram = ""` → muestra el global de la empresa.
- Si ambos están vacíos → no muestra el icono.

`tiktok` solo vive en settings global (no hay override personal).

---

## 10. Branding / temas

### Color principal

Una sola variable `primary_color` (HEX). Se usa para:
- Fondo del botón "DEJAR MIS DATOS" y el de submit
- Borde de la foto de perfil
- Acentos en iconos (Phone, Email, Web, MapPin, ShoppingBag)
- Precio del catálogo

Pasada como variable inline `style={{ background: pc }}` en el componente cliente.

### Tema

`theme: 'dark' | 'light'` controla:
- Gradiente de fondo (`linear-gradient(160deg, #0d0d0e ... #0d0d0e)` vs `... #f8f8fa ...`)
- Color de texto principal y secundario
- Color de bordes y de fondos de cards internos
- Color del logo (`filter: brightness(0) invert(1)` en dark)

Ver helpers al inicio del componente:

```ts
const isDark = settings.theme !== 'light';
const bg     = isDark ? 'linear-gradient(...)' : 'linear-gradient(...)';
const txtMain = isDark ? '#ffffff' : '#111111';
// etc.
```

---

## 11. Permisos (opcional)

Si el sistema destino tiene roles/usuarios:

- **Ver `/biolinks`** — Admin/Manager
- **Crear/editar/borrar** tarjetas — Admin/Manager
- **Editar `/settings/biolinks`** — solo Admin

Si no hay sistema de roles aún, dejar el admin protegido solo por sesión y abrir todo a usuarios autenticados.

---

## 12. Checklist de implementación

- [ ] Instalar dependencias: `pg`, `qrcode`, `lucide-react` + tipos
- [ ] Configurar `DATABASE_URL` y `NEXT_PUBLIC_APP_URL` en `.env`
- [ ] Crear `src/lib/db.ts` con `ensureSchema()`
- [ ] Crear `src/lib/rate-limit.ts`
- [ ] Configurar `src/middleware.ts` para permitir `/api/biolinks/lead` y `/b/*` sin auth
- [ ] Crear los 5 endpoints de `/api/biolinks/*`
- [ ] Crear `/b/[slug]/page.tsx` (server) y `BiolinkPublicCard.tsx` (cliente)
- [ ] Crear `/biolinks/page.tsx` (admin lista + editor)
- [ ] Crear `/settings/biolinks/page.tsx` (config global)
- [ ] Crear una tarjeta de prueba y verificar:
  - [ ] `/b/{slug}` carga y se ve correcta
  - [ ] Botón "DESCARGAR CONTACTO" baja un `.vcf` válido (abrir en Contactos del Mac/iPhone)
  - [ ] Botón "DEJAR MIS DATOS" envía → aparece en `biolink_leads`
  - [ ] Rate limit funciona (11 envíos seguidos desde la misma IP → 429)
  - [ ] `GET /api/biolinks/qr/{id}` baja un PNG escaneable
- [ ] Configurar `RESEND_API_KEY`, `LEAD_NOTIFICATION_EMAIL`, `FROM_EMAIL` si se quiere notificación por email
- [ ] Personalizar `BiolinkPublicCard.tsx`:
  - [ ] Logo: reemplazar `src="/api/logo"` por el logo del cliente
  - [ ] Fallback de empresa en `downloadVCard(...)` 
  - [ ] Footer "Powered by …"

---

## 13. Notas de diseño y gotchas

### Por qué `biolink_leads` no tiene UNIQUE en email
Un mismo lead puede dejar sus datos en varias tarjetas de la misma empresa (ej. un cliente conoce a dos vendedores en una feria). Guardamos cada captura como evento separado para tener auditoría completa de qué tarjeta convirtió a quién.

### Por qué el QR endpoint usa `runtime = 'nodejs'`
La librería `qrcode` no funciona en Edge Runtime. Hay que forzar Node.

### Por qué `ensureSchema()` se llama en cada request
Vercel serverless tiene cold starts. La función chequea un flag `schemaReady` (módulo-level cache) — solo ejecuta los `CREATE TABLE IF NOT EXISTS` en el primer hit por instancia. En instancias calientes es no-op.

### Por qué `videos` (JSONB array) y no tabla separada
Es una lista pequeña (típicamente 1-5 videos), administrada exclusivamente desde el panel global, sin necesidad de queries individuales ni joins. JSONB es más simple y suficiente.

### Por qué hay `youtube_url` además de `videos`
`youtube_url` es legacy del v1. La página pública hace fallback automático: si `videos` está vacío pero `youtube_url` tiene valor, sintetiza una entrada. Se puede borrar la columna en una migración futura.

### Slug colisiones
El slug auto-generado agrega los últimos 4 chars del `id` (timestamp). Probabilidad de colisión es prácticamente nula para volumen de tarjetas humano. Si el admin define slug manual, la UNIQUE constraint de Postgres devuelve error 500 (mejorable a 409 con `try/catch` en POST/PUT si se quiere mensaje amigable).

### CORS abierto en `/lead`
`Access-Control-Allow-Origin: *` permite que la tarjeta funcione si se embebe en cualquier sitio (widget, iframe). Si el sistema destino solo quiere capturar desde su propio dominio, restringir a `process.env.NEXT_PUBLIC_APP_URL`.

### Rate limit es in-memory
Se resetea en cada cold start de la serverless function. Para protección más robusta usar Upstash Redis con la misma firma `rateLimit(ip, opts)`.
