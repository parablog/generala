create table if not exists public.generala_games (
  id uuid primary key,
  created_at timestamptz not null default now(),
  payload jsonb not null,
  constraint payload_is_object check (jsonb_typeof(payload) = 'object'),
  constraint payload_size check (octet_length(payload::text) <= 32768)
);

alter table public.generala_games enable row level security;

-- Household app: Supabase blocks secret keys in browsers, so the publishable
-- key is the shared credential and anon gets scoped access to this table only.
revoke all on table public.generala_games from anon, authenticated;
grant select, insert, delete on table public.generala_games to anon;

drop policy if exists "household access" on public.generala_games;
create policy "household access" on public.generala_games
  for all to anon using (true) with check (true);

create index if not exists generala_games_created_at_idx
  on public.generala_games (created_at desc);
