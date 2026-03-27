import crypto from "crypto";

const SESSION_COOKIE = "crm_session";
const SESSION_SECRET = (() => {
  const secret =
    process.env.SESSION_SECRET ||
    process.env.SUPERADMIN_PASSWORD ||
    '';
  if (!secret && process.env.NODE_ENV === 'production') {
    console.error('[AUTH] ⚠️  SESSION_SECRET no configurado — set SESSION_SECRET en las variables de entorno de Vercel');
  }
  return secret || 'ac-fallback-dev-secret-change-in-prod';
})();

export type SessionUser = {
  id: string;
  name: string;
  username?: string;
  email: string;
  role: "Vendedor" | "Manager" | "Admin" | "SuperAdmin";
  status: "Activo" | "Inactivo";
  avatar?: string;
  phone?: string;
  sales?: string;
  commission?: string;
};

function sign(payload: string) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("hex");
}

export function createSessionToken(user: SessionUser) {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function parseSessionToken(token?: string | null): SessionUser | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (sign(payload) !== signature) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
