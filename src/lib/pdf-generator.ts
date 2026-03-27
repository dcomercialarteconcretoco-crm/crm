import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReportData {
    title: string;
    stats: { label: string; value: string; change: string }[];
    topLeads: { name: string; company: string; score: number }[];
}

export interface ProposalData {
    quoteNumber: string;
    date: string;
    leadName: string;
    leadCompany?: string;
    leadEmail?: string;
    leadCity?: string;
    // Campos comerciales
    referencia?: string;
    validUntil?: string;
    deliveryTime?: string;
    paymentTerms?: string;
    sellerName?: string;
    sellerPhone?: string;
    items: {
        name: string;
        price: number;
        quantity: number;
        unit: string;
        total: number;
    }[];
    subtotal: number;
    tax: number;
    total: number;
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

function addPageFooter(doc: jsPDF, page: number, total: number): void {
    const h = doc.internal.pageSize.getHeight();
    doc.setFillColor(...DARK);
    doc.rect(0, h - 16, PW, 16, 'F');
    doc.setFillColor(...PRIMARY);
    doc.rect(0, h - 17, PW, 1, 'F');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text('ARTE CONCRETO S.A.S  ·  Km 1+800, Anillo Vial, Floridablanca, Santander  ·  cotizaciones@arteconcreto.co', PW / 2, h - 9, { align: 'center' });
    doc.setTextColor(80, 80, 80);
    doc.text(`Pág. ${page} / ${total}`, PW / 2, h - 4, { align: 'center' });
}

function addAllFooters(doc: jsPDF): void {
    const pages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        addPageFooter(doc, i, pages);
    }
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

    const y1 = (doc as any).lastAutoTable.finalY + 18;
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

    addAllFooters(doc);
    doc.save(`Reporte_ArteConcreto_${Date.now()}.pdf`);
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROPUESTA COMERCIAL — Formato oficial Arte Concreto
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

