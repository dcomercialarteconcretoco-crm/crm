/* eslint-disable jsx-a11y/alt-text */
/**
 * Documento @react-pdf del catálogo ArteConcreto. SOLO presentación: recibe un
 * objeto `data` plano (textos, precios YA formateados respetando el flag, data
 * URLs de imágenes) del builder. No sabe de DB ni de WooCommerce.
 *
 * Diseño inspirado en el catálogo Voltaris: portada con banner + secciones con
 * header oscuro + grilla de tarjetas a 2 columnas (imagen | datos), apaisado.
 */
import React from 'react';
import { Document, Page, View, Text, Image, Link, StyleSheet } from '@react-pdf/renderer';

// ── Tipos del contrato builder → documento ───────────────────────────────────
export interface CatalogCard {
    id: number;
    name: string;
    permalink: string;
    eyebrow: string;          // marca / sku ("ARTECONCRETO")
    description: string;
    dimensions: string;       // "120 × 60 × 45 cm" o ''
    badge: string | null;     // "En oferta" | "A pedido" | null
    priceConsult: boolean;    // true ⇒ "Precio a consultar" (NO precio)
    priceBig: string | null;  // "$ 15.000" si priceConsult=false
    priceStruck: string | null; // precio tachado (oferta) o null
    image: string | null;     // data URL
}
export interface CatalogSection {
    key: string;
    title: string;
    tagline: string;
    count: number;
    cards: CatalogCard[];
}
export interface CatalogData {
    generatedAt: string;
    totalProducts: number;
    logo: string | null;
    heroImages: string[];     // data URLs para la banda de la portada
    categories: string[];     // chips de la portada
    sections: CatalogSection[];
    recipient?: { name?: string; company?: string } | null;
}

// ── Paleta de marca ──────────────────────────────────────────────────────────
const GOLD = '#fab510';
const INK = '#1a1a1d';
const PAPER = '#ffffff';
const CARD_BG = '#fbfaf7';
const MUTED = '#8a8a8a';
const LINE = '#ede8da';

