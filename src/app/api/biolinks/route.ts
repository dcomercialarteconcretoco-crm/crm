import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase, getPool, ensureCrmSchema } from '@/lib/postgres';

function slug(name: string, id: string) {
    return name.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        + '-' + id.slice(-4);
}

export async function GET() {
    if (!hasDatabase()) return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
    await ensureCrmSchema();
    const pool = getPool();
    const { rows } = await pool.query(`SELECT * FROM crm_biolinks ORDER BY created_at DESC`);
    return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
    if (!hasDatabase()) return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
    await ensureCrmSchema();
    const pool = getPool();
    const body = await req.json();
    const id = `bl-${Date.now()}`;
    const cardSlug = body.slug?.trim() || slug(body.name || 'tarjeta', id);

    const { rows } = await pool.query(`
        INSERT INTO crm_biolinks
          (id,seller_id,slug,photo,name,title,phone,email,instagram,facebook,linkedin,whatsapp,website,youtube_url,maps_url,active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        RETURNING *
    `, [id, body.seller_id||null, cardSlug, body.photo||null, body.name||'', body.title||null,
        body.phone||null, body.email||null, body.instagram||null, body.facebook||null,
        body.linkedin||null, body.whatsapp||null, body.website||null,
        body.youtube_url||null, body.maps_url||null, body.active !== false]);

    return NextResponse.json(rows[0], { status: 201 });
}
