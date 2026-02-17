-- Phase 4: ownership transfer RPC
-- Run after:
-- 1) supabase/phase1_collaboration_schema.sql
-- 2) supabase/phase4_governance_policies.sql

create or replace function public.transfer_board_ownership(
  target_board_id uuid,
  new_owner_user_id uuid
)
returns table(board_id uuid, new_owner_user_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_owner_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if target_board_id is null or new_owner_user_id is null then
    raise exception 'INVALID_INPUT';
  end if;

  select b.owner_user_id
  into current_owner_user_id
  from public.boards b
  where b.id = target_board_id
  for update;

  if current_owner_user_id is null then
    raise exception 'BOARD_NOT_FOUND';
  end if;

  if current_owner_user_id <> auth.uid() then
    raise exception 'ONLY_OWNER_CAN_TRANSFER';
  end if;

  if new_owner_user_id = current_owner_user_id then
    raise exception 'NEW_OWNER_SAME';
  end if;

  if not exists (
    select 1
    from public.board_members bm
    where bm.board_id = target_board_id
      and bm.user_id = new_owner_user_id
  ) then
    raise exception 'NEW_OWNER_MUST_BE_MEMBER';
  end if;

  update public.boards
  set owner_user_id = new_owner_user_id
  where id = target_board_id
    and owner_user_id = current_owner_user_id;

  update public.board_members
  set role = 'editor'
  where board_id = target_board_id
    and user_id = current_owner_user_id
    and role = 'owner';

  update public.board_members
  set role = 'owner'
  where board_id = target_board_id
    and user_id = new_owner_user_id;

  return query
  select target_board_id, new_owner_user_id;
end;
$$;

revoke all on function public.transfer_board_ownership(uuid, uuid) from public;
grant execute on function public.transfer_board_ownership(uuid, uuid) to authenticated;
