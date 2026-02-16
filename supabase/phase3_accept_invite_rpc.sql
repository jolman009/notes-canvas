-- Phase 3: Invite acceptance RPC (fixes RLS conflict on board_members insert)
-- Run in Supabase SQL Editor after phase1/phase2 scripts.

create or replace function public.accept_board_invite(invite_token text)
returns table(board_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.board_invites%rowtype;
  membership_exists boolean;
  accepted_board_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select *
  into invite_row
  from public.board_invites
  where token = invite_token
  limit 1;

  if invite_row.id is null then
    raise exception 'INVITE_INVALID';
  end if;

  if invite_row.expires_at <= now() then
    raise exception 'INVITE_EXPIRED';
  end if;

  if invite_row.role not in ('editor', 'viewer') then
    raise exception 'INVITE_ROLE_INVALID';
  end if;

  accepted_board_id := invite_row.board_id;

  select exists (
    select 1
    from public.board_members bm
    where bm.board_id = accepted_board_id
      and bm.user_id = auth.uid()
  )
  into membership_exists;

  if membership_exists then
    return query
    select accepted_board_id as board_id, 'already_member'::text as status;
    return;
  end if;

  insert into public.board_members (board_id, user_id, role)
  values (accepted_board_id, auth.uid(), invite_row.role)
  on conflict on constraint board_members_pkey do nothing;

  return query
  select accepted_board_id as board_id, 'joined'::text as status;
end;
$$;

revoke all on function public.accept_board_invite(text) from public;
grant execute on function public.accept_board_invite(text) to authenticated;
