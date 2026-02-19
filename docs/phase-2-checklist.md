# Phase 2 Checklist: Invites, Board Routing, and Shared Access

## Scope
Phase 2 covers:
- Invite-token system
- Board-based persistence refactor
- Board selection and invite acceptance UX

## TODO
- [x] Add invite data model and SQL migration:
  - [x] Create `board_invites` table (`id`, `token`, `board_id`, `role`, `expires_at`, `created_by`, `created_at`)
  - [x] Add unique index on `token`
  - [x] Add index on `board_id`
  - [x] Add RLS policies for owner-only invite creation and authenticated invite reads
- [x] Implement invite server functions:
  - [x] `createInvite(board_id, role, expires_at)` owner-only
  - [x] `acceptInvite(token)` authenticated user joins `board_members`
  - [x] Enforce role constraints (`editor`/`viewer`, no invite-created owner)
  - [x] Enforce token expiration and idempotent acceptance
- [x] Refactor persistence from user-scoped to board-scoped:
  - [x] Replace `user:<user_id>` model with `board:<board_id>`
  - [x] Update load/save server functions to require `board_id`
  - [x] Validate membership server-side on every board read/write
- [x] Add board routes and navigation:
  - [x] Create route structure `/board/$boardId`
  - [x] Move existing canvas UI to board route
  - [x] Add board guard (redirect non-members)
- [x] Add board selection UX:
  - [x] Add "My Boards" route
  - [x] List boards where current user is a member
  - [x] Add create-board flow with initial owner membership
- [x] Add share/invite UX:
  - [x] Add Invite action in board UI
  - [x] Generate copyable invite link
  - [x] Add `/invite/$token` route for acceptance + redirect to board
- [x] Handle invite edge cases:
  - [x] Expired token UI
  - [x] Already a member UI
  - [x] Invalid token UI
  - [x] Unauthorized/unauthenticated redirect flow
- [x] Add migration/backfill script for existing data:
  - [x] Create default board for each existing user
  - [x] Move `app_state` user records into `board_state`
  - [x] Insert owner record in `board_members`
- [x] Add implementation notes after Phase 2 validation.

## Exit Criteria
- [x] Users can create multiple boards and open by `/board/$boardId`.
- [x] Owner can generate invite links and invited users can join board.
- [x] Only board members can read/write board data.
- [x] Board non-members are denied access and redirected safely.
- [x] Existing user notes are migrated to default board without data loss.

## Phase 2 Artifacts Added
- `src/server/board-store.ts`
- `src/components/BoardCanvas.tsx`
- `src/routes/boards.tsx`
- `src/routes/board.$boardId.tsx`
- `src/routes/invite.$token.tsx`
- `supabase/phase2_invites.sql`
- `supabase/phase2_backfill_from_app_state.sql`
