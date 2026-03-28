import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// ── JWT + OAuth para Google Service Account (sin paquetes externos) ──────────

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson) as {
    client_email: string;
    private_key: string;
  };

  const now = Math.floor(Date.now() / 1000);
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss:   sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud:   'https://oauth2.googleapis.com/token',
    exp:   now + 3600,
    iat:   now,
  })).toString('base64url');

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(sa.private_key, 'base64url');

  const jwt = `${header}.${payload}.${sig}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json() as { access_token?: string; error?: string };
  if (!data.access_token) throw new Error(data.error || 'No access token');
  return data.access_token;
}

// ── GA4 Data API helper ──────────────────────────────────────────────────────

async function runReport(
  accessToken: string,
  propertyId: string,
  body: object,
): Promise<unknown> {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GA4 API error ${res.status}: ${err}`);
  }
  return res.json();
}

// ── Tipos de respuesta GA4 ───────────────────────────────────────────────────

interface GA4Row {
  dimensionValues?: { value: string }[];
  metricValues?:    { value: string }[];
}

interface GA4Report {
  rows?:          GA4Row[];
  totals?:        GA4Row[];
  rowCount?:      number;
  metricHeaders?: { name: string }[];
}

function metricVal(row: GA4Row, idx: number): number {
  return parseFloat(row.metricValues?.[idx]?.value ?? '0') || 0;
}

// ── Cache simple en memoria (evita llamadas repetidas dentro del mismo proceso) ─

const cache = new Map<string, { data: unknown; at: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hora

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const propertyId = req.nextUrl.searchParams.get('propertyId')
    || process.env.GA4_PROPERTY_ID
    || '';

  const saJson = process.env.GA4_SERVICE_ACCOUNT_JSON || '';

  if (!propertyId || !saJson) {
    return NextResponse.json(
      { error: 'GA4 no configurado. Agrega GA4_PROPERTY_ID y GA4_SERVICE_ACCOUNT_JSON en .env.local' },
      { status: 424 },
    );
  }

  const cacheKey = `ga4_${propertyId}`;
  const cached   = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const token = await getAccessToken(saJson);

    const dateRange = { startDate: '30daysAgo', endDate: 'today' };

    // ── Reporte 1: Métricas globales ─────────────────────────────────────────
    const globalReport = await runReport(token, propertyId, {
      dateRanges: [dateRange],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
        { name: 'conversions' },
        { name: 'purchaseRevenue' },
        { name: 'ecommercePurchases' },
        { name: 'addToCarts' },
        { name: 'checkouts' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
      ],
    }) as GA4Report;

    const totalsRow = globalReport.rows?.[0];
    const globals = totalsRow ? {
      sessions:               metricVal(totalsRow, 0),
      users:                  metricVal(totalsRow, 1),
      pageviews:              metricVal(totalsRow, 2),
      conversions:            metricVal(totalsRow, 3),
      revenue:                metricVal(totalsRow, 4),
      purchases:              metricVal(totalsRow, 5),
      addToCarts:             metricVal(totalsRow, 6),
      checkouts:              metricVal(totalsRow, 7),
      bounceRate:             metricVal(totalsRow, 8),
      avgSessionDuration:     metricVal(totalsRow, 9),
    } : null;

    // ── Reporte 2: Sesiones por canal (últimos 30 días) ───────────────────────
    const sourcesReport = await runReport(token, propertyId, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'sessionDefaultChannelGrouping' }],
      metrics:    [{ name: 'sessions' }, { name: 'conversions' }],
      orderBys:   [{ metric: { metricName: 'sessions' }, desc: true }],
      limit:      8,
    }) as GA4Report;

    const sources = (sourcesReport.rows || []).map(r => ({
      channel:     r.dimensionValues?.[0]?.value ?? '(other)',
      sessions:    metricVal(r, 0),
      conversions: metricVal(r, 1),
    }));

    // ── Reporte 3: Sesiones diarias (últimos 14 días) ─────────────────────────
    const trendReport = await runReport(token, propertyId, {
      dateRanges: [{ startDate: '14daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'date' }],
      metrics:    [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'ecommercePurchases' }],
      orderBys:   [{ dimension: { dimensionName: 'date' } }],
    }) as GA4Report;

    const trend = (trendReport.rows || []).map(r => ({
      date:      r.dimensionValues?.[0]?.value ?? '',
      sessions:  metricVal(r, 0),
      users:     metricVal(r, 1),
      purchases: metricVal(r, 2),
    }));

    // ── Reporte 4: Top páginas ────────────────────────────────────────────────
    const pagesReport = await runReport(token, propertyId, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'pagePath' }],
      metrics:    [{ name: 'screenPageViews' }, { name: 'averageSessionDuration' }],
      orderBys:   [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit:      10,
    }) as GA4Report;

    const topPages = (pagesReport.rows || []).map(r => ({
      path:     r.dimensionValues?.[0]?.value ?? '/',
      views:    metricVal(r, 0),
      avgTime:  metricVal(r, 1),
    }));

    // ── Reporte 5: Dispositivos ───────────────────────────────────────────────
    const devicesReport = await runReport(token, propertyId, {
      dateRanges: [dateRange],
      dimensions: [{ name: 'deviceCategory' }],
      metrics:    [{ name: 'sessions' }],
    }) as GA4Report;

    const devices = (devicesReport.rows || []).map(r => ({
      device:   r.dimensionValues?.[0]?.value ?? 'desktop',
      sessions: metricVal(r, 0),
    }));

    const result = {
      period:   '30d',
      globals,
      sources,
      trend,
      topPages,
      devices,
      fetchedAt: new Date().toISOString(),
    };

    cache.set(cacheKey, { data: result, at: Date.now() });
    return NextResponse.json(result);

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[GA4 API]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
