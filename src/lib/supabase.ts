import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Handle build time when env vars might not be available
if (!supabaseUrl || !supabaseAnonKey) {
  if (typeof window !== 'undefined') {
    // Only throw in browser, not during build
    throw new Error('Supabase environment variables are not set');
  }
  // During build, we'll handle this gracefully
}

// Singleton — one instance for the entire app, prevents lock conflicts
let _client: ReturnType<typeof createClient> | null = null;

export const supabaseClient = (() => {
  if (!_client && supabaseUrl && supabaseAnonKey) {
    _client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _client;
})();

// Server-side client — only used in API routes, never exposed to the browser
// Use process.env directly (no NEXT_PUBLIC_ prefix) so it stays server-only
export const getServerSupabase = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !supabaseUrl) return null;
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