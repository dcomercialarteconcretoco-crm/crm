import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase, getPool } from '@/lib/postgres';

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Token y contraseña requeridos' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    if (!hasDatabase()) {
      return NextResponse.json({ error: 'Base de datos no configurada' }, { status: 503 });
    }

    const pool = getPool();

    // Find user with valid (not expired) token
    const { rows } = await pool.query(
      `SELECT id, name FROM crm_users
       WHERE reset_token = $1
         AND reset_token_expires > NOW()
       LIMIT 1`,
      [token]
    );

    if (!rows.length) {
      return NextResponse.json({ error: 'El enlace es inválido o ha expirado' }, { status: 400 });
    }

    const user = rows[0];

    // Update password and clear token
    await pool.query(
      `UPDATE crm_users
       SET password = $1, reset_token = NULL, reset_token_expires = NULL, updated_at = NOW()
       WHERE id = $2`,
      [password, user.id]
    );

    return NextResponse.json({ ok: true, name: user.name });
  } catch (err) {
    console.error('reset-password error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// GET: validate token without consuming it
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    if (!token) return NextResponse.json({ valid: false });

    if (!hasDatabase()) return NextResponse.json({ valid: false });

    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT name FROM crm_users WHERE reset_token = $1 AND reset_token_expires > NOW() LIMIT 1`,
      [token]
    );

    return NextResponse.json({ valid: rows.length > 0, name: rows[0]?.name });
  } catch {
    return NextResponse.json({ valid: false });
  }
}
