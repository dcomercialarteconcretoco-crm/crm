/**
 * Simple in-memory rate limiter for public API endpoints.
 * Resets on cold start (Vercel serverless). Good enough for spam protection.
 */

const store = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 10;  // max per IP per window

export function rateLimit(ip: string): { ok: boolean; retryAfter: number } {
    const now = Date.now();
    const key = ip;
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return { ok: true, retryAfter: 0 };
    }

    entry.count++;
    if (entry.count > MAX_REQUESTS) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        return { ok: false, retryAfter };
    }

    return { ok: true, retryAfter: 0 };
}
