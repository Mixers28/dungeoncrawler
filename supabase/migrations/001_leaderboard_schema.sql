-- Create leaderboard_entries table
CREATE TABLE IF NOT EXISTS public.leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_name TEXT NOT NULL,
  character_class TEXT NOT NULL,
  deepest_floor INTEGER NOT NULL DEFAULT 1,
  gold_collected INTEGER NOT NULL DEFAULT 0,
  kill_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('win', 'loss')),
  completed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create user_profiles table for display names
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_user_id ON public.leaderboard_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_ranking ON public.leaderboard_entries(deepest_floor DESC, gold_collected DESC, kill_count DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_completed_at ON public.leaderboard_entries(user_id, completed_at DESC);

-- Enable Row Level Security
ALTER TABLE public.leaderboard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leaderboard_entries
-- Everyone can read leaderboard entries
CREATE POLICY "Anyone can view leaderboard entries"
  ON public.leaderboard_entries
  FOR SELECT
  USING (true);

-- Users can only insert their own entries
CREATE POLICY "Users can insert their own entries"
  ON public.leaderboard_entries
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own entries (optional, for corrections)
CREATE POLICY "Users can update their own entries"
  ON public.leaderboard_entries
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own entries (optional)
CREATE POLICY "Users can delete their own entries"
  ON public.leaderboard_entries
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for user_profiles
-- Everyone can read profiles (for display names on leaderboard)
CREATE POLICY "Anyone can view user profiles"
  ON public.user_profiles
  FOR SELECT
  USING (true);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Trigger to auto-update updated_at on user_profiles
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
