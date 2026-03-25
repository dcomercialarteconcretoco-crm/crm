import { NextRequest, NextResponse } from 'next/server';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'ordenes@arteconcreto.co';

interface ProductItem {
    name: string;
    price: number;
    quantity: number;
    unit?: string;
}

interface ProductionOrderPayload {
    orderNumber: string;
    clientName: string;
    clientCompany: string;
    sellerName: string;
    products: ProductItem[];
    totalValue: number;
    dealTitle: string;
    quoteId: string;
    date: string;
    recipientEmails: string[];
    notes?: string;
}

function generateProductionEmailHTML(order: ProductionOrderPayload): string {
    const productRows = order.products.map(p => `
        <tr style="border-bottom: 1px solid #1a1a1d;">
            <td style="padding: 14px 20px; font-size: 13px; font-weight: 700; color: #f8fafc;">${p.name}</td>
            <td style="padding: 14px 20px; text-align: center; font-size: 13px; font-weight: 900; color: #fab510;">${p.quantity} ${p.unit || 'un'}</td>
            <td style="padding: 14px 20px; text-align: right; font-size: 13px; color: #94a3b8;">$${p.price.toLocaleString('es-CO')}</td>
            <td style="padding: 14px 20px; text-align: right; font-size: 13px; font-weight: 900; color: #10b981;">$${(p.price * p.quantity).toLocaleString('es-CO')}</td>
        </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Orden de Producción ${order.orderNumber}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width: 680px; margin: 0 auto; padding: 40px 20px;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1a1a1d 0%, #141417 100%); border: 1px solid rgba(250,181,16,0.2); border-radius: 24px; padding: 40px; margin-bottom: 24px; position: relative; overflow: hidden;">
            <div style="position: absolute; top: -20px; right: -20px; width: 120px; height: 120px; background: radial-gradient(circle, rgba(250,181,16,0.08) 0%, transparent 70%); border-radius: 50%;"></div>
            
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px;">
                <div>
                    <div style="font-size: 10px; font-weight: 900; color: #fab510; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 8px;">ArteConcreto S.A.S</div>
                    <div style="font-size: 10px; color: #94a3b8; letter-spacing: 2px; text-transform: uppercase;">Sistema de Producción Industrial</div>
                </div>
                <div style="background: rgba(250,181,16,0.1); border: 1px solid rgba(250,181,16,0.3); border-radius: 12px; padding: 10px 16px; text-align: center;">
                    <div style="font-size: 9px; color: #fab510; letter-spacing: 2px; text-transform: uppercase; font-weight: 900;">URGENTE</div>
                    <div style="font-size: 9px; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase; margin-top: 2px;">Producción Requerida</div>
                </div>
            </div>

            <div>
                <div style="font-size: 10px; font-weight: 900; color: #64748b; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 8px;">Orden de Producción</div>
                <div style="font-size: 36px; font-weight: 900; color: #f8fafc; letter-spacing: -2px; line-height: 1;">${order.orderNumber}</div>
            </div>
        </div>

        <!-- Client & Order Info -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
            <div style="background: #141417; border: 1px solid #1e1e21; border-radius: 20px; padding: 28px;">
                <div style="font-size: 9px; font-weight: 900; color: #64748b; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 16px;">Cliente</div>
                <div style="font-size: 16px; font-weight: 900; color: #f8fafc; margin-bottom: 4px;">${order.clientName}</div>
                <div style="font-size: 12px; font-weight: 700; color: #fab510; text-transform: uppercase; letter-spacing: 1px;">${order.clientCompany}</div>
            </div>
            <div style="background: #141417; border: 1px solid #1e1e21; border-radius: 20px; padding: 28px;">
                <div style="font-size: 9px; font-weight: 900; color: #64748b; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 16px;">Detalles</div>
                <div style="font-size: 12px; color: #f8fafc; margin-bottom: 8px;"><span style="color: #64748b; font-weight: 700;">Vendedor:</span> ${order.sellerName}</div>
                <div style="font-size: 12px; color: #f8fafc; margin-bottom: 8px;"><span style="color: #64748b; font-weight: 700;">Cotización:</span> ${order.quoteId}</div>
                <div style="font-size: 12px; color: #f8fafc;"><span style="color: #64748b; font-weight: 700;">Fecha:</span> ${order.date}</div>
            </div>
        </div>

        <!-- Deal Title -->
        <div style="background: rgba(250,181,16,0.05); border: 1px solid rgba(250,181,16,0.15); border-radius: 16px; padding: 20px 28px; margin-bottom: 24px;">
            <div style="font-size: 9px; font-weight: 900; color: #fab510; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 8px;">Descripción del Proyecto</div>
            <div style="font-size: 15px; font-weight: 900; color: #f8fafc;">${order.dealTitle}</div>
        </div>

        <!-- Products Table -->
        <div style="background: #141417; border: 1px solid #1e1e21; border-radius: 20px; overflow: hidden; margin-bottom: 24px;">
            <div style="padding: 20px 24px; border-bottom: 1px solid #1e1e21; background: rgba(250,181,16,0.03);">
                <div style="font-size: 10px; font-weight: 900; color: #94a3b8; letter-spacing: 3px; text-transform: uppercase;">📦 Ítems a Producir</div>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: rgba(250,181,16,0.05);">
                        <th style="padding: 12px 20px; text-align: left; font-size: 9px; font-weight: 900; color: #64748b; letter-spacing: 2px; text-transform: uppercase;">Producto</th>
                        <th style="padding: 12px 20px; text-align: center; font-size: 9px; font-weight: 900; color: #64748b; letter-spacing: 2px; text-transform: uppercase;">Cantidad</th>
                        <th style="padding: 12px 20px; text-align: right; font-size: 9px; font-weight: 900; color: #64748b; letter-spacing: 2px; text-transform: uppercase;">P. Unit.</th>
                        <th style="padding: 12px 20px; text-align: right; font-size: 9px; font-weight: 900; color: #64748b; letter-spacing: 2px; text-transform: uppercase;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${productRows}
                </tbody>
            </table>
            
            <!-- Total -->
            <div style="padding: 20px 24px; border-top: 1px solid rgba(250,181,16,0.1); background: rgba(250,181,16,0.03); display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 10px; font-weight: 900; color: #64748b; letter-spacing: 3px; text-transform: uppercase;">Valor Total del Pedido</div>
                <div style="font-size: 22px; font-weight: 900; color: #fab510; letter-spacing: -1px;">$${order.totalValue.toLocaleString('es-CO')} COP</div>
            </div>
        </div>

        ${order.notes ? `
        <!-- Notes -->
        <div style="background: rgba(14, 165, 233, 0.05); border: 1px solid rgba(14, 165, 233, 0.15); border-radius: 16px; padding: 20px 28px; margin-bottom: 24px;">
            <div style="font-size: 9px; font-weight: 900; color: #0ea5e9; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 8px;">📝 Notas Adicionales</div>
            <div style="font-size: 13px; color: #94a3b8; line-height: 1.6;">${order.notes}</div>
        </div>
        ` : ''}

        <!-- Action Required -->
        <div style="background: linear-gradient(135deg, rgba(16,185,129,0.08) 0%, transparent 100%); border: 1px solid rgba(16,185,129,0.2); border-radius: 20px; padding: 28px; margin-bottom: 24px;">
            <div style="font-size: 10px; font-weight: 900; color: #10b981; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 12px;">⚡ Acción Requerida</div>
            <div style="font-size: 14px; color: #94a3b8; line-height: 1.7;">
                Esta orden fue generada automáticamente por el CRM ArteConcreto Intelligence al confirmar la venta. Por favor iniciar el proceso de producción para los ítems listados y confirmar la recepción de esta orden al vendedor asignado.
            </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 9px; color: #374151; letter-spacing: 2px; text-transform: uppercase;">Generado automáticamente por</div>
            <div style="font-size: 10px; font-weight: 900; color: #fab510; letter-spacing: 3px; text-transform: uppercase; margin-top: 4px;">ArteConcreto Intelligence Core — MiWibi CRM</div>
            <div style="font-size: 9px; color: #374151; margin-top: 8px; letter-spacing: 1px;">${order.date} · Confidencial</div>
        </div>
    </div>
</body>
</html>
    `;
}

export async function POST(req: NextRequest) {
    try {
        const body: ProductionOrderPayload & { api_key?: string } = await req.json();
        const allowClientKey = process.env.NODE_ENV !== 'production';
        const finalApiKey = RESEND_API_KEY || (allowClientKey ? body.api_key : undefined);

        if (!finalApiKey) {
            return NextResponse.json({ error: 'RESEND_API_KEY no configurada. Por favor regístrala en Configuración > Integraciones.' }, { status: 400 });
        }

        if (!body.recipientEmails || body.recipientEmails.length === 0) {
            return NextResponse.json({ error: 'No hay correos de producción configurados.' }, { status: 400 });
        }

        const htmlContent = generateProductionEmailHTML(body);

        const emailPayload = {
            from: `ArteConcreto Producción <${FROM_EMAIL}>`,
            to: body.recipientEmails,
            subject: `🔧 ORDEN DE PRODUCCIÓN ${body.orderNumber} — ${body.clientCompany} · ${body.dealTitle}`,
            html: htmlContent,
        };

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${finalApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(emailPayload),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Resend error:', errorData);
            return NextResponse.json({ error: 'Error enviando email', details: errorData }, { status: 500 });
        }

        const result = await response.json();
        return NextResponse.json({ success: true, emailId: result.id, message: `Orden de producción enviada a: ${body.recipientEmails.join(', ')}` });

    } catch (error) {
        console.error('Production order error:', error);
        return NextResponse.json({ error: 'Error interno al procesar la orden de producción' }, { status: 500 });
    }
}
