import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    calculateQuoteTotals,
    transportItemDescription,
    type QuoteMode,
} from './quote-calculations';

export interface ReportData {
    title: string;
    stats: { label: string; value: string; change: string }[];
    topLeads: { name: string; company: string; score: number }[];
}

/**
 * ProposalData es el contrato del PDF. Recibe los datos crudos (no totales pre-
 * calculados) — el PDF llama internamente a `calculateQuoteTotals` para que el
 * formulario y el PDF muestren EXACTAMENTE el mismo desglose. Si esto se
 * duplicara cada uno fallaría en una arista de redondeo distinta y los
 * vendedores verían un total en pantalla y otro en el PDF que recibe el cliente.
 */
export interface ProposalData {
    quoteNumber: string;
    date: string;
    leadName: string;
    leadCompany?: string;
    leadEmail?: string;
    leadCity?: string;
    /**
     * Si true, el PDF NO muestra `leadName` (la persona de contacto), solo
     * empresa + ciudad. Útil cuando la cotización va dirigida a la
     * institución sin destinatario nominado. Default: false (muestra ambos).
     * Pedido del cliente 16-may-2026 sobre ART-369-2026 dirigida a
     * "NM ARQUITECTOS" donde no querían el nombre de Valery Castellanos.
     */
    hideContactName?: boolean;
    referencia?: string;
    validUntil?: string;     // string ya formateado (ej: "24 de Mayo de 2026")
    deliveryTime?: string;
    paymentTerms?: string;
    sellerName?: string;
    sellerPhone?: string;
    /** Modo de la cotización. Default 'simple' si no viene. */
    mode?: QuoteMode;
    items: Array<{
        name: string;
        unitPrice: number;       // precio Woo (CON IVA incluido)
        priceBeforeTax?: number; // precio digitado antes de IVA (personalizados)
        taxRate?: number;        // IVA aplicable por línea
        quantity: number;
        unit?: string;
        image?: string;
        dimensions?: string;
    }>;
    /** (modo simple) ¿La oferta cubre transporte? */
    includesTransport?: boolean;
    /** (modo simple) Monto del transporte; es la base antes de IVA y se usa tal cual. */
    transportAmount?: number;
    /** (modo simple) Ciudad destino para el texto de la fila de transporte. */
    transportCity?: string;
    /** (modo aiu) Porcentaje 0–100. */
    adminPercent?: number;
    /** (modo aiu) Porcentaje 0–100. */
    utilityPercent?: number;
    /** Texto que reemplaza el "se entrega en {ciudad cliente}" del Alcance. */
    deliveryLocation?: string;
    /** Texto libre editable por el vendedor — aparece como bloque destacado
     *  al final del PDF. Pedido del cliente: "una casilla opcional que
     *  podamos llenar manual donde podamos incluir observaciones". */
    observations?: string;
    /** Email del asesor — sale en el footer y como contacto en el cierre.
     *  Si no llega, usamos el email comercial por defecto. */
    sellerEmail?: string;

    // ── Campos LEGACY ──
    // Para que las cotizaciones viejas (las pocas pre-modelo-nuevo) sigan
    // renderizando con el formato antiguo, mantenemos estos campos. Si llegan,
    // el PDF usa la rama legacy (subtotal/tax/total + aiuData) en vez de la
    // rama nueva. Cotizaciones nuevas NO los pasan.
    isAIU?: boolean;
    aiuData?: {
        supply?: string;
        transport?: string;
        installation?: string;
        transportPrice?: number;
        unloadPrice?: number;
        installationPrice?: number;
        totalAIU?: number;
    };
    subtotal?: number;
    tax?: number;
    total?: number;
    shipping?: number;
    shippingCity?: string;
}

const PRIMARY = [250, 181, 16] as [number, number, number];
const DARK    = [20, 20, 23]   as [number, number, number];
const WHITE   = [255, 255, 255] as [number, number, number];
const GRAY    = [100, 100, 100] as [number, number, number];
const LIGHT   = [245, 245, 245] as [number, number, number];
const DARKGRAY = [60, 60, 65]  as [number, number, number];

const LM = 18; // left margin
const RM = 192; // right edge
const PW = 210; // page width

