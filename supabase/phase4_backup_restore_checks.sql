-- Phase 4: Backup and restore validation checks
-- Run after restore into a staging/restore database.

-- 1) Row count snapshot
select
  (select count(*) from public.boards) as boards,
  (select count(*) from public.board_members) as members,
  (select count(*) from public.board_state) as board_states,
  (select count(*) from public.board_invites) as invites;

-- 2) Referential integrity spot checks
-- board_members should map to valid boards
select count(*) as orphan_member_rows
from public.board_members m
left join public.boards b on b.id = m.board_id
where b.id is null;

-- board_state should map to valid boards
select count(*) as orphan_state_rows
from public.board_state s
left join public.boards b on b.id = s.board_id
where b.id is null;

-- invites should map to valid boards
select count(*) as orphan_invite_rows
from public.board_invites i
left join public.boards b on b.id = i.board_id
where b.id is null;

-- 3) Ownership consistency
select count(*) as boards_missing_owner_membership
from public.boards b
where not exists (
  select 1
  from public.board_members m
  where m.board_id = b.id
    and m.user_id = b.owner_user_id
    and m.role = 'owner'
);

-- 4) Basic state sanity
select
  count(*) filter (where revision < 0) as negative_revisions,
  count(*) filter (where notes is null) as null_notes
from public.board_state;
