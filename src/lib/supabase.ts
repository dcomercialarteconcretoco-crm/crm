import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;
let _configHash = '';

function getConfig(): { url: string; key: string } {
    if (typeof window === 'undefined') {
        return {
            url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        };
    }
    try {
        const s = JSON.parse(localStorage.getItem('crm_settings') || '{}');
        return {
            url: s.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            key: s.supabaseKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        };
    } catch {
        return {
            url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        };
    }
}

/**
 * Returns a Supabase client if credentials are configured, otherwise null.
 * Caches the client and reuses it as long as credentials don't change.
 */
export function getSupabase(): SupabaseClient | null {
    const { url, key } = getConfig();
    if (!url || !key) return null;

    const hash = `${url}||${key}`;
    if (_client && _configHash === hash) return _client;

    _client = createClient(url, key);
    _configHash = hash;
    return _client;
}

/**
 * Call this when Supabase credentials are updated in Settings
 * so the next getSupabase() call creates a fresh client.
 */
export function resetSupabaseClient(): void {
    _client = null;
    _configHash = '';
}