function fmt(n: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function addPageFooter(doc: jsPDF, page: number, total: number, email: string, sealImage?: { b64: string; fmt: 'JPEG' | 'PNG' }): void {
    const h = doc.internal.pageSize.getHeight();
    doc.setFillColor(...DARK);
    doc.rect(0, h - 16, PW, 16, 'F');
    doc.setFillColor(...PRIMARY);
    doc.rect(0, h - 17, PW, 1, 'F');
    // Sello Bureau Veritas a la izquierda del footer (10mm de alto)
    if (sealImage) {
        try {
            doc.addImage(sealImage.b64, sealImage.fmt, LM, h - 14, 11, 11, undefined, 'FAST');
        } catch { /* skip si el formato no es compatible */ }
    }
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(`ARTE CONCRETO S.A.S  ·  Km 1+800, Anillo Vial, Floridablanca, Santander  ·  ${email}`, PW / 2, h - 9, { align: 'center' });
    doc.setTextColor(120, 120, 120);
    doc.text(`Pág. ${page} / ${total}`, PW / 2, h - 4, { align: 'center' });
}

async function loadSealImage(): Promise<{ b64: string; fmt: 'JPEG' | 'PNG' } | undefined> {
    // El sello de Bureau Veritas vive en public/bureau-veritas.png. Si el
    // archivo no existe (deploy reciente sin upload), no rompemos — la
    // función retorna undefined y el footer sólo muestra el texto.
    try {
        const r = await fetch('/bureau-veritas.png');
        if (!r.ok) return undefined;
        const bl = await r.blob();
        if (!/^image\/(png|jpeg|jpg)/i.test(bl.type)) return undefined;
        const b64 = await new Promise<string>((res, rej) => {
            const rd = new FileReader();
            rd.onload = () => res(rd.result as string);
            rd.onerror = rej;
            rd.readAsDataURL(bl);
        });
        const fmt: 'JPEG' | 'PNG' = b64.includes('data:image/jpeg') || b64.includes('data:image/jpg') ? 'JPEG' : 'PNG';
        return { b64, fmt };
    } catch { return undefined; }
}

async function normalizeImageForPdf(src: string, blobType?: string): Promise<{ b64: string; fmt: 'JPEG' | 'PNG' } | undefined> {
    if (!src.startsWith('data:image/')) return undefined;
    if (/^data:image\/jpe?g/i.test(src) || /^image\/jpe?g/i.test(blobType || '')) return { b64: src, fmt: 'JPEG' };
    if (/^data:image\/png/i.test(src) || /^image\/png/i.test(blobType || '')) return { b64: src, fmt: 'PNG' };

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            try {
                const maxSide = 1400;
                const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
                canvas.height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(undefined);
                    return;
                }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve({ b64: canvas.toDataURL('image/png'), fmt: 'PNG' });
            } catch {
                resolve(undefined);
            }
        };
        img.onerror = () => resolve(undefined);
        img.src = src;
    });
}

function addAllFooters(doc: jsPDF, email: string, seal?: { b64: string; fmt: 'JPEG' | 'PNG' }): void {
    const pages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        addPageFooter(doc, i, pages, email, seal);
    }
}

// Header compacto para páginas 2+. Pedido del cliente: "El logo debe aparecer
// en todas las páginas". La página 1 ya tiene el header completo; las demás
// llevan solo el logo y el número de cotización chico.
function addAllCompactHeaders(doc: jsPDF, logoB64: string | null, logoFmt: 'JPEG' | 'PNG' | null, quoteNumber: string): void {
    const pages = (doc as any).internal.getNumberOfPages();
    for (let i = 2; i <= pages; i++) {
        doc.setPage(i);
        const LOGO_W = 28, LOGO_H = Math.round(28 / (237 / 96));
        if (logoB64 && logoFmt) {
            try { doc.addImage(logoB64, logoFmt, LM, 6, LOGO_W, LOGO_H, undefined, 'FAST'); } catch { /* skip */ }
        }
        doc.setTextColor(...DARK);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(quoteNumber, RM, 12, { align: 'right' });
        doc.setDrawColor(...PRIMARY);
        doc.setLineWidth(0.4);
        doc.line(LM, 18, RM, 18);
        doc.setLineWidth(0.2);
    }
}

async function fetchLogoBase64(): Promise<{ b64: string; fmt: 'JPEG' | 'PNG' } | null> {
    try {
        const res = await fetch('/api/logo');
        if (!res.ok) return null;
        const blob = await res.blob();
        const b64 = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = reject;
            r.readAsDataURL(blob);
        });
        const fmt: 'JPEG' | 'PNG' = b64.startsWith('data:image/jpeg') || b64.startsWith('data:image/jpg') ? 'JPEG' : 'PNG';
        return { b64, fmt };
    } catch { return null; }
}

