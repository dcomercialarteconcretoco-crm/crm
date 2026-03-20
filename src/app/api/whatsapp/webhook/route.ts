import { NextRequest, NextResponse } from 'next/server';
import { resolveWhatsAppConfig } from '../_lib';

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const config = resolveWhatsAppConfig();

    if (mode === 'subscribe' && token && token === config.verifyToken) {
        return new NextResponse(challenge || 'ok', { status: 200 });
    }

    return NextResponse.json({ ok: false, error: 'Webhook verification failed.' }, { status: 403 });
}

export async function POST(req: NextRequest) {
    try {
        const payload = await req.json();

        // Base webhook handler. In the next step this should persist inbound/outbound events.
        console.log('WhatsApp webhook payload:', JSON.stringify(payload));

        return NextResponse.json({ ok: true });
    } catch (error) {
        return NextResponse.json(
            {
                ok: false,
                error: error instanceof Error ? error.message : 'Invalid webhook payload.',
            },
            { status: 400 }
        );
    }
}
