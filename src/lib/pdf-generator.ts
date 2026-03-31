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
    isAIU?: boolean;
    aiuData?: {
        supply?: string;
        transport?: string;
        installation?: string;
        transportPrice?: number;
        installationPrice?: number;
        totalAIU?: number;
    };
    items: {
        name: string;
        price: number;
        quantity: number;
        unit: string;
        total: number;
        image?: string;
        dimensions?: string;
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

    addAllFooters(doc);
    doc.save(`Reporte_ArteConcreto_${Date.now()}.pdf`);
    } catch (err) {
        console.error('generatePDFReport error:', err);
        alert('Error al generar el reporte PDF. Intenta de nuevo.');
    }
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
    // Logo Arte Concreto: 237×96 px → aspect ratio 2.47:1
    // White pill background so logo (dark ink on transparent) is visible on dark header
    const LOGO_W = 46, LOGO_H = Math.round(46 / (237 / 96)); // ≈ 18.6 → 19 mm
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
            // White rounded background so dark-ink logo shows on dark PDF header
            doc.setFillColor(...WHITE);
            doc.roundedRect(LM - 2, 9, LOGO_W + 4, LOGO_H + 4, 3, 3, 'F');
            const fmt = base64.startsWith('data:image/jpeg') || base64.startsWith('data:image/jpg') ? 'JPEG' : 'PNG';
            doc.addImage(base64, fmt, LM, 11, LOGO_W, LOGO_H, undefined, 'FAST');
        } else { throw new Error('logo not ok'); }
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

    // ── SECTION 5: PRODUCTOS CON FOTO + CANTIDADES Y PRECIOS ─────────────────
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.text('5. CANTIDADES Y PRECIOS DEL PROYECTO:', LM, y);
    y += 6;

    // ── 5a. Product images block (before the table) ───────────────────────────
    const itemsWithImages = data.items.filter(i => i.image);
    if (itemsWithImages.length > 0) {
        const IMG_SIZE = 32;
        const IMG_GAP  = 4;
        const perRow   = Math.floor((RM - LM + IMG_GAP) / (IMG_SIZE + IMG_GAP));
        let imgX = LM;
        for (let i = 0; i < itemsWithImages.length; i++) {
            const item = itemsWithImages[i];
            if (i > 0 && i % perRow === 0) {
                y += IMG_SIZE + 14;
                imgX = LM;
            }
            // Check page break
            if (y + IMG_SIZE + 14 > doc.internal.pageSize.getHeight() - 20) {
                doc.addPage();
                y = 25;
                imgX = LM;
            }
            try {
                // Attempt to embed image from data-url or URL
                const src = item.image!;
                if (src.startsWith('data:') || src.startsWith('http')) {
                    let b64 = src;
                    if (src.startsWith('http')) {
                        const r = await fetch(src);
                        if (r.ok) {
                            const bl = await r.blob();
                            b64 = await new Promise<string>((res, rej) => {
                                const rd = new FileReader();
                                rd.onload = () => res(rd.result as string);
                                rd.onerror = rej;
                                rd.readAsDataURL(bl);
                            });
                        } else { throw new Error('fetch failed'); }
                    }
                    const imgFmt = b64.includes('data:image/jpeg') || b64.includes('data:image/jpg') ? 'JPEG' : 'PNG';
                    doc.setFillColor(245, 245, 245);
                    doc.roundedRect(imgX, y, IMG_SIZE, IMG_SIZE, 2, 2, 'F');
                    doc.addImage(b64, imgFmt, imgX, y, IMG_SIZE, IMG_SIZE, undefined, 'FAST');
                }
            } catch { /* skip image on error */ }
            // Product name below image
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...DARK);
            const nameLines = doc.splitTextToSize(item.name, IMG_SIZE);
            doc.text(nameLines.slice(0, 2), imgX, y + IMG_SIZE + 4);
            if (item.dimensions) {
                doc.setFontSize(6);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...GRAY);
                doc.text(item.dimensions, imgX, y + IMG_SIZE + 10);
            }
            imgX += IMG_SIZE + IMG_GAP;
        }
        y += IMG_SIZE + 16;
    }

    // ── 5b. Price table ──────────────────────────────────────────────────────
    // Check page break before table
    if (y + 30 > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 25;
    }

    autoTable(doc, {
        startY: y,
        head: [['Producto / Referencia', 'Dimensiones', 'Ud.', 'Cant.', 'P. Unitario', 'Total']],
        body: data.items.map(item => [
            item.name,
            item.dimensions || '—',
            item.unit || 'un',
            String(item.quantity),
            fmt(item.price),
            fmt(item.total),
        ]),
        theme: 'grid',
        headStyles: { fillColor: DARK, textColor: WHITE, fontStyle: 'bold', fontSize: 7.5, cellPadding: 3.5 },
        bodyStyles: { fontSize: 7.5, cellPadding: 2.5, textColor: DARKGRAY },
        alternateRowStyles: { fillColor: [250, 248, 244] as [number,number,number] },
        columnStyles: {
            0: { cellWidth: 62 },
            1: { cellWidth: 32 },
            2: { cellWidth: 14, halign: 'center' },
            3: { cellWidth: 12, halign: 'center' },
            4: { cellWidth: 30, halign: 'right' },
            5: { cellWidth: 24, halign: 'right' },
        },
        margin: { left: LM, right: 18 },
        foot: [
            ['', '', '', '', 'Subtotal:', fmt(data.subtotal)],
            ['', '', '', '', 'IVA (19%):', fmt(data.tax)],
        ],
        footStyles: { fillColor: [245, 245, 245] as [number,number,number], textColor: DARKGRAY, fontStyle: 'bold', fontSize: 7.5, halign: 'right' },
    });

    let fy = ((doc as any).lastAutoTable?.finalY ?? y + 40) + 2;

    // ── AIU Section (if applicable) ───────────────────────────────────────────
    if (data.isAIU && data.aiuData) {
        fy += 8;
        if (fy + 50 > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); fy = 25; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...DARK);
        doc.text('6. SUMINISTRO, TRANSPORTE E INSTALACIÓN (AIU):', LM, fy);
        fy += 6;

        const aiuRows: [string, string][] = [];
        if (data.aiuData.supply)       aiuRows.push(['Suministro', data.aiuData.supply]);
        if (data.aiuData.transport)    aiuRows.push(['Transporte y descargue', data.aiuData.transport]);
        if (data.aiuData.installation) aiuRows.push(['Instalación en sitio', data.aiuData.installation]);
        if (data.aiuData.transportPrice)    aiuRows.push(['Precio transporte', fmt(data.aiuData.transportPrice)]);
        if (data.aiuData.installationPrice) aiuRows.push(['Precio instalación', fmt(data.aiuData.installationPrice)]);

        autoTable(doc, {
            startY: fy,
            head: [['Concepto AIU', 'Detalle / Valor']],
            body: aiuRows,
            theme: 'grid',
            headStyles: { fillColor: PRIMARY, textColor: [0,0,0] as [number,number,number], fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8, textColor: DARKGRAY },
            columnStyles: { 0: { cellWidth: 60, fontStyle: 'bold' }, 1: { cellWidth: 114 } },
            margin: { left: LM, right: 18 },
        });
        fy = ((doc as any).lastAutoTable?.finalY ?? fy + 30) + 4;

        if (data.aiuData.totalAIU) {
            doc.setFillColor(...PRIMARY);
            doc.roundedRect(LM + 108, fy, 66, 10, 2, 2, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(0, 0, 0);
            doc.text('TOTAL AIU:', LM + 111, fy + 6.5);
            doc.text(fmt(data.aiuData.totalAIU), RM, fy + 6.5, { align: 'right' });
            fy += 14;
        }
    }

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
