import { NextResponse } from "next/server";

export async function GET() {
  const keys = Object.keys(process.env).filter(k =>
    k.match(/DATABASE|POSTGRES|NEON|STORAGE|PG|SUPABASE/i)
  );
  const result: Record<string, string> = {};
  keys.forEach(k => {
    const val = process.env[k] || '';
    result[k] = val.length > 20 ? val.slice(0, 30) + '...' : val;
  });
  return NextResponse.json({ found: keys.length, vars: result });
}
