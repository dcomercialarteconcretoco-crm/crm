import { NextRequest, NextResponse } from 'next/server';
import { assertWhatsAppConfig, graphRequest, resolveWhatsAppConfig } from '../_lib';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const config = resolveWhatsAppConfig(body);

        assertWhatsAppConfig(config);

        const phone = await graphRequest(
            `/${config.phoneNumberId}?fields=id,display_phone_number,verified_name`,
            { method: 'GET' },
            config.accessToken
        );

        return NextResponse.json({
            ok: true,
            phoneNumberId: phone.id,
            displayPhoneNumber: phone.display_phone_number || '',
            verifiedName: phone.verified_name || '',
        });
    } catch (error) {
        return NextResponse.json(
            {
                ok: false,
                error: error instanceof Error ? error.message : 'No se pudo validar WhatsApp Business.',
            },
            { status: 400 }
        );
    }
}
