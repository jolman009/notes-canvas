# Phase 3 Checklist: Realtime Sync, Conflict Handling, and Hardening

## Scope
Phase 3 covers:
- Realtime collaborative sync
- Conflict handling and safer concurrent edits
- Security hardening and rollout validation

## TODO
- [x] Add realtime board sync:
  - [x] Subscribe to `board_state` changes filtered by `board_id`
  - [x] Apply incoming updates to local canvas state
  - [x] Ignore self-originated echoes where possible (`updated_by` check)
  - [x] Add reconnect/resubscribe handling
- [x] Add collaborator presence basics:
  - [x] Define lightweight presence payload (user id, display name, last seen)
  - [x] Track active users per board (Supabase Realtime presence or heartbeat table)
  - [x] Show active collaborator indicators in board header
- [x] Add optimistic save flow with rollback:
  - [x] Keep local pending snapshot before save
  - [x] Roll back local state on failed write
  - [x] Surface actionable save errors in UI
- [x] Add revision-based conflict handling:
  - [x] Require expected `revision` during update
  - [x] Reject stale writes with clear error code
  - [x] On conflict, fetch latest board state and present resolution prompt
- [x] Add conflict UX:
  - [x] "Board updated elsewhere" notice
  - [x] "Reload latest" action
  - [x] Optional "Keep mine" retry path for owner/editor
- [x] Harden access/security paths:
  - [x] Ensure no anon access is used by board APIs
  - [x] Confirm all board reads/writes are authenticated and membership-guarded
  - [x] Add invite token lifecycle controls (single-use or explicit revoke flow)
  - [x] Add server-side validation for all invite/board inputs
- [x] Add observability:
  - [x] Add structured logging around invite acceptance failures and board write conflicts
  - [x] Add basic counters for sync failures and conflict events
- [x] Add automated tests:
  - [x] Unit tests for revision/conflict logic
  - [x] Integration test: two users edit same board concurrently
  - [x] Integration test: unauthorized/non-member realtime/write attempts denied
- [x] Add manual QA matrix:
  - [x] Owner + editor simultaneous edit behavior
  - [x] Viewer realtime read-only behavior
  - [x] Network drop/reconnect during active editing
  - [x] Invite acceptance + immediate realtime propagation
- [x] Add implementation notes after Phase 3 validation.

## In-Progress Notes
- Implemented Supabase Realtime subscription for `board_state` in `src/routes/board.$boardId.tsx`.
- Kept polling as fallback safety net (slower interval when realtime is connected).
- Added reconnect resync handling via browser `online` event + immediate snapshot reload.
- Added revision-aware server writes in `src/server/board-store.ts` to reject stale updates.
- Added conflict recovery in board UI by reloading latest snapshot after conflict.
- Added optimistic rollback to last synced state when save fails (access/network path).
- Added realtime collaborator presence tracking and header indicators.
- Added owner invite lifecycle controls with revoke action in board UI.
- Added unit tests in `src/lib/collab.test.ts` for revision and self-update helpers.
- Added integration tests in `src/server/board-store.integration.test.ts` for conflict and non-member denial.

## Exit Criteria
- [x] Two authenticated collaborators can see near-realtime board updates.
- [x] Stale writes are detected and handled without silent overwrites.
- [x] Non-members cannot read/write board state, including realtime channels.
- [x] Save failures and conflicts are visible and recoverable in UI.
- [x] Test suite includes coverage for sync, conflict, and authorization paths.

