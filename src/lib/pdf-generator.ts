import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF with autoTable for TypeScript
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
    }
}

const LOGO_URL = 'https://voltaris.co/wp-content/uploads/2026/02/Voltarisco@3x.png';

async function loadImageAsBase64(url: string): Promise<string> {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

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
    leadCompany: string;
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

export const generatePDFReport = (data: ReportData) => {
    const doc = new jsPDF();
    const primaryColor = [250, 181, 16]; // Arte Concreto Gold #fab510
    const darkColor = [20, 20, 23];

    // Header background
    doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.rect(0, 0, 210, 40, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('ARTE CONCRETO - CRM INTELLIGENCE', 15, 25);

    // Date
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Fecha del Reporte: ${new Date().toLocaleDateString()}`, 140, 25);

    // Report Title
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(data.title.toUpperCase(), 15, 55);

    // Branding Bar
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(15, 60, 40, 2, 'F');

    // Stats Grid
    doc.setFontSize(14);
    doc.text('MÉTRICAS CLAVE', 15, 75);

    const statsRows = data.stats.map(s => [s.label, s.value, s.change]);

    doc.autoTable({
        startY: 80,
        head: [['Indicador', 'Valor Actual', 'Tendencia']],
        body: statsRows,
        theme: 'grid',
        headStyles: {
            fillColor: darkColor,
            textColor: [255, 255, 255],
            fontStyle: 'bold'
        },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 15, right: 15 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 20;

    // Top Leads
    doc.setFontSize(14);
    doc.text('LEADS DE ALTO VALOR', 15, finalY);

    const leadRows = data.topLeads.map(l => [l.name, l.company, `${l.score}%`]);

    doc.autoTable({
        startY: finalY + 5,
        head: [['Nombre del Lead', 'Empresa', 'Lead Score']],
        body: leadRows,
        theme: 'striped',
        headStyles: {
            fillColor: primaryColor,
            textColor: [0, 0, 0],
            fontStyle: 'bold'
        },
        margin: { left: 15, right: 15 }
    });

    // Footer
    addFooter(doc);

    // Save the PDF
    doc.save(`Reporte_ArteConcreto_${new Date().getTime()}.pdf`);
};

export const generateProposalPDF = async (data: ProposalData) => {
    const doc = new jsPDF();
    const primaryColor = [250, 181, 16];
    const darkColor = [20, 20, 23];

    // Header background
    doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.rect(0, 0, 210, 50, 'F');

    // Logo image
    try {
        const logoBase64 = await loadImageAsBase64(LOGO_URL);
        // Place logo: x=12, y=10, width=55, height=22 — adjust to taste
        doc.addImage(logoBase64, 'PNG', 12, 10, 55, 22);
    } catch {
        // Fallback to text if image fails to load
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('ARTE CONCRETO', 15, 30);
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text('PROPUESTA COMERCIAL', 15, 42);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`${data.quoteNumber}`, 160, 30);
    doc.setTextColor(255, 255, 255);
    doc.text(`Fecha: ${data.date}`, 160, 40);

    // Client Info Section
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('PREPARADO PARA:', 15, 70);

    doc.setFontSize(16);
    doc.text(data.leadName.toUpperCase(), 15, 80);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(data.leadCompany, 15, 88);

    // Decorative Line
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(15, 95, 180, 0.5, 'F');

    // Items Table
    const tableRows = data.items.map(item => [
        item.name,
        `${item.quantity} ${item.unit}`,
        `$${item.price.toLocaleString()}`,
        `$${item.total.toLocaleString()}`
    ]);

    doc.autoTable({
        startY: 110,
        head: [['Descripción del Producto', 'Cant.', 'Precio Unit.', 'Total']],
        body: tableRows,
        theme: 'grid',
        headStyles: {
            fillColor: darkColor,
            textColor: [255, 255, 255],
            fontStyle: 'bold'
        },
        columnStyles: {
            0: { cellWidth: 90 },
            1: { cellWidth: 20, halign: 'center' },
            2: { cellWidth: 35, halign: 'right' },
            3: { cellWidth: 35, halign: 'right' },
        }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;

    // Totals Section
    doc.setFontSize(11);
    doc.text('Subtotal:', 140, finalY);
    doc.text(`$${data.subtotal.toLocaleString()}`, 190, finalY, { align: 'right' });

    doc.text('IVA (19%):', 140, finalY + 8);
    doc.text(`$${data.tax.toLocaleString()}`, 190, finalY + 8, { align: 'right' });

    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(130, finalY + 12, 65, 10, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', 135, finalY + 19);
    doc.text(`$${data.total.toLocaleString()}`, 190, finalY + 19, { align: 'right' });

    // Terms & Conditions
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('TÉRMINOS Y CONDICIONES:', 15, finalY + 35);
    doc.setFont('helvetica', 'normal');
    doc.text([
        '• Validez de la oferta: 15 días calendario.',
        '• Tiempo de entrega: A convenir según disponibilidad de planta.',
        '• Forma de pago: 50% anticipo, 50% contra entrega.',
        '• Esta cotización no incluye costos de transporte a menos que se especifique.'
    ], 15, finalY + 42);

    // Footer
    addFooter(doc);

    // Save
    doc.save(`Propuesta_${data.quoteNumber}_Voltaris.pdf`);
};

const addFooter = (doc: jsPDF) => {
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(180, 180, 180);
        const footerText = 'ARTE CONCRETO LTD. - NIT: 900.XXX.XXX-X - Calle Industrial #123, Medellín, Colombia';
        const brandingText = 'Documento generado automáticamente por MiWibi CRM Intelligence';
        doc.text(footerText, 105, doc.internal.pageSize.height - 15, { align: 'center' });
        doc.text(brandingText, 105, doc.internal.pageSize.height - 10, { align: 'center' });
    }
};