const s = StyleSheet.create({
    page: { backgroundColor: PAPER, fontFamily: 'Helvetica', fontSize: 8.5, color: INK, paddingBottom: 46 },

    // ── Portada ──
    coverBanner: { backgroundColor: INK, paddingTop: 0 },
    coverGoldRule: { height: 5, backgroundColor: GOLD },
    coverLogoWrap: { position: 'absolute', top: 26, left: 36, backgroundColor: PAPER, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 16 },
    coverLogo: { width: 150, height: 56, objectFit: 'contain' },
    heroStrip: { flexDirection: 'row', height: 196, marginTop: 0 },
    heroCell: { flex: 1, borderLeftWidth: 2, borderLeftColor: INK },
    heroImg: { width: '100%', height: '100%', objectFit: 'cover' },
    coverBody: { paddingHorizontal: 40, paddingTop: 16 },
    eyebrow: { fontSize: 10, letterSpacing: 5, color: GOLD, fontFamily: 'Helvetica-Bold' },
    coverTitle: { fontSize: 30, fontFamily: 'Helvetica-Bold', color: INK, marginTop: 7, letterSpacing: -0.5 },
    coverSubtitle: { fontSize: 11.5, color: '#555', marginTop: 8, lineHeight: 1.45, maxWidth: 640 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 },
    chip: { borderWidth: 1, borderColor: GOLD, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 13, marginRight: 8, marginBottom: 8, fontSize: 9, color: '#333', fontFamily: 'Helvetica-Bold' },
    chipFilled: { backgroundColor: GOLD, borderColor: GOLD, color: INK },
    coverRule: { height: 1, backgroundColor: LINE, marginTop: 14, marginBottom: 10 },
    coverFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 40 },
    coverContact: { fontSize: 10, color: '#444', lineHeight: 1.6 },
    coverContactBold: { fontFamily: 'Helvetica-Bold', color: INK },
    coverGen: { textAlign: 'right' },
    coverGenLabel: { fontSize: 8, letterSpacing: 3, color: MUTED, fontFamily: 'Helvetica-Bold' },
    coverGenDate: { fontSize: 11, color: '#333', marginTop: 4, fontFamily: 'Helvetica-Bold' },
    disclaimer: { fontSize: 7.5, color: '#a9a9a9', marginTop: 10, paddingHorizontal: 40, lineHeight: 1.45 },

    // ── Header/footer corrido en páginas de contenido ──
    runHeader: { position: 'absolute', top: 18, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    runHeaderLogo: { width: 92, height: 26, objectFit: 'contain' },
    runHeaderRight: { fontSize: 7.5, color: MUTED },
    runHeaderRule: { position: 'absolute', top: 46, left: 36, right: 36, height: 2, backgroundColor: GOLD },
    runFooter: { position: 'absolute', bottom: 18, left: 36, right: 36, textAlign: 'center' },
    runFooterText: { fontSize: 7, color: '#b3b3b3', lineHeight: 1.5 },

    // ── Banda de sección ──
    sectionBand: { backgroundColor: INK, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18, marginBottom: 16, flexDirection: 'row' },
    sectionAccent: { width: 4, borderRadius: 2, backgroundColor: GOLD, marginRight: 14 },
    sectionCount: { fontSize: 8, letterSpacing: 3, color: GOLD, fontFamily: 'Helvetica-Bold' },
    sectionTitle: { fontSize: 17, color: PAPER, fontFamily: 'Helvetica-Bold', marginTop: 3 },
    sectionTagline: { fontSize: 8.5, color: '#9a9a9a', marginTop: 2 },

    // ── Grilla + tarjeta ──
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 36 },
    card: { width: '48.7%', flexDirection: 'row', borderWidth: 1, borderColor: LINE, borderLeftWidth: 4, borderLeftColor: GOLD, borderRadius: 10, backgroundColor: PAPER, padding: 9, marginBottom: 12 },
    cardImgWrap: { width: 96, height: 96, backgroundColor: CARD_BG, borderRadius: 8, borderWidth: 1, borderColor: LINE, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
    cardImg: { width: 86, height: 86, objectFit: 'contain' },
    cardImgPlaceholder: { fontSize: 7, color: '#c4c4c4' },
    cardBody: { flex: 1, position: 'relative' },
    cardEyebrow: { fontSize: 6.5, letterSpacing: 1.6, color: MUTED, fontFamily: 'Helvetica-Bold' },
    cardName: { fontSize: 10, color: INK, fontFamily: 'Helvetica-Bold', marginTop: 3, lineHeight: 1.2 },
    cardDesc: { fontSize: 7.5, color: '#888', marginTop: 4, lineHeight: 1.35 },
    chipsSpec: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 },
    specChip: { backgroundColor: '#f3f0e8', borderRadius: 4, paddingVertical: 2, paddingHorizontal: 6, marginRight: 5, marginTop: 3, fontSize: 7, color: '#5a5a5a', fontFamily: 'Helvetica-Bold' },
    badge: { position: 'absolute', top: 0, right: 0, borderRadius: 5, paddingVertical: 2, paddingHorizontal: 6, fontSize: 6.5, fontFamily: 'Helvetica-Bold' },
    badgeSale: { backgroundColor: '#e11d48', color: PAPER },
    badgeQuote: { backgroundColor: '#eef0f4', color: '#5a6473' },
    cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 },
    priceBig: { fontSize: 13, color: INK, fontFamily: 'Helvetica-Bold' },
    priceStruck: { fontSize: 8.5, color: '#b0b0b0', textDecoration: 'line-through', marginLeft: 5 },
    priceConsult: { fontSize: 10, color: '#6a7280', fontFamily: 'Helvetica-Bold' },
    webLink: { fontSize: 8, color: '#2563eb', fontFamily: 'Helvetica-Bold' },
});

const RunningHeader = ({ data }: { data: CatalogData }) => (
    <>
        <View style={s.runHeader} fixed>
            {data.logo ? <Image style={s.runHeaderLogo} src={data.logo} /> : <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: INK }}>ArteConcreto</Text>}
            <Text style={s.runHeaderRight}>Catálogo · {data.generatedAt} · NO es cotización</Text>
        </View>
        <View style={s.runHeaderRule} fixed />
    </>
);

const RunningFooter = () => (
    <View style={s.runFooter} fixed>
        <Text style={s.runFooterText}>
            Documento informativo — NO es una cotización. Precios y disponibilidad al momento de generar este PDF; pueden variar sin previo aviso.
        </Text>
        <Text style={s.runFooterText}>
            ArteConcreto S.A.S · Floridablanca, Santander · arteconcreto.co · WhatsApp +57 317 8929477
        </Text>
    </View>
);

