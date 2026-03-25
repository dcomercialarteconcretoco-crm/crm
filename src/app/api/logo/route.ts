import { NextResponse } from 'next/server';

// Proxy the Arte Concreto logo to avoid CORS issues when generating PDFs client-side
export async function GET() {
    try {
        const response = await fetch(
            'https://voltaris.co/wp-content/uploads/2026/02/Voltarisco@3x.png',
            { next: { revalidate: 86400 } }
        );
        if (!response.ok) throw new Error('Logo fetch failed');
        const buffer = await response.arrayBuffer();
        return new NextResponse(Buffer.from(buffer), {
            status: 200,
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=86400',
            },
        });
    } catch {
        return new NextResponse(null, { status: 404 });
    }
}
