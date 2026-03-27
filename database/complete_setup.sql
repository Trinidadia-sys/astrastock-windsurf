-- Complete Supabase Database Setup for AstraStock
-- Run this in your Supabase SQL Editor

-- 1. Create watchlist table
CREATE TABLE IF NOT EXISTS public.watchlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create API keys table (for future use)
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN ('openai')),
  key_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_watchlist_user_id ON public.watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_symbol ON public.watchlist(symbol);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_service ON public.api_keys(service);

-- 4. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for watchlist table
CREATE POLICY "Users can view own watchlist" ON public.watchlist
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watchlist" ON public.watchlist
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watchlist" ON public.watchlist
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own watchlist" ON public.watchlist
  FOR DELETE USING (auth.uid() = user_id);

-- 6. Create RLS policies for api_keys table
CREATE POLICY "Users can view own API keys" ON public.api_keys
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own API keys" ON public.api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys" ON public.api_keys
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys" ON public.api_keys
  FOR DELETE USING (auth.uid() = user_id);

-- 7. Grant necessary permissions
-- Watchlist permissions
GRANT ALL ON public.watchlist TO authenticated;
GRANT SELECT ON public.watchlist TO anon;

-- API keys permissions (more restrictive)
GRANT ALL ON public.api_keys TO authenticated;
-- No anon access for API keys

-- 8. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Create trigger for api_keys updated_at
CREATE OR REPLACE TRIGGER handle_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 10. Add helpful comments
COMMENT ON TABLE public.watchlist IS 'User watchlist for tracking stocks';
COMMENT ON TABLE public.api_keys IS 'API keys for external services';

-- 11. Verify setup
SELECT 'Watchlist table created successfully' as status,
       (SELECT COUNT(*) FROM public.watchlist) as watchlist_count
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'watchlist' AND table_schema = 'public');

SELECT 'API keys table created successfully' as status,
       (SELECT COUNT(*) FROM public.api_keys) as api_keys_count
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_keys' AND table_schema = 'public');

-- 12. Check RLS status
SELECT table_name, row_level_security 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('watchlist', 'api_keys');
