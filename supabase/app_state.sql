create table if not exists public.app_state (
  id text primary key,
  notes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "anon_read_app_state" on public.app_state;
create policy "anon_read_app_state"
on public.app_state
for select
to anon
using (true);

drop policy if exists "anon_write_app_state" on public.app_state;
create policy "anon_write_app_state"
on public.app_state
for insert
to anon
with check (true);

drop policy if exists "anon_update_app_state" on public.app_state;
create policy "anon_update_app_state"
on public.app_state
for update
to anon
using (true)
with check (true);
