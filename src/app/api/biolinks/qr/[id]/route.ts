import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase, getPool, ensureCrmSchema } from '@/lib/postgres';
import QRCode from 'qrcode';

export const runtime = 'nodejs';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-sand-three.vercel.app';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    let slug = id;

    // If a DB is configured, look up the actual slug
    if (hasDatabase()) {
        await ensureCrmSchema();
        const pool = getPool();
        const { rows } = await pool.query(`SELECT slug FROM crm_biolinks WHERE id=$1 LIMIT 1`, [id]);
        if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        slug = rows[0].slug;
    }

    const url = `${APP_URL}/b/${slug}`;

    const pngBuffer = await QRCode.toBuffer(url, {
        type: 'png',
        width: 600,
        margin: 2,
        color: { dark: '#111111', light: '#FFFFFF' },
    });

    return new NextResponse(new Uint8Array(pngBuffer), {
        status: 200,
        headers: {
            'Content-Type': 'image/png',
            'Content-Disposition': `attachment; filename="qr-${slug}.png"`,
            'Cache-Control': 'no-store',
        },
    });
}
