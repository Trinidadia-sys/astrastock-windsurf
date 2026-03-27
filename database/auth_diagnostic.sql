-- Supabase Authentication Diagnostic Script
-- Run this to check authentication configuration

-- 1. Check if auth schema exists and has required tables
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_schema = 'auth' 
ORDER BY table_name;

-- 2. Check current authentication settings
SELECT name, setting 
FROM pg_settings 
WHERE name IN ('rls.enabled', 'session_replication_role', 'default_transaction_isolation');

-- 3. Check RLS status on our tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('watchlist', 'api_keys');

-- 4. Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('watchlist', 'api_keys')
ORDER BY tablename, policyname;

-- 5. Check for any existing users
SELECT id, email, created_at, last_sign_in_at 
FROM auth.users 
LIMIT 5;

-- 6. Check for any existing sessions
SELECT id, user_id, created_at, expires_at 
FROM auth.sessions 
LIMIT 5;

-- 7. Check database size and connections
SELECT 
  pg_size_pretty(pg_database_size(current_database())) as database_size,
  (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections;

-- 8. Check for any locks (might help identify the lock issue)
SELECT 
  locktype,
  database,
  relation,
  page,
  tuple,
  virtualxid,
  transactionid,
  classid,
  objid,
  objsubid,
  virtualtransaction,
  pid,
  mode,
  granted,
  fastpath
FROM pg_locks 
WHERE NOT pid = pg_backend_pid()
ORDER BY pid;

-- 9. Check if there are any authentication-related functions
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname LIKE '%auth%' 
OR proname LIKE '%session%'
OR proname LIKE '%token%'
LIMIT 10;

-- 10. Test basic permissions
SELECT 
  'authenticated_role' as role_name,
  has_table_privilege('authenticated', 'public.watchlist', 'SELECT') as can_select_watchlist,
  has_table_privilege('authenticated', 'public.watchlist', 'INSERT') as can_insert_watchlist,
  has_table_privilege('authenticated', 'public.watchlist', 'UPDATE') as can_update_watchlist,
  has_table_privilege('authenticated', 'public.watchlist', 'DELETE') as can_delete_watchlist;

SELECT 
  'anon_role' as role_name,
  has_table_privilege('anon', 'public.watchlist', 'SELECT') as can_select_watchlist,
  has_table_privilege('anon', 'public.watchlist', 'INSERT') as can_insert_watchlist,
  has_table_privilege('anon', 'public.watchlist', 'UPDATE') as can_update_watchlist,
  has_table_privilege('anon', 'public.watchlist', 'DELETE') as can_delete_watchlist;
