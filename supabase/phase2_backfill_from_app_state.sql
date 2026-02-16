-- Phase 2: Backfill from legacy app_state -> boards/board_state
-- Run after:
-- 1) supabase/phase1_collaboration_schema.sql
-- 2) supabase/phase2_invites.sql
--
-- This script is idempotent and safe to run multiple times.

-- Ensure every board has owner membership + state row.
insert into public.board_members (board_id, user_id, role)
select b.id, b.owner_user_id, 'owner'
from public.boards b
on conflict (board_id, user_id) do nothing;

insert into public.board_state (board_id, notes, revision, updated_by)
select b.id, '[]'::jsonb, 0, b.owner_user_id
from public.boards b
where not exists (
  select 1
  from public.board_state bs
  where bs.board_id = b.id
);

-- Create one default board for users that do not already own a board.
insert into public.boards (title, owner_user_id)
select 'My Board', u.id
from auth.users u
where not exists (
  select 1
  from public.boards b
  where b.owner_user_id = u.id
);

-- Migrate legacy app_state rows that match either:
-- - user:<uuid>
-- - <uuid>
with parsed_app_state as (
  select
    case
      when a.id ~ '^user:[0-9a-fA-F-]{36}$' then substring(a.id from 6)::uuid
      when a.id ~ '^[0-9a-fA-F-]{36}$' then a.id::uuid
      else null
    end as user_id,
    a.notes,
    a.updated_at
  from public.app_state a
),
source_rows as (
  select
    p.user_id,
    p.notes,
    p.updated_at
  from parsed_app_state p
  where p.user_id is not null
),
target_board as (
  select
    s.user_id,
    s.notes,
    s.updated_at,
    b.id as board_id
  from source_rows s
  join lateral (
    select id
    from public.boards
    where owner_user_id = s.user_id
    order by created_at asc
    limit 1
  ) b on true
)
insert into public.board_state (board_id, notes, revision, updated_at, updated_by)
select
  t.board_id,
  coalesce(t.notes, '[]'::jsonb),
  1,
  coalesce(t.updated_at, now()),
  t.user_id
from target_board t
on conflict (board_id) do update
set
  notes = excluded.notes,
  revision = case
    when public.board_state.revision < 1 then 1
    else public.board_state.revision
  end,
  updated_at = greatest(public.board_state.updated_at, excluded.updated_at),
  updated_by = coalesce(excluded.updated_by, public.board_state.updated_by)
where
  public.board_state.revision = 0
  or public.board_state.notes = '[]'::jsonb;
