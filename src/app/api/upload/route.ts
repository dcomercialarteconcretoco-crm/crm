import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
        if (!validTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Tipo de archivo no válido' }, { status: 400 });
        }

        // Limit size to 10MB
        if (file.size > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'Imagen demasiado grande (máx 10MB)' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Unique filename
        const ext = file.name.split('.').pop();
        const filename = `product_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;

        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'products');
        await mkdir(uploadDir, { recursive: true });

        const filepath = path.join(uploadDir, filename);
        await writeFile(filepath, buffer);

        const url = `/uploads/products/${filename}`;
        return NextResponse.json({ url });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 });
    }
}
