import { NextRequest, NextResponse } from 'next/server';
import { loadFreshSession } from '@/lib/auth-session';
import { generateCatalogPdfBuffer } from '@/lib/catalog/catalog-data';

// sharp + @react-pdf necesitan Node, NO edge.
export const runtime = 'nodejs';
// Nunca cachear: datos en vivo de WooCommerce.
export const dynamic = 'force-dynamic';
// Vercel Hobby: tope 60s. El render (lee Woo + ~217 imágenes con sharp) tarda
// ~5-25s frío vs caliente (force-cache de imágenes acelera los siguientes).
export const maxDuration = 60;

/**
 * GET /api/catalogo → descarga el catálogo PDF completo (productos en vivo de
 * WooCommerce). Gateado a usuarios logueados (es la descarga interna que usan
 * los vendedores desde Inventario). La versión pública con captura de lead vive
 * aparte (Fase 4).
 */
export async function GET(request: NextRequest) {
    const user = await loadFreshSession(request);
    if (!user) {
        return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    try {
        const pdf = await generateCatalogPdfBuffer();
        const fecha = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }); // YYYY-MM-DD
        // Buffer.from(Uint8Array) → BodyInit válido (evita el mismatch de genéricos
        // Uint8Array<ArrayBufferLike> que TS marca contra BodyInit).
        return new NextResponse(Buffer.from(pdf), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="Catalogo-ArteConcreto-${fecha}.pdf"`,
                'Cache-Control': 'private, no-store',
            },
        });
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Error generando el catálogo.';
        console.error('[catalogo] error:', error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
