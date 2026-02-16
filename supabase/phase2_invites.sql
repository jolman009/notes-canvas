-- Phase 2: Invite token model + policies
-- Run after phase1_collaboration_schema.sql

create table if not exists public.board_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  board_id uuid not null references public.boards(id) on delete cascade,
  role text not null check (role in ('editor', 'viewer')),
  expires_at timestamptz not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_board_invites_board_id on public.board_invites(board_id);
create index if not exists idx_board_invites_expires_at on public.board_invites(expires_at);

alter table public.board_invites enable row level security;

drop policy if exists "board_invites_owner_select" on public.board_invites;
create policy "board_invites_owner_select"
on public.board_invites
for select
to authenticated
using (public.is_board_owner(board_id));

drop policy if exists "board_invites_owner_insert" on public.board_invites;
create policy "board_invites_owner_insert"
on public.board_invites
for insert
to authenticated
with check (
  public.is_board_owner(board_id)
  and created_by = auth.uid()
  and expires_at > now()
);

drop policy if exists "board_invites_owner_delete" on public.board_invites;
create policy "board_invites_owner_delete"
on public.board_invites
for delete
to authenticated
using (public.is_board_owner(board_id));

-- Invite acceptance reads by token for authenticated users.
drop policy if exists "board_invites_authenticated_token_read" on public.board_invites;
create policy "board_invites_authenticated_token_read"
on public.board_invites
for select
to authenticated
using (expires_at > now());