    // ── HEADER ────────────────────────────────────────────────────────────────
    // Dark background
    doc.setFillColor(...DARK);
    doc.rect(0, 0, PW, 44, 'F');
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 40, PW, 4, 'F');

    // Try to load logo via /api/logo proxy
    try {
        const res = await fetch('/api/logo');
        if (res.ok) {
            const blob = await res.blob();
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            doc.addImage(base64, 'PNG', LM, 6, 50, 28, undefined, 'FAST');
        }
    } catch {
        // Fallback: text logo
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

    // Company info right side
    doc.setTextColor(180, 180, 180);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('NIT: 901.234.567-8', RM, 10, { align: 'right' });
    doc.text('Km 1+800, Anillo Vial, Floridablanca, Santander', RM, 16, { align: 'right' });
    doc.text('cotizaciones@arteconcreto.co', RM, 22, { align: 'right' });
    doc.text('www.arteconcreto.co', RM, 28, { align: 'right' });

    // Quote number badge
    doc.setTextColor(...PRIMARY);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(data.quoteNumber, RM, 36, { align: 'right' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 160, 160);
    doc.text('Cotización No.', RM - doc.getTextWidth(data.quoteNumber) - 2, 36, { align: 'right' });

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
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...DARKGRAY);
    doc.text('Señores.', LM, y);

    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...DARK);
    doc.text(name.toUpperCase(), LM, y);

    if (company) {
        y += 6;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(company.toUpperCase(), LM, y);
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

    // ── SECTION 1: ALCANCE ────────────────────────────────────────────────────
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text('1. ALCANCE DE LA PROPUESTA:', LM, y);

    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARKGRAY);

    const alcanceText = 'La presente oferta de los elementos en concreto se entrega en la planta de producción, Anillo Vial Km 1 + 800 Floridablanca – Girón, basado en la solicitud del cliente.';
    const alcanceLines = doc.splitTextToSize(alcanceText, 174);
    doc.text(alcanceLines, LM, y);
    y += alcanceLines.length * 4.5 + 3;

    const noIncluyeItems = [
        'La oferta No incluye el transporte de los elementos al sitio de entrega.',
        'La oferta No incluye el descargue del producto que corresponde a los productos en concreto.',
        'La oferta No incluye la instalación de las piezas cotizadas.',
    ];
    for (const item of noIncluyeItems) {
        const lines = doc.splitTextToSize(item, 168);
        // Bold "No incluye"
        doc.setFont('helvetica', 'normal');
        doc.text('La oferta ', LM + 3, y);
        const x1 = LM + 3 + doc.getTextWidth('La oferta ');
        doc.setFont('helvetica', 'bold');
        doc.text('No incluye', x1, y);
        const x2 = x1 + doc.getTextWidth('No incluye');
        doc.setFont('helvetica', 'normal');
        const rest = item.replace('La oferta No incluye', '');
        const restLines = doc.splitTextToSize(rest, 174 - (x2 - LM));
        doc.text(restLines[0] || '', x2, y);
        if (restLines.length > 1) {
            y += 4.5;
            doc.text(restLines.slice(1), LM + 3, y);
        }
        y += 5;
    }

    // ── SECTION 2: VIGENCIA ───────────────────────────────────────────────────
    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text('2. VIGENCIA DE LA OFERTA:', LM, y);

    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARKGRAY);
    doc.text(`La cotización tiene vigencia hasta el ${validUntil}.`, LM, y);

    // ── SECTION 3: PLAZO DE ENTREGA ───────────────────────────────────────────
    y += 10;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text('3. PLAZO DE ENTREGA:', LM, y);

    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARKGRAY);
    const deliveryLines = doc.splitTextToSize(deliveryTime, 174);
    doc.text(deliveryLines, LM, y);
    y += deliveryLines.length * 4.5;

    // ── SECTION 4: FORMA DE PAGO ──────────────────────────────────────────────
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text('4. FORMA DE PAGO:', LM, y);

    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...DARKGRAY);
    const pagoLabel = 'La forma de pago pactada es de la siguiente manera:';
    doc.text(pagoLabel, LM, y);
    y += 5.5;

    const pagoLines = paymentTerms.split('\n');
    for (const line of pagoLines) {
        if (!line.trim()) continue;
        const wrapped = doc.splitTextToSize(line.trim(), 174);
        doc.text(wrapped, LM, y);
        y += wrapped.length * 4.5 + 1;
    }

    // ── SECTION 5: CANTIDADES Y PRECIOS ───────────────────────────────────────
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text('5. CANTIDADES Y PRECIOS DEL PROYECTO:', LM, y);
    y += 4;

    autoTable(doc, {
        startY: y,
        head: [['Descripción del Producto / Referencia', 'Unidad', 'Cant.', 'Precio Unitario', 'Total']],
        body: data.items.map(item => [
            item.name,
            item.unit || 'un',
            String(item.quantity),
            fmt(item.price),
            fmt(item.total),
        ]),
        theme: 'grid',
        headStyles: {
            fillColor: DARK,
            textColor: WHITE,
            fontStyle: 'bold',
            fontSize: 8,
            cellPadding: 4,
        },
        bodyStyles: { fontSize: 8, cellPadding: 3, textColor: DARKGRAY },
        alternateRowStyles: { fillColor: [250, 248, 244] },
        columnStyles: {
            0: { cellWidth: 80 },
            1: { cellWidth: 18, halign: 'center' },
            2: { cellWidth: 14, halign: 'center' },
            3: { cellWidth: 32, halign: 'right' },
            4: { cellWidth: 30, halign: 'right' },
        },
        margin: { left: LM, right: 18 },
        foot: [
            ['', '', '', 'Subtotal:', fmt(data.subtotal)],
            ['', '', '', 'IVA (19%):', fmt(data.tax)],
        ],
        footStyles: {
            fillColor: [245, 245, 245],
            textColor: DARKGRAY,
            fontStyle: 'bold',
            fontSize: 8,
            halign: 'right',
        },
    });

    let fy = (doc as any).lastAutoTable.finalY + 2;

    // TOTAL highlight box
    doc.setFillColor(...PRIMARY);
    doc.roundedRect(LM + 118, fy, 56, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('TOTAL:', LM + 121, fy + 6.5);
    doc.text(fmt(data.total), RM, fy + 6.5, { align: 'right' });

    fy += 18;

    // ── CLOSING ───────────────────────────────────────────────────────────────
    // Check if we need a new page
    if (fy > 230) {
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

    // Signature line
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

    addAllFooters(doc);
    doc.save(`Propuesta_${data.quoteNumber}_ArteConcreto.pdf`);
};
