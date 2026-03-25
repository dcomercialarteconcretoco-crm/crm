import { NextRequest, NextResponse } from 'next/server';

// 1x1 transparent PNG pixel (base64)
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

export async function GET(req: NextRequest) {
  const quoteNumber = req.nextUrl.searchParams.get('q') || '';
  const clientEmail = req.nextUrl.searchParams.get('e') || '';

  // Log the open event (in production this would update Supabase)
  console.log(`[EMAIL OPEN] Quote: ${quoteNumber} | Client: ${clientEmail} | Time: ${new Date().toISOString()}`);

  // Return 1x1 transparent pixel
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache',
    },
  });
}
