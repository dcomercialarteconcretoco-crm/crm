import { notFound } from 'next/navigation';
import { hasDatabase, getPool, ensureCrmSchema } from '@/lib/postgres';
import BiolinkPublicCard from './BiolinkPublicCard';

interface Biolink {
    id: string; slug: string; name: string; title?: string; photo?: string;
    phone?: string; email?: string;
    // Personal social overrides (optional — if empty, falls back to global)
    instagram?: string; facebook?: string;
    linkedin?: string; whatsapp?: string; website?: string;
    youtube_url?: string; maps_url?: string; active: boolean;
}

interface FeaturedProduct {
    id: string;
    name: string;
    image?: string;
    price?: string;
    url?: string;
}

interface VideoEntry {
    id: string;
    title: string;
    url: string;
}

interface Settings {
    form_fields: Record<string, boolean>;
    theme: string;
    primary_color: string;
    show_youtube: boolean;
    show_map: boolean;
    company_name?: string;
    company_tagline?: string;
    company_description?: string;
    company_logo?: string;
    instagram?: string;
    facebook?: string;
    linkedin?: string;
    tiktok?: string;
    whatsapp?: string;
    website?: string;
    youtube_url?: string;
    maps_url?: string;
    featured_products?: FeaturedProduct[];
    catalog_title?: string;
    videos?: VideoEntry[];
}

const DEFAULT_SETTINGS: Settings = {
    form_fields: { name: true, email: true, phone: true, city: true },
    theme: 'dark', primary_color: '#fab510',
    show_youtube: false, show_map: false,
    featured_products: [],
    videos: [],
};

async function getData(slug: string): Promise<{ card: Biolink; settings: Settings } | null> {
    if (!hasDatabase()) return null;
    try {
        await ensureCrmSchema();
        const pool = getPool();
        const [cardRes, settingsRes] = await Promise.all([
            pool.query(`
                SELECT
                  b.id, b.seller_id, b.slug,
                  COALESCE(NULLIF(b.photo, ''), u.avatar)  AS photo,
                  b.name,
                  COALESCE(NULLIF(b.title, ''), u.role)    AS title,
                  COALESCE(NULLIF(b.phone, ''), u.phone)   AS phone,
                  COALESCE(NULLIF(b.email, ''), u.email)   AS email,
                  b.instagram, b.facebook, b.linkedin, b.whatsapp, b.website,
                  b.youtube_url, b.maps_url, b.active,
                  b.created_at, b.updated_at
                FROM crm_biolinks b
                LEFT JOIN crm_users u
                  ON u.id = b.seller_id
                  OR (b.seller_id IS NULL AND LOWER(TRIM(u.name)) = LOWER(TRIM(b.name)))
                WHERE b.slug=$1 AND b.active=true LIMIT 1
            `, [slug]),
            pool.query(`SELECT * FROM crm_biolink_settings WHERE id='global' LIMIT 1`),
        ]);
        if (!cardRes.rows.length) return null;
        const raw = settingsRes.rows[0] || {};
        // Fallback: if the array column is empty but legacy youtube_url has a value, synthesize one entry
        let videos: VideoEntry[] = Array.isArray(raw.videos) ? raw.videos : [];
        if (videos.length === 0 && raw.youtube_url) {
            videos = [{ id: 'v-legacy', title: 'Video', url: raw.youtube_url }];
        }
        const settings: Settings = { ...DEFAULT_SETTINGS, ...raw, videos };

        // Merge: personal fields win if set; otherwise inherit from global
        const rawCard = cardRes.rows[0];
        const merged: Biolink = {
            ...rawCard,
            instagram: rawCard.instagram || settings.instagram || '',
            facebook: rawCard.facebook || settings.facebook || '',
            linkedin: rawCard.linkedin || settings.linkedin || '',
            whatsapp: rawCard.whatsapp || settings.whatsapp || '',
            website: rawCard.website || settings.website || '',
            youtube_url: rawCard.youtube_url || settings.youtube_url || '',
            maps_url: rawCard.maps_url || settings.maps_url || '',
        };
        return { card: merged, settings };
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
    const companyName = data.settings.company_name || 'Arte Concreto';
    return {
        title: `${data.card.name} — ${companyName}`,
        description: data.card.title || data.settings.company_tagline || 'Tarjeta digital profesional',
        openGraph: { images: data.card.photo ? [data.card.photo] : [] },
    };
}
