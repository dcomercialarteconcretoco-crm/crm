export type WhatsAppRuntimeConfig = {
    accessToken?: string;
    phoneNumberId?: string;
    businessAccountId?: string;
    verifyToken?: string;
};

export function resolveWhatsAppConfig(input?: WhatsAppRuntimeConfig): Required<WhatsAppRuntimeConfig> {
    const allowClientConfig = process.env.NODE_ENV !== 'production';
    const runtimeInput = allowClientConfig ? input : undefined;

    return {
        accessToken: runtimeInput?.accessToken || process.env.WHATSAPP_ACCESS_TOKEN || '',
        phoneNumberId: runtimeInput?.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
        businessAccountId: runtimeInput?.businessAccountId || process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
        verifyToken: runtimeInput?.verifyToken || process.env.WHATSAPP_VERIFY_TOKEN || '',
    };
}

export function assertWhatsAppConfig(config: Required<WhatsAppRuntimeConfig>) {
    if (!config.accessToken) {
        throw new Error('Falta WHATSAPP_ACCESS_TOKEN.');
    }
    if (!config.phoneNumberId) {
        throw new Error('Falta WHATSAPP_PHONE_NUMBER_ID.');
    }
}

export async function graphRequest(path: string, init: RequestInit = {}, accessToken: string) {
    const response = await fetch(`https://graph.facebook.com/v22.0${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            ...(init.headers || {}),
        },
        cache: 'no-store',
    });

    const text = await response.text();
    let payload: any = null;

    try {
        payload = text ? JSON.parse(text) : null;
    } catch {
        payload = { raw: text };
    }

    if (!response.ok) {
        const message = payload?.error?.message || payload?.raw || 'Meta Graph devolvió un error.';
        throw new Error(message);
    }

    return payload;
}
