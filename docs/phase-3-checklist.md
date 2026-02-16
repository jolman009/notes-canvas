# Phase 3 Checklist: Realtime Sync, Conflict Handling, and Hardening

## Scope
Phase 3 covers:
- Realtime collaborative sync
- Conflict handling and safer concurrent edits
- Security hardening and rollout validation

## TODO
- [ ] Add realtime board sync:
  - [x] Subscribe to `board_state` changes filtered by `board_id`
  - [x] Apply incoming updates to local canvas state
  - [x] Ignore self-originated echoes where possible (`updated_by` check)
  - [x] Add reconnect/resubscribe handling
- [ ] Add collaborator presence basics:
  - [ ] Define lightweight presence payload (user id, display name, last seen)
  - [ ] Track active users per board (Supabase Realtime presence or heartbeat table)
  - [ ] Show active collaborator indicators in board header
- [ ] Add optimistic save flow with rollback:
  - [x] Keep local pending snapshot before save
  - [x] Roll back local state on failed write
  - [x] Surface actionable save errors in UI
- [ ] Add revision-based conflict handling:
  - [x] Require expected `revision` during update
  - [x] Reject stale writes with clear error code
  - [x] On conflict, fetch latest board state and present resolution prompt
- [ ] Add conflict UX:
  - [x] "Board updated elsewhere" notice
  - [x] "Reload latest" action
  - [ ] Optional "Keep mine" retry path for owner/editor
- [ ] Harden access/security paths:
  - [ ] Ensure no anon access is used by board APIs
  - [ ] Confirm all board reads/writes are authenticated and membership-guarded
  - [ ] Add invite token lifecycle controls (single-use or explicit revoke flow)
  - [ ] Add server-side validation for all invite/board inputs
- [ ] Add observability:
  - [ ] Add structured logging around invite acceptance failures and board write conflicts
  - [ ] Add basic counters for sync failures and conflict events
- [ ] Add automated tests:
  - [ ] Unit tests for revision/conflict logic
  - [ ] Integration test: two users edit same board concurrently
  - [ ] Integration test: unauthorized/non-member realtime/write attempts denied
- [ ] Add manual QA matrix:
  - [ ] Owner + editor simultaneous edit behavior
  - [ ] Viewer realtime read-only behavior
  - [ ] Network drop/reconnect during active editing
  - [ ] Invite acceptance + immediate realtime propagation
- [ ] Add implementation notes after Phase 3 validation.

## In-Progress Notes
- Implemented Supabase Realtime subscription for `board_state` in `src/routes/board.$boardId.tsx`.
- Kept polling as fallback safety net (slower interval when realtime is connected).
- Added reconnect resync handling via browser `online` event + immediate snapshot reload.
- Added revision-aware server writes in `src/server/board-store.ts` to reject stale updates.
- Added conflict recovery in board UI by reloading latest snapshot after conflict.
- Added optimistic rollback to last synced state when save fails (access/network path).

## Exit Criteria
- [ ] Two authenticated collaborators can see near-realtime board updates.
- [ ] Stale writes are detected and handled without silent overwrites.
- [ ] Non-members cannot read/write board state, including realtime channels.
- [ ] Save failures and conflicts are visible and recoverable in UI.
- [ ] Test suite includes coverage for sync, conflict, and authorization paths.
