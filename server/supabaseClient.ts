// ============================================================
// Matric Mind AI - Supabase Client
// Shared Supabase client factory for server-side API routes
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;

/**
 * Returns a shared Supabase client instance using the service role key.
 * Returns null if required environment variables are missing.
 */
export function getSupabase(): SupabaseClient | null {
  if (_supabase) return _supabase;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Database features unavailable.');
    return null;
  }

  try {
    _supabase = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    return _supabase;
  } catch (error) {
    console.error('Failed to create Supabase client:', error);
    return null;
  }
}
