# Session ID Collaboration Rollout Plan

## Goal
Implement collaborative canvases using shareable session identifiers (board IDs / invite tokens) with secure access control and scalable sync.

## 12-Step Implementation Plan

1. Define collaboration model
- Decide roles: `owner`, `editor`, `viewer`.
- Decide invite behavior: one-time token vs reusable link.
- Decide whether anonymous invite access is allowed (recommended: no).

2. Add database schema
- Create `boards` table: `id`, `title`, `owner_user_id`, `created_at`.
- Create `board_members` table: `board_id`, `user_id`, `role`, `created_at`.
- Create `board_state` table: `board_id`, `notes`, `updated_at`.
- Create indexes on `board_members.user_id` and `board_state.board_id`.

3. Add RLS policies
- Allow select/update on `board_state` only for users in `board_members`.
- Allow board management only for owners.
- Allow member insert/delete only by owners (or admins).

4. Add invite-token system
- Create `board_invites` table: `token`, `board_id`, `role`, `expires_at`, `created_by`.
- Add server function to create invite token (owner-only).
- Add server function to accept invite token and insert into `board_members`.

5. Refactor persistence layer
- Replace `user:<user_id>` storage key with `board:<board_id>`.
- Update load/save server functions to require `board_id`.
- Validate membership on every load/save call server-side.

6. Add board selection UX
- Add "My Boards" page: list boards user belongs to.
- Add create-board flow.
- Add route structure like `/board/$boardId`.

7. Add share UX
- Add "Invite" button in board header.
- Generate copyable invite link with token.
- Add `/invite/$token` route to accept and redirect to board.

8. Add realtime sync
- Subscribe to `board_state` changes (Supabase Realtime) by `board_id`.
- Merge incoming state with local changes (last-write-wins initially).
- Show collaborator presence/status indicator (optional first pass).

9. Add conflict handling
- Add optimistic updates with rollback on save failure.
- Add lightweight version field (`revision`) to prevent silent overwrites.
- Surface "board updated elsewhere" notifications.

10. Security hardening
- Remove anon write access to board tables.
- Enforce authenticated access everywhere.
- Rotate keys and confirm env usage in server-only code.

11. Migration and backfill
- Create default board per existing user.
- Move existing `user:<user_id>` notes into `board_state`.
- Insert owner into `board_members`.

12. Testing and rollout
- Unit test membership checks and invite acceptance.
- Integration test: owner invites user, invited user edits same board.
- Manual QA on create/invite/join/edit/logout/login paths.