// ── Formatted date: "Floridablanca, 15 de marzo de 2026" ──────────────────────
function fmtDate(dateStr: string): string {
    try {
        const d = new Date(dateStr.includes('/') ? dateStr.split('/').reverse().join('-') : dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

export const generatePDFReport = (data: ReportData): void => {
    try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    doc.setFillColor(...DARK);
    doc.rect(0, 0, PW, 42, 'F');
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 38, PW, 4, 'F');

    doc.setTextColor(...WHITE);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('ARTE CONCRETO', LM, 22);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 180, 180);
    doc.text('CRM Intelligence · Reporte ejecutivo', LM, 30);

    doc.setTextColor(...PRIMARY);
    doc.setFontSize(8);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-CO')}`, 160, 22);

    doc.setTextColor(...DARK);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(data.title.toUpperCase(), LM, 62);

    doc.setFillColor(...PRIMARY);
    doc.rect(LM, 66, 50, 1.5, 'F');

    doc.setFontSize(11);
    doc.setTextColor(...DARK);
    doc.text('MÉTRICAS CLAVE', LM, 80);

    autoTable(doc, {
        startY: 85,
        head: [['Indicador', 'Valor Actual', 'Tendencia']],
        body: data.stats.map(s => [s.label, s.value, s.change]),
        theme: 'grid',
        headStyles: { fillColor: DARK, textColor: WHITE, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        alternateRowStyles: { fillColor: LIGHT },
        margin: { left: LM, right: 18 },
    });

    const y1 = ((doc as any).lastAutoTable?.finalY ?? 90) + 18;
    doc.setFontSize(11);
    doc.setTextColor(...DARK);
    doc.text('LEADS DE ALTO VALOR', LM, y1);

    autoTable(doc, {
        startY: y1 + 5,
        head: [['Nombre del Lead', 'Empresa', 'Lead Score']],
        body: data.topLeads.map(l => [l.name, l.company, `${l.score}%`]),
        theme: 'striped',
        headStyles: { fillColor: PRIMARY, textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: LM, right: 18 },
    });

    addAllFooters(doc, 'dcomercial@arteconcreto.co');
    doc.save(`Reporte_ArteConcreto_${Date.now()}.pdf`);
    } catch (err) {
        console.error('generatePDFReport error:', err);
        alert('Error al generar el reporte PDF. Intenta de nuevo.');
    }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROPUESTA COMERCIAL — Formato oficial Arte Concreto
//
// Render unificado: el documento se construye una sola vez y dentro de él
// dos ramas (`renderSimpleTotals` / `renderAiuTotals`) deciden cómo se ve el
// bloque de precios y cómo se redacta el alcance. El header, los datos del
// destinatario, la referencia, la galería de imágenes, vigencia, plazo,
// forma de pago y el cierre son COMUNES — no se duplican. Eso evita el
// drift que tendríamos si hiciéramos dos PDFs separados.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export const generateProposalPDF = async (data: ProposalData): Promise<void> => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const name    = data.leadName    || 'Cliente';
    const company = data.leadCompany || '';
    const seller  = data.sellerName  || 'ArteConcreto';
    const sellerPhone = data.sellerPhone || '';
    const referencia  = data.referencia  || 'SUMINISTRO DE MOBILIARIO EN CONCRETO ARQUITECTÓNICO PREFABRICADO';
    const validUntil  = data.validUntil  || '30 días calendario';
    const deliveryTime = data.deliveryTime || 'A convenir con el cliente.';
    const paymentTerms = data.paymentTerms ||
        '- Anticipo del 50% del total de la orden.\n- El saldo deberá cancelarse en su totalidad antes de la entrega de los productos. El producto que no sea cancelado en su totalidad, no podrá ser entregado.';

    // ── Detectar si es cotización LEGACY ──
    // Dos señales nos llevan al render legacy:
    //   1) Llega `aiuData.totalAIU` — es una AIU del modelo viejo (transporte+descargue+
    //      instalación con montos hardcoded). El modelo nuevo usa porcentajes; los montos
    //      pre-calculados no se pueden reconstruir desde adminPercent/utilityPercent.
    //   2) No viene `mode` Y vienen subtotal/total — cotización simple del modelo viejo.
    // Si la migración back-fill el campo `mode` en cotizaciones AIU viejas, la señal (1)
    // sigue redirigiendo correctamente al render legacy y los totales no se descuajaran.
    const hasLegacyAiuData = !!(data.aiuData && (data.aiuData.totalAIU || data.aiuData.transportPrice || data.aiuData.installationPrice));
    const isLegacy = hasLegacyAiuData || (data.mode === undefined && (data.subtotal !== undefined || data.total !== undefined));

    // Si es nuevo, calculamos todo desde la fuente única.
    const calc = isLegacy ? null : calculateQuoteTotals({
        mode: data.mode || 'simple',
        items: data.items.map(i => ({ unitPrice: i.unitPrice, priceBeforeTax: i.priceBeforeTax, taxRate: i.taxRate, quantity: i.quantity })),
        includesTransport: data.includesTransport,
        transportAmount: data.transportAmount,
        adminPercent: data.adminPercent,
        utilityPercent: data.utilityPercent,
    });

    const mode: QuoteMode = (data.mode ?? (data.isAIU ? 'aiu' : 'simple'));

    // Email del footer y contacto: si el vendedor tiene email registrado lo
    // usamos; si no, cae al comercial. Pedido 7-may-2026: el email cotizaciones@
    // estaba mal — el correcto es dcomercial@.
    const contactEmail = (data.sellerEmail && data.sellerEmail.trim()) || 'dcomercial@arteconcreto.co';

    // Cargamos logo y sello UNA vez para reusar en todas las páginas
    // (pedido del cliente: "El logo debe aparecer en todas las páginas",
    // "Falta el sello de certificado de BUREAU VERITAS pequeño abajo
    // de todas las hojas").
    const logoImg = await fetchLogoBase64();
    const sealImg = await loadSealImage();

    // ── HEADER (página 1, completo) ──────────────────────────────────────────
    doc.setFillColor(...DARK);
    doc.rect(0, 0, PW, 44, 'F');
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 40, PW, 4, 'F');

    // Logo Arte Concreto (237×96 px → 2.47:1)
    const LOGO_W = 46, LOGO_H = Math.round(46 / (237 / 96)); // ≈ 19 mm
    if (logoImg) {
        doc.setFillColor(...WHITE);
        doc.roundedRect(LM - 2, 9, LOGO_W + 4, LOGO_H + 4, 3, 3, 'F');
        try { doc.addImage(logoImg.b64, logoImg.fmt, LM, 11, LOGO_W, LOGO_H, undefined, 'FAST'); } catch { /* skip */ }
    } else {
        doc.setTextColor(...WHITE);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('ARTE', LM, 18);
        doc.setTextColor(...PRIMARY);
        doc.text('CONCRETO', LM + doc.getTextWidth('ARTE '), 18);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 180, 180);
        doc.text('S.A.S', LM, 24);
    }

    doc.setTextColor(180, 180, 180);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('NIT: 901.234.567-8', RM, 10, { align: 'right' });
    doc.text('Km 1+800, Anillo Vial, Floridablanca, Santander', RM, 16, { align: 'right' });
    doc.text(contactEmail, RM, 22, { align: 'right' });
    doc.text('www.arteconcreto.co', RM, 28, { align: 'right' });

    // Quote number badge
    doc.setTextColor(...PRIMARY);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const quoteNumWidth = doc.getTextWidth(data.quoteNumber);
    doc.text(data.quoteNumber, RM, 36, { align: 'right' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 160, 160);
    doc.text('Cotización No.', RM - quoteNumWidth - 2, 36, { align: 'right' });

    // ── LOCATION + DATE ───────────────────────────────────────────────────────
    let y = 56;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARKGRAY);
    const dateLabel = `Floridablanca, ${fmtDate(data.date)}`;
    doc.text(dateLabel, LM, y);
    doc.setFont('helvetica', 'bold');
    doc.text(data.quoteNumber, RM, y, { align: 'right' });

    // ── ADDRESSEE ─────────────────────────────────────────────────────────────
    // Orden pedido por el cliente 7-may-2026: EMPRESA primero (línea grande),
    // luego la persona en bold más chico (en algunos casos no va persona — la
    // cotización es a la institución directamente), luego la ciudad debajo.
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...DARKGRAY);
    doc.text('Señores.', LM, y);

    if (company) {
        y += 7;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...DARK);
        doc.text(company.toUpperCase(), LM, y);

        // El nombre de la persona se muestra solo si:
        //  1. El vendedor NO activó `hideContactName` (opción explícita en el form), Y
        //  2. La persona es distinta del nombre de la empresa (evita "NM ARQUITECTOS\nNM ARQUITECTOS")
        if (!data.hideContactName && name && name.toLowerCase().trim() !== company.toLowerCase().trim()) {
            y += 6;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(name.toUpperCase(), LM, y);
        }
    } else if (!data.hideContactName) {
        // Sin empresa Y sin hideContactName: la persona pasa a ser el destinatario
        // principal. Si hideContactName=true Y no hay empresa, el bloque queda en
        // blanco — caso raro que el vendedor maneja explícitamente.
        y += 7;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...DARK);
        doc.text(name.toUpperCase(), LM, y);
    }

    // Ciudad (si el cliente la tiene) — debajo del destinatario.
    if (data.leadCity && data.leadCity.trim()) {
        y += 6;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...DARK);
        doc.text(data.leadCity.toUpperCase(), LM, y);
    }

    // ── REFERENCIA ────────────────────────────────────────────────────────────
    y += 10;
    doc.setFillColor(...PRIMARY);
    doc.rect(LM, y - 4, 174, 0.5, 'F');
    y += 4;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    const refLabel = 'REFERENCIA: ';
    doc.text(refLabel, LM, y);

    doc.setFont('helvetica', 'bold');
    const refWidth = 174 - doc.getTextWidth(refLabel);
    const refLines = doc.splitTextToSize(referencia.toUpperCase(), refWidth);
    doc.text(refLines, LM + doc.getTextWidth(refLabel), y);
    y += (refLines.length - 1) * 5;

    y += 4;
    doc.setFillColor(230, 230, 230);
    doc.rect(LM, y, 174, 0.3, 'F');

    // ── ORDEN DEL PDF (pedido del cliente 7-may-2026) ────────────────────────
    // Antes: tabla de productos PRIMERO, luego condiciones (alcance, vigencia,
    // pago). El cliente reportó que muchos clientes finales saltaban al
    // total y no leían los términos. Nuevo orden: condiciones PRIMERO,
    // tabla de productos al final como "Anexo 1" en página propia.
    let fy = y + 4;
    const pageH = doc.internal.pageSize.getHeight();
    const ensureSpace = (need: number) => {
        if (fy + need > pageH - 20) { doc.addPage(); fy = 25; }
    };

    // ── Sección 1: ALCANCE ───────────────────────────────────────────────────
    ensureSpace(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text('1. ALCANCE DE LA PROPUESTA:', LM, fy);
    fy += 6;

    const lugarEntrega = (data.deliveryLocation && data.deliveryLocation.trim())
        ? data.deliveryLocation.trim()
        : (data.leadCity && data.leadCity.trim() ? `la ciudad de ${data.leadCity.trim()}` : 'el sitio acordado con el cliente');

    let alcanceText: string;
    if (mode === 'aiu') {
        alcanceText = `La presente oferta de los elementos en concreto se entrega en ${lugarEntrega}, basado en la solicitud del cliente.`;
    } else {
        alcanceText = data.deliveryLocation && data.deliveryLocation.trim()
            ? `La presente oferta de los elementos en concreto se entrega en ${lugarEntrega}, basado en la solicitud del cliente.`
            : 'La presente oferta de los elementos en concreto se entrega en la planta de producción, Anillo Vial Km 1 + 800 Floridablanca – Girón, basado en la solicitud del cliente.';
    }
    // Texto principal del alcance en negrita (pedido del cliente 7-may-2026:
    // "el texto antes de las condiciones que vaya también en negrilla"). Los
    // bullets Sí/No incluye debajo siguen en normal con el verbo en bold.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARK);
    const alcanceLines = doc.splitTextToSize(alcanceText, 174);
    doc.text(alcanceLines, LM, fy);
    fy += alcanceLines.length * 4.5 + 3;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARKGRAY);

    const includeRows: Array<{ verb: 'Sí incluye' | 'No incluye'; rest: string }> = (() => {
        if (mode === 'aiu') {
            return [
                { verb: 'Sí incluye', rest: ' el transporte de los elementos al sitio de entrega.' },
                { verb: 'Sí incluye', rest: ' el descargue del producto en concreto.' },
                { verb: 'Sí incluye', rest: ' la instalación de las piezas cotizadas.' },
            ];
        }
        return [
            { verb: data.includesTransport ? 'Sí incluye' : 'No incluye', rest: ' el transporte de los elementos al sitio de entrega.' },
            { verb: 'No incluye', rest: ' el descargue del producto en concreto.' },
            { verb: 'No incluye', rest: ' la instalación de las piezas cotizadas.' },
        ];
    })();

    for (const { verb, rest } of includeRows) {
        ensureSpace(10);
        doc.setFont('helvetica', 'normal');
        doc.text('La oferta ', LM + 3, fy);
        const x1 = LM + 3 + doc.getTextWidth('La oferta ');
        doc.setFont('helvetica', 'bold');
        doc.text(verb, x1, fy);
        const x2 = x1 + doc.getTextWidth(verb);
        doc.setFont('helvetica', 'normal');
        const restLines = doc.splitTextToSize(rest, 174 - (x2 - LM));
        doc.text(restLines[0] || '', x2, fy);
        if (restLines.length > 1) {
            fy += 4.5;
            doc.text(restLines.slice(1), LM + 3, fy);
        }
        fy += 5;
    }

    // ── Sección 2: VIGENCIA ──────────────────────────────────────────────────
    fy += 3;
    ensureSpace(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text('2. VIGENCIA DE LA OFERTA:', LM, fy);
    fy += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARKGRAY);
    doc.text(`La cotización tiene vigencia hasta el ${validUntil}.`, LM, fy);

    // ── Sección 3: PLAZO DE ENTREGA ──────────────────────────────────────────
    fy += 10;
    ensureSpace(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text('3. PLAZO DE ENTREGA:', LM, fy);
    fy += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARKGRAY);
    const deliveryLines = doc.splitTextToSize(deliveryTime, 174);
    doc.text(deliveryLines, LM, fy);
    fy += deliveryLines.length * 4.5;

    // ── Sección 4: FORMA DE PAGO ─────────────────────────────────────────────
    fy += 6;
    ensureSpace(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text('4. FORMA DE PAGO:', LM, fy);
    fy += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARKGRAY);
    doc.text('La forma de pago pactada es de la siguiente manera:', LM, fy);
    fy += 5.5;
    for (const line of paymentTerms.split('\n')) {
        if (!line.trim()) continue;
        const wrapped = doc.splitTextToSize(line.trim(), 174);
        ensureSpace(wrapped.length * 4.5 + 2);
        doc.text(wrapped, LM, fy);
        fy += wrapped.length * 4.5 + 1;
    }

    // ── Sección 5: CANTIDADES Y PRECIOS — referencia al anexo ────────────────
    fy += 6;
    ensureSpace(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text('5. CANTIDADES Y PRECIOS DEL PROYECTO:', LM, fy);
    fy += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARKGRAY);
    doc.text('Se adjunta ', LM, fy);
    doc.setFont('helvetica', 'bold');
    doc.text('Anexo 1', LM + doc.getTextWidth('Se adjunta '), fy);
    doc.setFont('helvetica', 'normal');
    doc.text(' con el detalle de productos, dimensiones y valores.', LM + doc.getTextWidth('Se adjunta Anexo 1'), fy);

    // ── ANEXO 1: TABLA DE PRODUCTOS (página propia) ──────────────────────────
    doc.addPage();
    let ay = 25;

    // Banner del anexo
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...DARK);
    doc.text('ANEXO 1 — CUADRO DE PRECIOS Y CANTIDADES', LM, ay);
    doc.setFillColor(...PRIMARY);
    doc.rect(LM, ay + 2, 80, 1, 'F');
    ay += 10;

    // Pre-cargamos las imágenes a base64 ahora (fuera de autoTable) porque
    // el callback didDrawCell es síncrono y no admite awaits.
    //
    // Las URLs http(s) van por /api/img-proxy para esquivar CORS: el server
    // de WooCommerce no incluye Access-Control-Allow-Origin para el CRM,
    // así que un fetch directo desde el browser lo bloquea silenciosamente y
    // la columna IMAGEN queda vacía (caso reportado 7-may-2026).
    const itemImages: Record<number, { b64: string; fmt: 'JPEG' | 'PNG' }> = {};
    for (let i = 0; i < data.items.length; i++) {
        const src = data.items[i].image;
        if (!src) continue;
        try {
            let b64 = src;
            let blobType = '';
            if (src.startsWith('http')) {
                const proxied = `/api/img-proxy?url=${encodeURIComponent(src)}`;
                const r = await fetch(proxied);
                if (!r.ok) {
                    console.warn('[pdf] image proxy failed for', src, r.status);
                    continue;
                }
                const bl = await r.blob();
                blobType = bl.type;
                b64 = await new Promise<string>((res, rej) => {
                    const rd = new FileReader();
                    rd.onload = () => res(rd.result as string);
                    rd.onerror = rej;
                    rd.readAsDataURL(bl);
                });
            } else if (!src.startsWith('data:')) {
                continue;
            }
            const normalized = await normalizeImageForPdf(b64, blobType);
            if (normalized) itemImages[i] = normalized;
        } catch (err) {
            console.warn('[pdf] failed to load image for item', i, err);
        }
    }

    // Hook común para dibujar la imagen del producto en la columna 1 de la tabla.
    // jspdf-autotable invoca didDrawCell para CADA celda; sólo nos interesa
    // la columna 0 (imagen) del body. La altura de fila se controla con
    // minCellHeight en bodyStyles para reservar espacio.
    const drawImageCell = (data: any) => {
        if (data.section !== 'body' || data.column.index !== 0) return;
        const rowIdx = data.row.index;
        const img = itemImages[rowIdx];
        if (!img) return;
        const cell = data.cell;
        const size = Math.min(cell.height - 4, cell.width - 4, 26);
        const cx = cell.x + (cell.width - size) / 2;
        const cy = cell.y + (cell.height - size) / 2;
        try {
            doc.addImage(img.b64, img.fmt, cx, cy, size, size, undefined, 'FAST');
        } catch { /* skip si el formato no es soportado */ }
    };

    if (isLegacy) {
        // ── RAMA LEGACY (cotizaciones pre-modelo-nuevo) ────────────────────
        // Reproduce la tabla original con subtotal/IVA/envío y la sección AIU
        // antigua tal como existía. Este código sólo lo ejecutan cotizaciones
        // viejas; nuevas siempre van por la rama de calc.
        autoTable(doc, {
            startY: ay,
            head: [['Imagen', 'Descripción', 'UM', 'Cantidad', 'Valor Unitario', 'Valor Total']],
            body: data.items.map(item => {
                const lineTotal = item.unitPrice * item.quantity;
                const desc = [item.name, item.dimensions ? '\n' + item.dimensions : ''].join('');
                return [
                    '', // imagen via didDrawCell
                    desc,
                    item.unit || 'Und',
                    String(item.quantity),
                    fmt(item.unitPrice),
                    fmt(lineTotal),
                ];
            }),
            theme: 'grid',
            headStyles: { fillColor: DARK, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5, cellPadding: 3.5, halign: 'center' },
            bodyStyles: { fontSize: 7.5, cellPadding: 2.5, textColor: DARKGRAY, minCellHeight: 30, valign: 'middle' },
            alternateRowStyles: { fillColor: [250, 248, 244] as [number,number,number] },
            columnStyles: {
                0: { cellWidth: 30 },
                1: { cellWidth: 56 },
                2: { cellWidth: 14, halign: 'center' },
                3: { cellWidth: 16, halign: 'center' },
                4: { cellWidth: 28, halign: 'right' },
                5: { cellWidth: 30, halign: 'right' },
            },
            margin: { left: LM, right: 18 },
            didDrawCell: drawImageCell,
            foot: [
                ['', '', '', '', 'Subtotal:', fmt(data.subtotal || 0)],
                ['', '', '', '', 'IVA (19%):', fmt(data.tax || 0)],
                ...(data.shipping && data.shipping > 0
                    ? [['', '', '', '', `Envío${data.shippingCity ? ` (${data.shippingCity})` : ''}:`, fmt(data.shipping)] as string[]]
                    : []),
            ],
            footStyles: { fillColor: [245, 245, 245] as [number,number,number], textColor: DARKGRAY, fontStyle: 'bold', fontSize: 7.5, halign: 'right' },
        });
        fy = ((doc as any).lastAutoTable?.finalY ?? ay + 40) + 2;

        if (data.isAIU && data.aiuData) {
            fy += 8;
            if (fy + 50 > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); fy = 25; }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(...DARK);
            doc.text('SUMINISTRO, TRANSPORTE E INSTALACIÓN (AIU):', LM, fy);
            fy += 6;
            const aiuRows: [string, string][] = [];
            if (data.aiuData.transportPrice)    aiuRows.push(['Valor transporte', fmt(data.aiuData.transportPrice)]);
            if (data.aiuData.unloadPrice)       aiuRows.push(['Valor descarga', fmt(data.aiuData.unloadPrice)]);
            if (data.aiuData.installationPrice) aiuRows.push(['Valor instalación', fmt(data.aiuData.installationPrice)]);
            autoTable(doc, {
                startY: fy,
                head: [['Concepto AIU', 'Valor']],
                body: aiuRows,
                theme: 'grid',
                headStyles: { fillColor: PRIMARY, textColor: [0,0,0] as [number,number,number], fontStyle: 'bold', fontSize: 8 },
                bodyStyles: { fontSize: 8, textColor: DARKGRAY },
                columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' }, 1: { cellWidth: 114 } },
                margin: { left: LM, right: 18 },
            });
            fy = ((doc as any).lastAutoTable?.finalY ?? fy + 30) + 4;
        }

        doc.setFillColor(...PRIMARY);
        doc.roundedRect(LM + 118, fy, 56, 10, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text('TOTAL:', LM + 121, fy + 6.5);
        doc.text(fmt(data.total || 0), RM, fy + 6.5, { align: 'right' });
        fy += 18;
    } else if (mode === 'simple') {
        // ── MODO SIMPLE (modelo nuevo) ──
        // Tabla con valor unitario ANTES de IVA + valor total ANTES de IVA. Si
        // hay transporte se inserta como una fila extra autogenerada.
        const c = calc!;
        const bodyRows = data.items.map((item, idx) => {
            const desc = [item.name, item.dimensions ? '\n' + item.dimensions : ''].join('');
            return [
                '', // imagen via didDrawCell
                desc,
                item.unit || 'Und',
                String(item.quantity),
                fmt(c.items[idx].unitPriceBeforeTax),
                fmt(c.items[idx].lineTotalBeforeTax),
            ];
        });
        if (c.transportBeforeTax !== undefined) {
            bodyRows.push([
                '',
                transportItemDescription(data.transportCity || data.leadCity || ''),
                'Und',
                '1',
                fmt(c.transportBeforeTax),
                fmt(c.transportBeforeTax),
            ]);
        }
        autoTable(doc, {
            startY: ay,
            head: [['Imagen', 'Descripción', 'UM', 'Cantidad', 'V. Unit. antes IVA', 'V. Total antes IVA']],
            body: bodyRows,
            theme: 'grid',
            headStyles: { fillColor: DARK, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5, cellPadding: 3.5, halign: 'center' },
            bodyStyles: { fontSize: 7.5, cellPadding: 2.5, textColor: DARKGRAY, minCellHeight: 30, valign: 'middle' },
            alternateRowStyles: { fillColor: [250, 248, 244] as [number,number,number] },
            columnStyles: {
                0: { cellWidth: 30 },
                1: { cellWidth: 56 },
                2: { cellWidth: 14, halign: 'center' },
                3: { cellWidth: 16, halign: 'center' },
                4: { cellWidth: 28, halign: 'right' },
                5: { cellWidth: 30, halign: 'right' },
            },
            margin: { left: LM, right: 18 },
            didDrawCell: drawImageCell,
            foot: [
                ['', '', '', '', 'Valor total antes de IVA:', fmt(c.subtotalLine1)],
                ['', '', '', '', 'IVA:', fmt(c.taxAmount)],
            ],
            footStyles: { fillColor: [245, 245, 245] as [number,number,number], textColor: DARKGRAY, fontStyle: 'bold', fontSize: 7.5, halign: 'right' },
        });
        fy = ((doc as any).lastAutoTable?.finalY ?? ay + 40) + 2;

        // Total destacado
        doc.setFillColor(...PRIMARY);
        doc.roundedRect(LM + 118, fy, 56, 10, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text('VALOR TOTAL:', LM + 121, fy + 6.5);
        doc.text(fmt(c.total), RM, fy + 6.5, { align: 'right' });
        fy += 18;
    } else {
        // ── MODO AIU (modelo nuevo) ──
        // Tabla productos + bloque Administración/Utilidad + IVA solo sobre util.
        const c = calc!;
        autoTable(doc, {
            startY: ay,
            head: [['Imagen', 'Descripción', 'UM', 'Cantidad', 'V. Unit. antes IVA', 'V. Total antes IVA']],
            body: data.items.map((item, idx) => {
                const desc = [item.name, item.dimensions ? '\n' + item.dimensions : ''].join('');
                return [
                    '', // imagen via didDrawCell
                    desc,
                    item.unit || 'Und',
                    String(item.quantity),
                    fmt(c.items[idx].unitPriceBeforeTax),
                    fmt(c.items[idx].lineTotalBeforeTax),
                ];
            }),
            theme: 'grid',
            headStyles: { fillColor: DARK, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5, cellPadding: 3.5, halign: 'center' },
            bodyStyles: { fontSize: 7.5, cellPadding: 2.5, textColor: DARKGRAY, minCellHeight: 30, valign: 'middle' },
            alternateRowStyles: { fillColor: [250, 248, 244] as [number,number,number] },
            columnStyles: {
                0: { cellWidth: 30 },
                1: { cellWidth: 56 },
                2: { cellWidth: 14, halign: 'center' },
                3: { cellWidth: 16, halign: 'center' },
                4: { cellWidth: 28, halign: 'right' },
                5: { cellWidth: 30, halign: 'right' },
            },
            margin: { left: LM, right: 18 },
            didDrawCell: drawImageCell,
            foot: [
                ['', '', '', '', 'Subtotal:', fmt(c.productsSubtotal)],
                ['', '', '', '', `Administración (${data.adminPercent ?? 0}%):`, fmt(c.adminAmount ?? 0)],
                ['', '', '', '', `Utilidad (${data.utilityPercent ?? 0}%):`, fmt(c.utilityAmount ?? 0)],
                ['', '', '', '', 'Subtotal acumulado:', fmt(c.subtotalAfterAiu ?? 0)],
                ['', '', '', '', 'IVA 19% (sólo sobre utilidad):', fmt(c.taxAmount)],
            ],
            footStyles: { fillColor: [245, 245, 245] as [number,number,number], textColor: DARKGRAY, fontStyle: 'bold', fontSize: 7.5, halign: 'right' },
        });
        fy = ((doc as any).lastAutoTable?.finalY ?? ay + 60) + 2;

        // Total destacado
        doc.setFillColor(...PRIMARY);
        doc.roundedRect(LM + 118, fy, 56, 10, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        doc.text('VALOR TOTAL:', LM + 121, fy + 6.5);
        doc.text(fmt(c.total), RM, fy + 6.5, { align: 'right' });
        fy += 18;
    }

    // ── OBSERVACIONES (opcional, editable por el vendedor) ───────────────────
    // El cliente pidió 7-may-2026: "una casilla opcional que podamos llenar
    // manual donde podamos incluir observaciones". Renderizamos como caja
    // redondeada con bullets si trae saltos de línea o '•' al inicio de línea.
    if (data.observations && data.observations.trim()) {
        fy += 8;
        const obsRaw = data.observations.trim();
        // Cada línea no-vacía se trata como un punto. Si la línea empieza
        // con "• " o "- " la limpiamos para no duplicar viñetas.
        const obsLines = obsRaw.split('\n').map(l => l.trim()).filter(Boolean).map(l =>
            l.replace(/^[•\-]\s*/, '')
        );
        // Estimación de altura para reservar la caja
        const wrapWidth = 168;
        const lineHeight = 4.5;
        let estHeight = 12; // título
        for (const line of obsLines) {
            const wrapped = doc.splitTextToSize(line, wrapWidth);
            estHeight += wrapped.length * lineHeight + 1;
        }
        ensureSpace(estHeight + 6);

        const boxTop = fy;
        const boxX   = LM;
        const boxW   = 174;
        // Título centrado
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...DARK);
        doc.text('OBSERVACIONES', boxX + boxW / 2, fy + 6, { align: 'center' });
        let ofy = fy + 12;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...DARKGRAY);
        for (const line of obsLines) {
            const wrapped = doc.splitTextToSize(line, wrapWidth - 6);
            doc.text('•', boxX + 4, ofy);
            doc.text(wrapped, boxX + 8, ofy);
            ofy += wrapped.length * lineHeight + 1;
        }
        // Caja redondeada alrededor (color crema suave como el ejemplo)
        doc.setDrawColor(...PRIMARY);
        doc.setLineWidth(0.6);
        doc.roundedRect(boxX, boxTop, boxW, ofy - boxTop + 2, 3, 3, 'S');
        doc.setLineWidth(0.2);
        fy = ofy + 6;
    }

    // ── CLOSING ───────────────────────────────────────────────────────────────
    fy += 8;
    if (fy > pageH - 50) {
        doc.addPage();
        fy = 25;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...DARKGRAY);
    doc.text('Esperamos que esta oferta sea de su agrado.', LM, fy);
    fy += 6;
    doc.text('Quedamos atentos a sus comentarios o inquietudes.', LM, fy);
    fy += 10;
    doc.text('Cordialmente', LM, fy);
    fy += 14;

    doc.setDrawColor(...GRAY);
    doc.line(LM, fy, LM + 60, fy);
    fy += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...DARK);
    doc.text(seller.toUpperCase(), LM, fy);
    fy += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARKGRAY);
    doc.text('Asesor Comercial.', LM, fy);
    if (sellerPhone) {
        fy += 5;
        doc.text(sellerPhone, LM, fy);
    }
    if (data.sellerEmail) {
        fy += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...DARKGRAY);
        doc.text(data.sellerEmail, LM, fy);
    }

    addAllCompactHeaders(doc, logoImg?.b64 || null, logoImg?.fmt || null, data.quoteNumber);
    addAllFooters(doc, contactEmail, sealImg);
    doc.save(`Propuesta_${data.quoteNumber}_ArteConcreto.pdf`);
};
