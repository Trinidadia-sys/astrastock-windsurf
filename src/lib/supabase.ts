import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase environment variables are not set');
}

// Singleton — one instance for the entire app, prevents lock conflicts
let _client: ReturnType<typeof createClient> | null = null;

export const supabaseClient = (() => {
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _client;
})();

// Server-side client — only used in API routes, never exposed to the browser
// Use process.env directly (no NEXT_PUBLIC_ prefix) so it stays server-only
export const getServerSupabase = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(supabaseUrl, serviceKey);
};

// Database types
export interface WatchlistItem {
  id: string;
  user_id: string;
  symbol: string;
  name: string;
  created_at: string;
}

export interface ApiKey {
  id: string;
  user_id: string;
  service: 'openai';
  key_value: string;
  created_at: string;
}