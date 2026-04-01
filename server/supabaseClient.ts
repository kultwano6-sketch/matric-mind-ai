// Shared Supabase client for API routes — handles missing env vars gracefully
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;
let _warned = false;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    if (!_warned) {
      console.warn('[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — DB features disabled');
      _warned = true;
    }
    return null;
  }

  if (!_supabase) {
    _supabase = createClient(url, key);
  }

  return _supabase;
}

// Helper that throws a readable error if supabase isn't configured
export function requireSupabase(): SupabaseClient {
  const client = getSupabase();
  if (!client) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  return client;
}
