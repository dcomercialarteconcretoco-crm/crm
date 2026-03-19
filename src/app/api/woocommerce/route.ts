import { NextRequest, NextResponse } from 'next/server';

const WOO_URL = process.env.WOOCOMMERCE_URL;
const WOO_KEY = process.env.WOOCOMMERCE_KEY;
const WOO_SECRET = process.env.WOOCOMMERCE_SECRET;

function getHeaders() {
    return {
        'Authorization': 'Basic ' + Buffer.from(`${WOO_KEY}:${WOO_SECRET}`).toString('base64'),
        'Content-Type': 'application/json'
    };
}

export async function GET(req: NextRequest) {
    if (!WOO_URL || !WOO_KEY || !WOO_SECRET) {
        return NextResponse.json({ error: 'Missing WooCommerce API credentials in .env.local' }, { status: 500 });
    }

    try {
        // Fetch products from WooCommerce
        const response = await fetch(`${WOO_URL}/wp-json/wc/v3/products?per_page=100`, {
            method: 'GET',
            headers: getHeaders(),
            cache: 'no-store'
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`WooCommerce API Error: ${errText}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    if (!WOO_URL || !WOO_KEY || !WOO_SECRET) {
        return NextResponse.json({ error: 'Missing WooCommerce API credentials in .env.local' }, { status: 500 });
    }

    try {
        const body = await req.json();

        const response = await fetch(`${WOO_URL}/wp-json/wc/v3/products`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`WooCommerce API Error: ${errText}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    if (!WOO_URL || !WOO_KEY || !WOO_SECRET) {
        return NextResponse.json({ error: 'Missing WooCommerce API credentials in .env.local' }, { status: 500 });
    }

    try {
        const url = new URL(req.url);
        const id = url.searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'Missing product ID' }, { status: 400 });

        const body = await req.json();

        const response = await fetch(`${WOO_URL}/wp-json/wc/v3/products/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`WooCommerce API Error: ${errText}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    if (!WOO_URL || !WOO_KEY || !WOO_SECRET) {
        return NextResponse.json({ error: 'Missing WooCommerce API credentials in .env.local' }, { status: 500 });
    }

    try {
        const url = new URL(req.url);
        const id = url.searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'Missing product ID' }, { status: 400 });

        const response = await fetch(`${WOO_URL}/wp-json/wc/v3/products/${id}?force=true`, {
            method: 'DELETE',
            headers: getHeaders()
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`WooCommerce API Error: ${errText}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
