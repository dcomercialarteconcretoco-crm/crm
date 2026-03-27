import { notFound } from 'next/navigation';
import { hasDatabase, getPool, ensureCrmSchema } from '@/lib/postgres';
import BiolinkPublicCard from './BiolinkPublicCard';

interface Biolink {
    id: string; slug: string; name: string; title?: string; photo?: string;
    phone?: string; email?: string; instagram?: string; facebook?: string;
    linkedin?: string; whatsapp?: string; website?: string;
    youtube_url?: string; maps_url?: string; active: boolean;
}
interface Settings {
    form_fields: Record<string, boolean>; theme: string;
    primary_color: string; show_youtube: boolean; show_map: boolean;
}

async function getData(slug: string): Promise<{ card: Biolink; settings: Settings } | null> {
    if (!hasDatabase()) return null;
    try {
        await ensureCrmSchema();
        const pool = getPool();
        const [cardRes, settingsRes] = await Promise.all([
            pool.query(`SELECT * FROM crm_biolinks WHERE slug=$1 AND active=true LIMIT 1`, [slug]),
            pool.query(`SELECT * FROM crm_biolink_settings WHERE id='global' LIMIT 1`),
        ]);
        if (!cardRes.rows.length) return null;
        const settings: Settings = settingsRes.rows[0] || {
            form_fields: { name: true, email: true, phone: true, city: true },
            theme: 'dark', primary_color: '#fab510', show_youtube: false, show_map: false,
        };
        return { card: cardRes.rows[0], settings };
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
    return {
        title: `${data.card.name} — Arte Concreto`,
        description: data.card.title || 'Tarjeta digital profesional',
        openGraph: { images: data.card.photo ? [data.card.photo] : [] },
    };
}
