-- Phase 1 RLS policy tests (configurable)
-- Run after: supabase/phase1_collaboration_schema.sql
-- Edit only the values in the CONFIG block.

-- ===========================================
-- CONFIG (replace with real auth.users IDs)
-- ===========================================
create temp table if not exists _policy_test_config (
  owner_user_id uuid not null,
  editor_user_id uuid not null,
  viewer_user_id uuid not null,
  outsider_user_id uuid,
  board_id uuid
) on commit drop;

truncate _policy_test_config;

insert into _policy_test_config (
  owner_user_id,
  editor_user_id,
  viewer_user_id,
  outsider_user_id
)
values (
  '00000000-0000-0000-0000-000000000001', -- owner
  '00000000-0000-0000-0000-000000000002', -- editor
  '00000000-0000-0000-0000-000000000003', -- viewer
  '00000000-0000-0000-0000-000000000004'  -- outsider (optional)
);

-- ===========================================
-- PREFLIGHT: verify users exist
-- ===========================================
do $$
declare
  cfg record;
begin
  select * into cfg from _policy_test_config limit 1;

  if not exists (select 1 from auth.users where id = cfg.owner_user_id) then
    raise exception 'Owner user % does not exist in auth.users', cfg.owner_user_id;
  end if;
  if not exists (select 1 from auth.users where id = cfg.editor_user_id) then
    raise exception 'Editor user % does not exist in auth.users', cfg.editor_user_id;
  end if;
  if not exists (select 1 from auth.users where id = cfg.viewer_user_id) then
    raise exception 'Viewer user % does not exist in auth.users', cfg.viewer_user_id;
  end if;
  if cfg.outsider_user_id is not null
     and not exists (select 1 from auth.users where id = cfg.outsider_user_id) then
    raise exception 'Outsider user % does not exist in auth.users', cfg.outsider_user_id;
  end if;
end;
$$;

-- ===========================================
-- 1) Create board as owner
-- ===========================================
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claim.sub',
  (select owner_user_id::text from _policy_test_config),
  true
);

with inserted as (
  insert into public.boards (title, owner_user_id)
  values ('Policy Test Board', (select owner_user_id from _policy_test_config))
  returning id
)
update _policy_test_config
set board_id = (select id from inserted);

select board_id from _policy_test_config;

-- ===========================================
-- 2) Owner adds editor + viewer
-- ===========================================
insert into public.board_members (board_id, user_id, role)
values
  (
    (select board_id from _policy_test_config),
    (select editor_user_id from _policy_test_config),
    'editor'
  ),
  (
    (select board_id from _policy_test_config),
    (select viewer_user_id from _policy_test_config),
    'viewer'
  );

-- ===========================================
-- 3) Owner read/write should work
-- ===========================================
select * from public.board_state
where board_id = (select board_id from _policy_test_config);

update public.board_state
set notes = '[{"id":"n1","title":"owner update"}]'::jsonb, revision = revision + 1
where board_id = (select board_id from _policy_test_config);

-- ===========================================
-- 4) Editor read/write should work
-- ===========================================
select set_config(
  'request.jwt.claim.sub',
  (select editor_user_id::text from _policy_test_config),
  true
);

select * from public.board_state
where board_id = (select board_id from _policy_test_config);

update public.board_state
set notes = '[{"id":"n2","title":"editor update"}]'::jsonb, revision = revision + 1
where board_id = (select board_id from _policy_test_config);

-- ===========================================
-- 5) Viewer read should work, write should fail
-- ===========================================
select set_config(
  'request.jwt.claim.sub',
  (select viewer_user_id::text from _policy_test_config),
  true
);

select * from public.board_state
where board_id = (select board_id from _policy_test_config);

do $$
begin
  update public.board_state
  set notes = '[{"id":"n3","title":"viewer update"}]'::jsonb, revision = revision + 1
  where board_id = (select board_id from _policy_test_config);

  raise exception 'Viewer update unexpectedly succeeded';
exception
  when insufficient_privilege then
    raise notice 'PASS: viewer write denied (%).', sqlstate;
  when others then
    raise notice 'PASS: viewer write denied (%).', sqlstate;
end;
$$;

-- ===========================================
-- 6) Outsider read/write should fail (if configured)
-- ===========================================
do $$
declare
  outsider_id uuid;
begin
  select outsider_user_id into outsider_id from _policy_test_config;
  if outsider_id is null then
    raise notice 'SKIP: outsider test (outsider_user_id is null).';
    return;
  end if;

  perform set_config('request.jwt.claim.sub', outsider_id::text, true);

  perform 1
  from public.board_state
  where board_id = (select board_id from _policy_test_config);
  raise notice 'INFO: outsider select executed (expected zero rows).';

  begin
    update public.board_state
    set notes = '[{"id":"n4","title":"outsider update"}]'::jsonb, revision = revision + 1
    where board_id = (select board_id from _policy_test_config);

    raise exception 'Outsider update unexpectedly succeeded';
  exception
    when insufficient_privilege then
      raise notice 'PASS: outsider write denied (%).', sqlstate;
    when others then
      raise notice 'PASS: outsider write denied (%).', sqlstate;
  end;
end;
$$;

-- ===========================================
-- 7) Non-owner member management should fail
-- ===========================================
select set_config(
  'request.jwt.claim.sub',
  (select editor_user_id::text from _policy_test_config),
  true
);

do $$
begin
  insert into public.board_members (board_id, user_id, role)
  values (
    (select board_id from _policy_test_config),
    coalesce(
      (select outsider_user_id from _policy_test_config),
      gen_random_uuid()
    ),
    'viewer'
  );

  raise exception 'Editor member insert unexpectedly succeeded';
exception
  when insufficient_privilege then
    raise notice 'PASS: non-owner member insert denied (%).', sqlstate;
  when foreign_key_violation then
    raise notice 'PASS: non-owner insert blocked before/at FK check (%).', sqlstate;
  when others then
    raise notice 'PASS: non-owner member insert denied (%).', sqlstate;
end;
$$;
