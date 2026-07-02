# Legacy Supabase SQL

These SQL files are archived from an earlier Supabase Auth and leaderboard design. They are not part of the current local setup path.

The current app uses:

- Auth.js credentials backed by `public.users`
- Drizzle schema in `lib/db/schema.ts`
- Committed Drizzle migrations in `drizzle/`

For a clean database, use:

```bash
docker compose up -d
npm run db:migrate
```

Do not apply the SQL in this directory to the current app database without first reworking it to match the active `public.users` schema. The existing SQL references Supabase `auth.users` and `auth.uid()`, which are not used by the runtime auth flow.
