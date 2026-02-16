# Phase 3 Checklist: Realtime Sync, Conflict Handling, and Hardening

## Scope
Phase 3 covers:
- Realtime collaborative sync
- Conflict handling and safer concurrent edits
- Security hardening and rollout validation

## TODO
- [ ] Add realtime board sync:
  - [ ] Subscribe to `board_state` changes filtered by `board_id`
  - [ ] Apply incoming updates to local canvas state
  - [ ] Ignore self-originated echoes where possible (`updated_by` check)
  - [ ] Add reconnect/resubscribe handling
- [ ] Add collaborator presence basics:
  - [ ] Define lightweight presence payload (user id, display name, last seen)
  - [ ] Track active users per board (Supabase Realtime presence or heartbeat table)
  - [ ] Show active collaborator indicators in board header
- [ ] Add optimistic save flow with rollback:
  - [ ] Keep local pending snapshot before save
  - [ ] Roll back local state on failed write
  - [ ] Surface actionable save errors in UI
- [ ] Add revision-based conflict handling:
  - [ ] Require expected `revision` during update
  - [ ] Reject stale writes with clear error code
  - [ ] On conflict, fetch latest board state and present resolution prompt
- [ ] Add conflict UX:
  - [ ] "Board updated elsewhere" notice
  - [ ] "Reload latest" action
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

## Exit Criteria
- [ ] Two authenticated collaborators can see near-realtime board updates.
- [ ] Stale writes are detected and handled without silent overwrites.
- [ ] Non-members cannot read/write board state, including realtime channels.
- [ ] Save failures and conflicts are visible and recoverable in UI.
- [ ] Test suite includes coverage for sync, conflict, and authorization paths.
