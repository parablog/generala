create table if not exists public.generala_games (
  id uuid primary key,
  created_at timestamptz not null default now(),
  payload jsonb not null,
  constraint payload_is_object check (jsonb_typeof(payload) = 'object'),
  constraint payload_size check (octet_length(payload::text) <= 32768)
);

alter table public.generala_games enable row level security;

revoke all on table public.generala_games from anon, authenticated;

create index if not exists generala_games_created_at_idx
  on public.generala_games (created_at desc);
