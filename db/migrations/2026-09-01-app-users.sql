-- Local login users — replaces Supabase Auth.
-- Apply on an existing volume (init scripts only run on fresh ones):
--   docker compose exec -T db psql -U officeless -d officeless < db/migrations/2026-09-01-app-users.sql
-- Then create a user:
--   node scripts/create-user.mjs email@example.com password "Name"

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
