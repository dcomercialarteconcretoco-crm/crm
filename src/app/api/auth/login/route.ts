import { NextRequest, NextResponse } from "next/server";

const SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase() || "";
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD?.trim() || "";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      username?: string;
      password?: string;
    };

    const username = body.username?.trim().toLowerCase() || "";
    const password = body.password?.trim() || "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "Usuario y contraseña requeridos." },
        { status: 400 }
      );
    }

    if (!SUPERADMIN_EMAIL || !SUPERADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Acceso superadmin no configurado." },
        { status: 503 }
      );
    }

    if (username !== SUPERADMIN_EMAIL || password !== SUPERADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Credenciales inválidas." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: {
        id: "superadmin-server",
        name: "Juan Sierra",
        username: SUPERADMIN_EMAIL,
        email: SUPERADMIN_EMAIL,
        role: "SuperAdmin",
        status: "Activo",
        avatar:
          "https://ui-avatars.com/api/?name=Juan+Sierra&background=fab510&color=000",
      },
    });
  } catch (error) {
    console.error("Auth login route error:", error);
    return NextResponse.json(
      { error: "No fue posible validar el acceso." },
      { status: 500 }
    );
  }
}
