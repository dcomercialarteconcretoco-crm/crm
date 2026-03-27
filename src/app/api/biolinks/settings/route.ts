import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase, getPool, ensureCrmSchema } from '@/lib/postgres';

export async function GET() {
    if (!hasDatabase()) return NextResponse.json({
        id: 'global', form_fields: { name: true, email: true, phone: true, city: true },
        theme: 'dark', primary_color: '#fab510', show_youtube: false, show_map: false
    });
    await ensureCrmSchema();
    const pool = getPool();
    const { rows } = await pool.query(`SELECT * FROM crm_biolink_settings WHERE id='global' LIMIT 1`);
    return NextResponse.json(rows[0] || {
        id: 'global', form_fields: { name: true, email: true, phone: true, city: true },
        theme: 'dark', primary_color: '#fab510', show_youtube: false, show_map: false
    });
}

export async function PUT(req: NextRequest) {
    if (!hasDatabase()) return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
    await ensureCrmSchema();
    const pool = getPool();
    const body = await req.json();
    const { rows } = await pool.query(`
        INSERT INTO crm_biolink_settings (id, form_fields, theme, primary_color, show_youtube, show_map, updated_at)
        VALUES ('global', $1::jsonb, $2, $3, $4, $5, NOW())
        ON CONFLICT (id) DO UPDATE SET
          form_fields=$1::jsonb, theme=$2, primary_color=$3,
          show_youtube=$4, show_map=$5, updated_at=NOW()
        RETURNING *
    `, [JSON.stringify(body.form_fields || {}), body.theme || 'dark',
        body.primary_color || '#fab510', body.show_youtube || false, body.show_map || false]);
    return NextResponse.json(rows[0]);
}
