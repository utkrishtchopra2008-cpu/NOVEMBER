-- Apply in Supabase SQL editor before starting MODE=live.
-- Server-only persistence. Never connect with this DB credential from React.
create table if not exists public.vulnflow_analyses (
  id text primary key,
  owner_id text not null,
  version integer not null,
  data json not null
);
create index if not exists ix_vulnflow_analyses_owner_id on public.vulnflow_analyses(owner_id);
alter table public.vulnflow_analyses enable row level security;
revoke all on public.vulnflow_analyses from anon, authenticated;
-- No browser Data API policies: all access uses authenticated FastAPI endpoints.
-- FastAPI verifies Supabase Auth tokens and filters every operation by owner_id.
-- The server DB connection must have table access (e.g. Supabase postgres owner).
