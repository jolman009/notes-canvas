-- Phase 1: Collaboration foundation schema + baseline RLS
-- Run in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled Board',
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.board_members (
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create table if not exists public.board_state (
  board_id uuid primary key references public.boards(id) on delete cascade,
  notes jsonb not null default '[]'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_board_members_user_id on public.board_members(user_id);
create index if not exists idx_board_members_board_id on public.board_members(board_id);
create index if not exists idx_board_state_board_id on public.board_state(board_id);

-- Enforce a single owner member row per board.
create unique index if not exists idx_board_members_single_owner
  on public.board_members(board_id)
  where role = 'owner';

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_boards_updated_at on public.boards;
create trigger trg_boards_updated_at
before update on public.boards
for each row
execute function public.set_updated_at_timestamp();

drop trigger if exists trg_board_state_updated_at on public.board_state;
create trigger trg_board_state_updated_at
before update on public.board_state
for each row
execute function public.set_updated_at_timestamp();

-- Automatically insert owner membership + initial state when a board is created.
create or replace function public.handle_new_board()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.board_members(board_id, user_id, role)
  values (new.id, new.owner_user_id, 'owner')
  on conflict do nothing;

  insert into public.board_state(board_id, notes, revision, updated_by)
  values (new.id, '[]'::jsonb, 0, new.owner_user_id)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_handle_new_board on public.boards;
create trigger trg_handle_new_board
after insert on public.boards
for each row
execute function public.handle_new_board();

alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.board_state enable row level security;

-- Helper predicates for cleaner policy definitions.
create or replace function public.is_board_member(target_board uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.board_members bm
    where bm.board_id = target_board
      and bm.user_id = auth.uid()
  );
$$;

create or replace function public.is_board_owner(target_board uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.boards b
    where b.id = target_board
      and b.owner_user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_board(target_board uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.board_members bm
    where bm.board_id = target_board
      and bm.user_id = auth.uid()
      and bm.role in ('owner', 'editor')
  );
$$;

-- Boards policies
drop policy if exists "boards_select_member" on public.boards;
create policy "boards_select_member"
on public.boards
for select
to authenticated
using (
  owner_user_id = auth.uid()
  or public.is_board_member(id)
);

drop policy if exists "boards_insert_owner" on public.boards;
create policy "boards_insert_owner"
on public.boards
for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists "boards_update_owner_only" on public.boards;
create policy "boards_update_owner_only"
on public.boards
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists "boards_delete_owner_only" on public.boards;
create policy "boards_delete_owner_only"
on public.boards
for delete
to authenticated
using (owner_user_id = auth.uid());

-- Board members policies
drop policy if exists "board_members_select_member" on public.board_members;
create policy "board_members_select_member"
on public.board_members
for select
to authenticated
using (public.is_board_member(board_id));

drop policy if exists "board_members_insert_owner_only" on public.board_members;
create policy "board_members_insert_owner_only"
on public.board_members
for insert
to authenticated
with check (
  public.is_board_owner(board_id)
  and role in ('owner', 'editor', 'viewer')
  and (role <> 'owner' or user_id = (select owner_user_id from public.boards where id = board_id))
);

drop policy if exists "board_members_update_owner_only" on public.board_members;
create policy "board_members_update_owner_only"
on public.board_members
for update
to authenticated
using (public.is_board_owner(board_id))
with check (
  public.is_board_owner(board_id)
  and role in ('owner', 'editor', 'viewer')
  and (role <> 'owner' or user_id = (select owner_user_id from public.boards where id = board_id))
);

drop policy if exists "board_members_delete_owner_only" on public.board_members;
create policy "board_members_delete_owner_only"
on public.board_members
for delete
to authenticated
using (
  public.is_board_owner(board_id)
  and user_id <> auth.uid()
);

-- Board state policies
drop policy if exists "board_state_select_member" on public.board_state;
create policy "board_state_select_member"
on public.board_state
for select
to authenticated
using (public.is_board_member(board_id));

drop policy if exists "board_state_insert_editor_owner" on public.board_state;
create policy "board_state_insert_editor_owner"
on public.board_state
for insert
to authenticated
with check (public.can_edit_board(board_id));

drop policy if exists "board_state_update_editor_owner" on public.board_state;
create policy "board_state_update_editor_owner"
on public.board_state
for update
to authenticated
using (public.can_edit_board(board_id))
with check (public.can_edit_board(board_id));

