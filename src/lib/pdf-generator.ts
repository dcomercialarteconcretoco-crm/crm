import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ReportData {
    title: string;
    stats: {
        label: string;
        value: string;
        change: string;
    }[];
    topLeads: {
        name: string;
        company: string;
        score: number;
    }[];
}

export interface ProposalData {
    quoteNumber: string;
    date: string;
    leadName: string;
    leadCompany?: string;
    leadEmail?: string;
    leadCity?: string;
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

function fmt(n: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function addFooter(doc: jsPDF): void {
    const pages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(...GRAY);
        const h = doc.internal.pageSize.getHeight();
        doc.text('ARTE CONCRETO S.A.S · Km 1 +800, Anillo Víal, Floridablanca, Santander', 105, h - 12, { align: 'center' });
        doc.text('Documento generado por MiWibi CRM Intelligence', 105, h - 7, { align: 'center' });
    }
}

export const generatePDFReport = (data: ReportData): void => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Header
    doc.setFillColor(...DARK);
    doc.rect(0, 0, 210, 42, 'F');

    doc.setFillColor(...PRIMARY);
    doc.rect(0, 38, 210, 4, 'F');

    doc.setTextColor(...WHITE);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('ARTE CONCRETO', 15, 22);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 180, 180);
    doc.text('CRM Intelligence · Reporte ejecutivo', 15, 30);

    doc.setTextColor(...PRIMARY);
    doc.setFontSize(8);
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-CO')}`, 160, 22);

    // Title
    doc.setTextColor(...DARK);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(data.title.toUpperCase(), 15, 62);

    doc.setFillColor(...PRIMARY);
    doc.rect(15, 66, 50, 1.5, 'F');

    // Stats
    doc.setFontSize(11);
    doc.setTextColor(...DARK);
    doc.text('MÉTRICAS CLAVE', 15, 80);

    autoTable(doc, {
        startY: 85,
        head: [['Indicador', 'Valor Actual', 'Tendencia']],
        body: data.stats.map(s => [s.label, s.value, s.change]),
        theme: 'grid',
        headStyles: { fillColor: DARK, textColor: WHITE, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        alternateRowStyles: { fillColor: LIGHT },
        margin: { left: 15, right: 15 },
    });

    const y1 = (doc as any).lastAutoTable.finalY + 18;
    doc.setFontSize(11);
    doc.setTextColor(...DARK);
    doc.text('LEADS DE ALTO VALOR', 15, y1);

    autoTable(doc, {
        startY: y1 + 5,
        head: [['Nombre del Lead', 'Empresa', 'Lead Score']],
        body: data.topLeads.map(l => [l.name, l.company, `${l.score}%`]),
        theme: 'striped',
        headStyles: { fillColor: PRIMARY, textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 15, right: 15 },
    });

    addFooter(doc);
    doc.save(`Reporte_ArteConcreto_${Date.now()}.pdf`);
};

async function loadLogoBase64(): Promise<string | null> {
    try {
        const res = await fetch('/api/logo');
        if (!res.ok) return null;
        const blob = await res.blob();
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

export const generateProposalPDF = async (data: ProposalData): Promise<void> => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const name    = data.leadName    || 'Cliente';
    const company = data.leadCompany || '';
    const email   = data.leadEmail   || '';
    const city    = data.leadCity    || '';

    // Try to load logo
    const logoBase64 = await loadLogoBase64();

    // ── Header ──────────────────────────────────────────────────────────────
    doc.setFillColor(...DARK);
    doc.rect(0, 0, 210, 46, 'F');

    doc.setFillColor(...PRIMARY);
    doc.rect(0, 42, 210, 4, 'F');

    // Logo or Brand text
    if (logoBase64) {
        try {
            doc.addImage(logoBase64, 'PNG', 12, 9, 52, 22);
        } catch {
            // fallback to text
            doc.setTextColor(...WHITE);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text('ARTE CONCRETO', 15, 20);
        }
    } else {
        doc.setTextColor(...WHITE);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('ARTE CONCRETO', 15, 20);
    }

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 180, 180);
    doc.text('PROPUESTA COMERCIAL', 15, 34);

    // Quote badge (right side)
    doc.setTextColor(...PRIMARY);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(data.quoteNumber, 195, 18, { align: 'right' });

    doc.setTextColor(200, 200, 200);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha: ${data.date}`, 195, 26, { align: 'right' });
    doc.text('Vigencia: 15 días calendario', 195, 32, { align: 'right' });

    // ── Client info ──────────────────────────────────────────────────────────
    doc.setTextColor(...DARK);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRAY);
    doc.text('PREPARADO PARA:', 15, 60);

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(name.toUpperCase(), 15, 69);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    if (company) doc.text(company, 15, 77);
    const detailY = company ? 83 : 77;
    const details = [email, city].filter(Boolean).join(' · ');
    if (details) doc.text(details, 15, detailY);

    // Divider
    doc.setFillColor(...PRIMARY);
    doc.rect(15, detailY + 6, 180, 0.8, 'F');

    // ── Items table ──────────────────────────────────────────────────────────
    autoTable(doc, {
        startY: detailY + 12,
        head: [['Descripción del Producto', 'Cant.', 'Precio Unit.', 'Total']],
        body: data.items.map(item => [
            item.name,
            `${item.quantity} ${item.unit}`,
            fmt(item.price),
            fmt(item.total),
        ]),
        theme: 'grid',
        headStyles: { fillColor: DARK, textColor: WHITE, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        alternateRowStyles: { fillColor: [250, 248, 244] },
        columnStyles: {
            0: { cellWidth: 90 },
            1: { cellWidth: 20, halign: 'center' },
            2: { cellWidth: 38, halign: 'right' },
            3: { cellWidth: 38, halign: 'right' },
        },
        margin: { left: 15, right: 15 },
    });

    const fy = (doc as any).lastAutoTable.finalY + 8;

    // ── Totals ───────────────────────────────────────────────────────────────
    doc.setFontSize(9);
    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', 140, fy);
    doc.text(fmt(data.subtotal), 195, fy, { align: 'right' });

    doc.text('IVA (19%):', 140, fy + 7);
    doc.text(fmt(data.tax), 195, fy + 7, { align: 'right' });

    doc.setFillColor(...PRIMARY);
    doc.roundedRect(130, fy + 11, 65, 11, 2, 2, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TOTAL:', 135, fy + 18.5);
    doc.text(fmt(data.total), 192, fy + 18.5, { align: 'right' });

    // ── Terms ────────────────────────────────────────────────────────────────
    const termsY = fy + 36;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text('TÉRMINOS Y CONDICIONES:', 15, termsY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text([
        '• Validez de la oferta: 15 días calendario.',
        '• Tiempo de entrega: 10-15 días hábiles según disponibilidad de planta.',
        '• Forma de pago: 50% anticipo, 50% contra entrega.',
        '• Esta cotización no incluye costos de transporte a menos que se especifique.',
    ], 15, termsY + 6);

    addFooter(doc);
    doc.save(`Propuesta_${data.quoteNumber}_ArteConcreto.pdf`);
};