const ProductCard = ({ c }: { c: CatalogCard }) => (
    <View style={s.card} wrap={false}>
        <View style={s.cardImgWrap}>
            {c.image ? <Image style={s.cardImg} src={c.image} /> : <Text style={s.cardImgPlaceholder}>Sin imagen</Text>}
        </View>
        <View style={s.cardBody}>
            {c.badge && (
                <Text style={[s.badge, c.badge === 'En oferta' ? s.badgeSale : s.badgeQuote]}>{c.badge}</Text>
            )}
            <Text style={s.cardEyebrow}>{c.eyebrow}</Text>
            {c.permalink
                ? <Link src={c.permalink} style={s.cardName}><Text>{c.name}</Text></Link>
                : <Text style={s.cardName}>{c.name}</Text>}
            {!!c.description && <Text style={s.cardDesc}>{c.description}</Text>}
            {!!c.dimensions && (
                <View style={s.chipsSpec}><Text style={s.specChip}>{c.dimensions}</Text></View>
            )}
            <View style={s.cardBottom}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                    {c.priceConsult
                        ? <Text style={s.priceConsult}>Precio a consultar</Text>
                        : <>
                            <Text style={s.priceBig}>{c.priceBig}</Text>
                            {c.priceStruck && <Text style={s.priceStruck}>{c.priceStruck}</Text>}
                          </>}
                </View>
                {c.permalink ? <Link src={c.permalink} style={s.webLink}><Text>Ver en la web ›</Text></Link> : null}
            </View>
        </View>
    </View>
);

const SectionBlock = ({ section, first }: { section: CatalogSection; first: boolean }) => (
    <View break={!first}>
        <View style={{ paddingHorizontal: 36, paddingTop: 56 }}>
            <View style={s.sectionBand}>
                <View style={s.sectionAccent} />
                <View>
                    <Text style={s.sectionCount}>{section.count} {section.count === 1 ? 'PRODUCTO' : 'PRODUCTOS'}</Text>
                    <Text style={s.sectionTitle}>{section.title}</Text>
                    {!!section.tagline && <Text style={s.sectionTagline}>{section.tagline}</Text>}
                </View>
            </View>
        </View>
        <View style={s.grid}>
            {section.cards.map((c) => <ProductCard key={c.id} c={c} />)}
        </View>
    </View>
);

export function CatalogDocument({ data }: { data: CatalogData }) {
    return (
        <Document title="Catálogo ArteConcreto" author="ArteConcreto S.A.S">
            {/* ── PORTADA ── */}
            <Page size="A4" orientation="landscape" style={s.page}>
                <View style={s.coverBanner}>
                    <View style={s.coverGoldRule} />
                    <View style={s.heroStrip}>
                        {data.heroImages.slice(0, 4).map((src, i) => (
                            <View key={i} style={s.heroCell}><Image style={s.heroImg} src={src} /></View>
                        ))}
                    </View>
                    <View style={s.coverLogoWrap}>
                        {data.logo ? <Image style={s.coverLogo} src={data.logo} /> : <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: INK }}>ArteConcreto</Text>}
                    </View>
                </View>
                <View style={s.coverBody}>
                    <Text style={s.eyebrow}>CATÁLOGO DE PRODUCTOS</Text>
                    <Text style={s.coverTitle}>Mobiliario urbano en concreto</Text>
                    <Text style={s.coverSubtitle}>
                        Diseñamos, producimos e instalamos piezas en concreto para proyectos arquitectónicos, espacio público y privado. {data.totalProducts} productos listos para tu proyecto.
                        {data.recipient?.name ? ` Preparado para ${data.recipient.name}${data.recipient.company ? ` · ${data.recipient.company}` : ''}.` : ''}
                    </Text>
                    <View style={s.chipsRow}>
                        {data.categories.slice(0, 8).map((cat, i) => (
                            <Text key={cat} style={[s.chip, i === 0 ? s.chipFilled : {}]}>{cat}</Text>
                        ))}
                    </View>
                    <View style={s.coverRule} />
                    <View style={s.coverFooter}>
                        <View>
                            <Text style={s.coverContact}>
                                <Text style={s.coverContactBold}>arteconcreto.co</Text>   ·   WhatsApp +57 317 8929477
                            </Text>
                            <Text style={s.coverContact}>ventas@arteconcreto.co · Floridablanca, Santander</Text>
                        </View>
                        <View style={s.coverGen}>
                            <Text style={s.coverGenLabel}>GENERADO</Text>
                            <Text style={s.coverGenDate}>{data.generatedAt}</Text>
                            <Text style={[s.coverContact, { color: MUTED, fontSize: 8 }]}>hora Colombia (UTC-5)</Text>
                        </View>
                    </View>
                </View>
                <Text style={s.disclaimer}>
                    {'Documento informativo — NO es una cotización. Precios, descuentos y disponibilidad corresponden al momento exacto de generación de este PDF y pueden variar sin previo aviso. Los productos marcados "Precio a consultar" se cotizan según especificaciones del proyecto.'}
                </Text>
            </Page>

            {/* ── SECCIONES ── */}
            <Page size="A4" orientation="landscape" style={s.page}>
                <RunningHeader data={data} />
                {data.sections.map((section, i) => (
                    <SectionBlock key={section.key} section={section} first={i === 0} />
                ))}
                <RunningFooter />
            </Page>
        </Document>
    );
}
