-- Phase 4: governance policy hardening
-- Run after:
-- 1) supabase/phase1_collaboration_schema.sql
-- 2) supabase/phase2_invites.sql
-- 3) supabase/phase3_accept_invite_rpc.sql

-- Prevent owner membership row from being downgraded without explicit ownership transfer flow.
drop policy if exists "board_members_update_owner_only" on public.board_members;
create policy "board_members_update_owner_only"
on public.board_members
for update
to authenticated
using (public.is_board_owner(board_id))
with check (
  public.is_board_owner(board_id)
  and role in ('owner', 'editor', 'viewer')
  and (
    user_id <> (select owner_user_id from public.boards where id = board_id)
    or role = 'owner'
  )
);

-- Allow non-owner members to leave a board (delete their own editor/viewer membership).
-- Owners can still remove non-owner members.
drop policy if exists "board_members_delete_owner_only" on public.board_members;
create policy "board_members_delete_owner_or_self"
on public.board_members
for delete
to authenticated
using (
  (
    public.is_board_owner(board_id)
    and user_id <> (select owner_user_id from public.boards where id = board_id)
  )
  or (
    user_id = auth.uid()
    and role in ('editor', 'viewer')
  )
);
