import { NextRequest, NextResponse } from 'next/server';
import { assertWhatsAppConfig, graphRequest, resolveWhatsAppConfig, WhatsAppRuntimeConfig } from '../_lib';

type SendBody = {
    to?: string;
    text?: string;
    config?: WhatsAppRuntimeConfig;
};

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as SendBody;
        const to = (body.to || '').replace(/\D/g, '');
        const text = (body.text || '').trim();

        if (!to) {
            throw new Error('Falta el número destino en formato internacional.');
        }
        if (!text) {
            throw new Error('Falta el texto del mensaje.');
        }

        const config = resolveWhatsAppConfig(body.config);
        assertWhatsAppConfig(config);

        const payload = await graphRequest(
            `/${config.phoneNumberId}/messages`,
            {
                method: 'POST',
                body: JSON.stringify({
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to,
                    type: 'text',
                    text: {
                        preview_url: false,
                        body: text,
                    },
                }),
            },
            config.accessToken
        );

        return NextResponse.json({
            ok: true,
            messageId: payload?.messages?.[0]?.id || null,
            contact: payload?.contacts?.[0]?.wa_id || to,
        });
    } catch (error) {
        return NextResponse.json(
            {
                ok: false,
                error: error instanceof Error ? error.message : 'No se pudo enviar el mensaje de WhatsApp.',
            },
            { status: 400 }
        );
    }
}
