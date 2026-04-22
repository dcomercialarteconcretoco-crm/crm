import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase, getPool, ensureCrmSchema } from '@/lib/postgres';

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
    await ensureCrmSchema();
    const pool = getPool();
    const { rows } = await pool.query(`SELECT * FROM crm_biolink_settings WHERE id='global' LIMIT 1`);
    return NextResponse.json({ ...DEFAULTS, ...(rows[0] || {}) });
}

export async function PUT(req: NextRequest) {
    if (!hasDatabase()) return NextResponse.json({ error: 'DB not configured' }, { status: 503 });
    await ensureCrmSchema();
    const pool = getPool();
    const body = await req.json();

    const merged = { ...DEFAULTS, ...body };
    const { rows } = await pool.query(
        `
        INSERT INTO crm_biolink_settings (
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
            form_fields=$1::jsonb,
            theme=$2,
            primary_color=$3,
            show_youtube=$4,
            show_map=$5,
            company_name=$6,
            company_tagline=$7,
            company_description=$8,
            company_logo=$9,
            instagram=$10,
            facebook=$11,
            linkedin=$12,
            tiktok=$13,
            whatsapp=$14,
            website=$15,
            youtube_url=$16,
            maps_url=$17,
            featured_products=$18::jsonb,
            catalog_title=$19,
            videos=$20::jsonb,
            updated_at=NOW()
        RETURNING *
    `,
        [
            JSON.stringify(merged.form_fields || {}),
            merged.theme,
            merged.primary_color,
            !!merged.show_youtube,
            !!merged.show_map,
            merged.company_name || '',
            merged.company_tagline || '',
            merged.company_description || '',
            merged.company_logo || '',
            merged.instagram || '',
            merged.facebook || '',
            merged.linkedin || '',
            merged.tiktok || '',
            merged.whatsapp || '',
            merged.website || '',
            merged.youtube_url || '',
            merged.maps_url || '',
            JSON.stringify(merged.featured_products || []),
            merged.catalog_title || '',
            JSON.stringify(Array.isArray(merged.videos) ? merged.videos : []),
        ]
    );
    return NextResponse.json(rows[0]);
}
