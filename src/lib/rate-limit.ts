/**
 * Simple in-memory rate limiter for public API endpoints.
 * Resets on cold start (Vercel serverless). Good enough for spam protection.
 */

const store = new Map<string, { count: number; resetAt: number }>();

const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX_REQUESTS = 10;  // max per IP per window

export function rateLimit(
    ip: string,
    opts: { maxRequests?: number; windowMs?: number; key?: string } = {}
): { ok: boolean; retryAfter: number } {
    const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
    const maxRequests = opts.maxRequests ?? DEFAULT_MAX_REQUESTS;
    const key = opts.key ? `${opts.key}:${ip}` : ip;
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return { ok: true, retryAfter: 0 };
    }

    entry.count++;
    if (entry.count > maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return { ok: false, retryAfter };
    }

    return { ok: true, retryAfter: 0 };
}
