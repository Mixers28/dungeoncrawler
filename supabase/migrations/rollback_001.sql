-- Rollback script for 001_leaderboard_schema.sql
-- Run this if you need to undo the leaderboard migration

-- Drop triggers
DROP TRIGGER IF EXISTS set_updated_at ON public.user_profiles;

-- Drop functions
DROP FUNCTION IF EXISTS public.handle_updated_at();

-- Drop policies
DROP POLICY IF EXISTS "Anyone can view leaderboard entries" ON public.leaderboard_entries;
DROP POLICY IF EXISTS "Users can insert their own entries" ON public.leaderboard_entries;
DROP POLICY IF EXISTS "Users can update their own entries" ON public.leaderboard_entries;
DROP POLICY IF EXISTS "Users can delete their own entries" ON public.leaderboard_entries;
DROP POLICY IF EXISTS "Anyone can view user profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;

-- Drop indexes
DROP INDEX IF EXISTS public.idx_leaderboard_entries_ranking;
DROP INDEX IF EXISTS public.idx_leaderboard_entries_user_completed;
DROP INDEX IF EXISTS public.idx_leaderboard_entries_user_best;

-- Drop tables
DROP TABLE IF EXISTS public.leaderboard_entries CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
