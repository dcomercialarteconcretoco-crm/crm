import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase, getPool, ensureCrmSchema } from '@/lib/postgres';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!hasDatabase()) return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
    await ensureCrmSchema();
    const pool = getPool();
    const { rows } = await pool.query(`SELECT * FROM crm_biolinks WHERE id=$1 LIMIT 1`, [id]);
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!hasDatabase()) return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
    await ensureCrmSchema();
    const pool = getPool();
    const body = await req.json();

    const { rows } = await pool.query(`
        UPDATE crm_biolinks SET
          seller_id=$1, slug=COALESCE(NULLIF($2,''), slug), photo=$3, name=$4, title=$5,
          phone=$6, email=$7, instagram=$8, facebook=$9, linkedin=$10,
          whatsapp=$11, website=$12, youtube_url=$13, maps_url=$14, active=$15,
          updated_at=NOW()
        WHERE id=$16 RETURNING *
    `, [body.seller_id||null, body.slug?.trim()||'', body.photo||null, body.name||'', body.title||null,
        body.phone||null, body.email||null, body.instagram||null, body.facebook||null,
        body.linkedin||null, body.whatsapp||null, body.website||null,
        body.youtube_url||null, body.maps_url||null, body.active !== false, id]);

    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    if (!hasDatabase()) return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
    await ensureCrmSchema();
    const pool = getPool();
    await pool.query(`DELETE FROM crm_biolinks WHERE id=$1`, [id]);
    return NextResponse.json({ ok: true });
}
