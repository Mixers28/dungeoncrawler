# Supabase Migrations

This directory contains database migration scripts for the Dungeon Portal project.

## Running Migrations

### Option 1: Supabase Dashboard (Recommended for Development)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `001_leaderboard_schema.sql`
4. Paste into the SQL editor and click **Run**
5. Verify tables were created in **Table Editor**

### Option 2: Supabase CLI

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link to your project
supabase link --project-ref <your-project-ref>

# Run migrations
supabase db push
```

### Option 3: Manual psql Connection

```bash
# Connect to your Supabase database
psql "postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Run migration file
\i supabase/migrations/001_leaderboard_schema.sql
```

## Rollback

If you need to undo a migration:

```bash
# Option 1: Supabase Dashboard
# Copy contents of rollback_001.sql and run in SQL Editor

# Option 2: psql
psql "postgresql://..." -f supabase/migrations/rollback_001.sql
```

## Verifying Installation

After running the migration, verify:

1. **Tables exist**: Check `leaderboard_entries` and `user_profiles` in Table Editor
2. **RLS enabled**: Both tables should show "RLS Enabled" badge
3. **Policies active**: Check Policies tab for each table
4. **Indexes created**: Run `\di` in psql or check Database > Indexes

## Testing RLS Policies

```sql
-- Test as anonymous user (should work - read only)
SELECT * FROM leaderboard_entries LIMIT 10;

-- Test as authenticated user (should work - insert own entries)
-- (Requires being signed in to Supabase)
INSERT INTO leaderboard_entries (user_id, character_name, character_class, deepest_floor, gold_collected, kill_count, status, completed_at)
VALUES (auth.uid(), 'Test Character', 'Fighter', 3, 150, 5, 'loss', NOW());

-- Test inserting for different user (should FAIL)
INSERT INTO leaderboard_entries (user_id, character_name, character_class, deepest_floor, gold_collected, kill_count, status, completed_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'Fake', 'Rogue', 1, 0, 0, 'loss', NOW());
-- Error: new row violates row-level security policy
```

## Migration History

- `001_leaderboard_schema.sql` - Initial leaderboard and user profiles schema with RLS
