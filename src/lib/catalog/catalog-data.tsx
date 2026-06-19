/**
 * Builder del catálogo: orquesta datos en vivo → objeto `CatalogData` plano →
 * render del PDF. Concentra toda la complejidad (DB/WooCommerce, imágenes,
 * formateo de precios) para que el componente sea pura presentación.
 *
 * ⚠️ Acá vive la regla de precios: un producto con showPrice=false SIEMPRE sale
 * como "Precio a consultar" — nunca se formatea su número.
 */
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { fetchCatalogProducts, CATEGORY_ORDER, type CatalogProduct } from './wooCatalog';
import { loadImageDataUrl, mapLimit } from './catalog-image';
import { loadBrandLogo } from './logo';
import { CatalogDocument, type CatalogData, type CatalogCard, type CatalogSection } from './catalog-document';

const CARD_BG = '#fbfaf7'; // mismo color del contenedor de imagen en el PDF
const INK_BG = '#1a1a1d';  // fondo del banner de portada

// Banner principal de la portada.
const HERO_BANNER_URL = 'https://arteconcreto.co/wp-content/uploads/2026/03/4.Banner-caneca.jpg';

// WhatsApp comercial de ArteConcreto para "Cotizar por WhatsApp".
const WHATSAPP_NUMBER = '573178929477';
const waLinkFor = (productName: string) =>
    `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hola, me interesa cotizar el producto: ${productName}`)}`;

const CATEGORY_TAGLINES: Record<string, string> = {
    'Bancas': 'Bancas y asientos urbanos en concreto para espacio público y privado.',
    'Mesas': 'Mesas y mobiliario para exteriores.',
    'Macetas': 'Materas y jardineras en concreto arquitectónico.',
    'Bolardos': 'Bolardos para control y delimitación de tránsito.',
    'Cerramientos y Calados': 'Calados y cerramientos arquitectónicos en concreto.',
    'Canecas de Basura': 'Canecas y papeleras urbanas.',
    'Bicicleteros': 'Mobiliario para movilidad sostenible.',
    'Lavamanos': 'Lavamanos y piezas en concreto a la medida.',
    'Pisos': 'Pisos, adoquines y elementos de piso.',
    'Ónix': 'Línea premium en concreto.',
    'Amatista': 'Línea premium en concreto.',
    'Otros': 'Más mobiliario y complementos en concreto.',
};

const formatCOP = (n: number) => `$ ${Math.round(n).toLocaleString('es-CO')}`;

// Sustituye glifos que Helvetica (WinAnsi) no tiene, para no romper el render.
function safe(text: string): string {
    return (text || '')
        .replace(/≈/g, '~')
        .replace(/[→⇒]/g, '->')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/ /g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function truncate(text: string, max: number): string {
    const t = safe(text);
    return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

// Orden de secciones: las de CATEGORY_ORDER en su orden; el resto alfabético;
// "Otros" siempre al final.
function sectionRank(name: string): number {
    const i = CATEGORY_ORDER.indexOf(name);
    if (i >= 0) return i;
    if (name === 'Otros') return 9999;
    return 1000; // no listadas, antes de "Otros"
}

function buildCard(p: CatalogProduct, image: string | null): CatalogCard {
    const priceConsult = !p.showPrice;
    // Usamos la descripción más rica (a veces la "completa" trae más que la corta).
    const richDesc = (p.description && p.description.length > p.shortDescription.length)
        ? p.description : p.shortDescription;
    return {
        id: p.id,
        name: safe(p.name),
        permalink: p.permalink,
        eyebrow: 'ARTECONCRETO',
        description: truncate(richDesc, 210),
        dimensions: safe(p.dimensions),
        weight: p.weightKg ? `${p.weightKg.toLocaleString('es-CO', { maximumFractionDigits: 1 })} kg` : null,
        badge: !priceConsult && p.onSale ? 'En oferta' : null,
        priceConsult,
        priceBig: priceConsult ? null : formatCOP(p.onSale && p.salePrice ? p.salePrice : (p.price || p.regularPrice)),
        priceStruck: !priceConsult && p.onSale && p.salePrice ? formatCOP(p.regularPrice) : null,
        // Solo los "sin precio" llevan CTA de WhatsApp (con el nombre del producto).
        whatsappUrl: priceConsult ? waLinkFor(p.name) : null,
        image,
    };
}

export async function buildCatalogData(
    recipient?: { name?: string; company?: string } | null,
    generatedAtISO?: string,
): Promise<CatalogData> {
    const products = await fetchCatalogProducts();

    // Cargar imágenes de TODOS con concurrencia acotada (sharp → JPEG aplanado
    // al color de la tarjeta). Index-aligned con products.
    const images = await mapLimit(products, 10, (p) =>
        loadImageDataUrl(p.image, { maxPx: 420, quality: 74, bg: CARD_BG }),
    );

    // Agrupar por sección
    const bySection = new Map<string, CatalogProduct[]>();
    products.forEach((p) => {
        const arr = bySection.get(p.category) || [];
        arr.push(p);
        bySection.set(p.category, arr);
    });

    const imageById = new Map(products.map((p, i) => [p.id, images[i]]));

    const sections: CatalogSection[] = Array.from(bySection.entries())
        .sort((a, b) => sectionRank(a[0]) - sectionRank(b[0]) || a[0].localeCompare(b[0]))
        .map(([name, items]) => {
            // Dentro de la sección: con precio primero (precio asc), luego "a consultar" (nombre).
            const ordered = [...items].sort((a, b) => {
                if (a.showPrice !== b.showPrice) return a.showPrice ? -1 : 1;
                if (a.showPrice && b.showPrice) return (a.price || 0) - (b.price || 0);
                return a.name.localeCompare(b.name);
            });
            return {
                key: name,
                title: name,
                tagline: CATEGORY_TAGLINES[name] || '',
                count: items.length,
                cards: ordered.map((p) => buildCard(p, imageById.get(p.id) || null)),
            };
        });

    // Portada: banner principal de marca (más ancho, sobre fondo oscuro).
    const heroBanner = await loadImageDataUrl(HERO_BANNER_URL, { maxPx: 1400, quality: 82, bg: INK_BG });

    const logo = await loadBrandLogo();

    const generatedAt = new Date(generatedAtISO || Date.now()).toLocaleString('es-CO', {
        day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
        timeZone: 'America/Bogota',
    });

    return {
        generatedAt,
        totalProducts: products.length,
        logo,
        heroBanner,
        advisorWhatsapp: `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hola, quiero cotizar con un asesor de ArteConcreto.')}`,
        categories: sections.map((s) => s.title),
        sections,
        recipient: recipient || null,
    };
}

/** Genera el PDF del catálogo y devuelve el buffer listo para responder. */
export async function generateCatalogPdfBuffer(
    recipient?: { name?: string; company?: string } | null,
    generatedAtISO?: string,
): Promise<Uint8Array> {
    const data = await buildCatalogData(recipient, generatedAtISO);
    const buf = await renderToBuffer(<CatalogDocument data={data} />);
    return new Uint8Array(buf);
}
