-- Phase 4: Invite lifecycle hardening
-- Run after:
-- 1) supabase/phase1_collaboration_schema.sql
-- 2) supabase/phase2_invites.sql
-- 3) supabase/phase3_accept_invite_rpc.sql (optional, this script replaces it)

alter table public.board_invites
  add column if not exists is_reusable boolean not null default false,
  add column if not exists accepted_count integer not null default 0,
  add column if not exists last_accepted_by uuid references auth.users(id) on delete set null,
  add column if not exists last_accepted_at timestamptz,
  add column if not exists revoked_at timestamptz;

create index if not exists idx_board_invites_revoked_at on public.board_invites(revoked_at);

drop policy if exists "board_invites_owner_update" on public.board_invites;
create policy "board_invites_owner_update"
on public.board_invites
for update
to authenticated
using (public.is_board_owner(board_id))
with check (public.is_board_owner(board_id));

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

  if invite_row.revoked_at is not null then
    raise exception 'INVITE_REVOKED';
  end if;

  if invite_row.expires_at <= now() then
    raise exception 'INVITE_EXPIRED';
  end if;

  if not invite_row.is_reusable and invite_row.accepted_count > 0 then
    raise exception 'INVITE_USED';
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

  update public.board_invites
  set
    accepted_count = accepted_count + 1,
    last_accepted_by = auth.uid(),
    last_accepted_at = now(),
    revoked_at = case when is_reusable then revoked_at else coalesce(revoked_at, now()) end
  where id = invite_row.id;

  return query
  select accepted_board_id as board_id, 'joined'::text as status;
end;
$$;

revoke all on function public.accept_board_invite(text) from public;
grant execute on function public.accept_board_invite(text) to authenticated;
