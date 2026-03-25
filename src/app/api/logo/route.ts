import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

// Serve the ArteConcreto logo from the local public folder — no external dependency
export async function GET() {
    try {
        const filePath = join(process.cwd(), 'public', 'logo-arteconcreto.png');
        const buffer = readFileSync(filePath);
        return new NextResponse(buffer, {
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
