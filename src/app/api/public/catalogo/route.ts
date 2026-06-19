import { NextRequest, NextResponse } from 'next/server';
import { ensureCrmSchema, getPool, hasDatabase } from '@/lib/postgres';
import { generateCatalogPdfBuffer } from '@/lib/catalog/catalog-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// CORS: el popup vive en arteconcreto.co (WordPress) y llama a este endpoint en
// otro origen. No se envían cookies (endpoint público), así que '*' es seguro.
const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * POST /api/public/catalogo — compuerta de lead pública (popup del sitio).
 * Captura nombre/empresa, teléfono, correo, ciudad → guarda el lead en la
 * bandeja de Leads Crudos (source "Catálogo Web") → devuelve el PDF del catálogo
 * personalizado. Público (está bajo /api/public/, exento de auth en middleware).
 *
 * El guardado del lead es best-effort: si la DB falla, igual entregamos el PDF
 * (no castigamos al prospecto por un problema interno).
 */
export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const company = String(body.company || '').trim();
    const email = String(body.email || '').trim();
    const phone = String(body.phone || '').trim();
    const city = String(body.city || '').trim();

    if (!name && !company) {
        return NextResponse.json({ error: 'Nombre o empresa requerido.' }, { status: 400, headers: CORS });
    }
    if (!email && !phone) {
        return NextResponse.json({ error: 'Correo o teléfono requerido.' }, { status: 400, headers: CORS });
    }

    const displayName = name || company;

    // 1) Guardar el lead en la bandeja (no bloqueante)
    if (hasDatabase()) {
        try {
            await ensureCrmSchema();
            const pool = getPool();
            const id = `raw-cat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
            await pool.query(
                `INSERT INTO crm_raw_leads (id, name, email, phone, city, country, reference, status, uploaded_by_name)
                 VALUES ($1,$2,$3,$4,$5,'Colombia',$6,'new','Catálogo Web')`,
                [
                    id,
                    displayName,
                    email || null,
                    phone || null,
                    city || null,
                    company && name ? `Descargó catálogo web · ${company}` : 'Descargó catálogo web',
                ],
            );
        } catch (error) {
            console.error('[public/catalogo] no se pudo guardar el lead:', error);
        }
    }

    // 2) Generar y devolver el PDF (personalizado con el nombre capturado)
    try {
        const pdf = await generateCatalogPdfBuffer({ name: displayName, company: company || undefined });
        const fecha = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
        return new NextResponse(Buffer.from(pdf), {
            status: 200,
            headers: {
                ...CORS,
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Catalogo-ArteConcreto-${fecha}.pdf"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        console.error('[public/catalogo] error generando PDF:', error);
        return NextResponse.json({ error: 'No se pudo generar el catálogo. Intentá de nuevo.' }, { status: 500, headers: CORS });
    }
}
