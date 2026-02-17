-- Phase 4 governance policy checks
-- Run after:
-- 1) supabase/phase1_collaboration_schema.sql
-- 2) supabase/phase4_governance_policies.sql
--
-- Fill in the config values before running.

create temp table if not exists _phase4_governance_cfg (
  board_id uuid not null,
  owner_user_id uuid not null,
  editor_user_id uuid not null,
  viewer_user_id uuid not null
) on commit drop;

truncate _phase4_governance_cfg;

insert into _phase4_governance_cfg (board_id, owner_user_id, editor_user_id, viewer_user_id)
values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003'
);

select set_config('request.jwt.claim.role', 'authenticated', true);

-- 1) Owner cannot demote owner membership row
select set_config(
  'request.jwt.claim.sub',
  (select owner_user_id::text from _phase4_governance_cfg),
  true
);

do $$
begin
  update public.board_members
  set role = 'editor'
  where board_id = (select board_id from _phase4_governance_cfg)
    and user_id = (select owner_user_id from _phase4_governance_cfg);

  raise exception 'Owner role downgrade unexpectedly succeeded';
exception
  when insufficient_privilege then
    raise notice 'PASS: owner row cannot be downgraded (%).', sqlstate;
  when others then
    raise notice 'PASS: owner row downgrade blocked (%).', sqlstate;
end;
$$;

-- 2) Owner can remove another member
select set_config(
  'request.jwt.claim.sub',
  (select owner_user_id::text from _phase4_governance_cfg),
  true
);

delete from public.board_members
where board_id = (select board_id from _phase4_governance_cfg)
  and user_id = (select viewer_user_id from _phase4_governance_cfg);

-- 3) Editor can leave board (delete own membership)
select set_config(
  'request.jwt.claim.sub',
  (select editor_user_id::text from _phase4_governance_cfg),
  true
);

delete from public.board_members
where board_id = (select board_id from _phase4_governance_cfg)
  and user_id = (select editor_user_id from _phase4_governance_cfg);
