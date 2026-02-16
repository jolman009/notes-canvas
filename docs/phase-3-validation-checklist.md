# Phase 3 Validation Script and Checklist

## Goal
Validate realtime collaboration, conflict handling, security behavior, and rollout readiness for Phase 3.

## Preconditions
- [ ] App is running locally (`npm run dev`).
- [ ] Supabase tables + RLS from Phase 1/2 are applied.
- [ ] Environment variables are set for realtime client:
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] At least 3 test users exist:
  - [ ] `owner`
  - [ ] `editor`
  - [ ] `viewer` or `outsider`

## Automated Checks
Run these first:

```bash
npm run test
npm run build
```

Expected:
- `test`: all tests pass.
- `build`: completes successfully.

## Manual Test Script

### 1) Realtime update propagation
- [ ] Open same board as `owner` and `editor` in separate browser sessions.
- [ ] Edit a note as `owner`.
- [ ] Confirm `editor` sees update without refresh.
- [ ] Header should show `Live` on both sessions.

Result:
- [ ] Pass
- [ ] Fail
Notes:

### 2) Presence indicators
- [ ] Keep both sessions on same board.
- [ ] Confirm `Online` count increases.
- [ ] Confirm active user labels appear.
- [ ] Close one session and confirm count/list updates.

Result:
- [ ] Pass
- [ ] Fail
Notes:

### 3) Conflict handling
- [ ] In both sessions, edit the same note field nearly simultaneously.
- [ ] Confirm stale write is detected (conflict notice appears).
- [ ] Confirm board reloads latest snapshot.
- [ ] Click `Keep mine` and verify draft re-apply path works.

Result:
- [ ] Pass
- [ ] Fail
Notes:

### 4) Viewer read-only behavior
- [ ] Invite a `viewer` user to board.
- [ ] Open board as `viewer`.
- [ ] Attempt to edit note.
- [ ] Confirm write is blocked and user-facing read-only/save failure message appears.

Result:
- [ ] Pass
- [ ] Fail
Notes:

### 5) Non-member denial
- [ ] Use `outsider` account that is not a member.
- [ ] Navigate to `/board/<boardId>` directly.
- [ ] Confirm access is denied (redirect or friendly error).
- [ ] Confirm no data is exposed.

Result:
- [ ] Pass
- [ ] Fail
Notes:

### 6) Invite lifecycle controls (owner)
- [ ] As owner, create invite link.
- [ ] Confirm invite appears in active invites list.
- [ ] Revoke invite.
- [ ] Confirm invite disappears from list.
- [ ] Confirm revoked link no longer grants access.

Result:
- [ ] Pass
- [ ] Fail
Notes:

### 7) Reconnect behavior
- [ ] While board open, disconnect network temporarily.
- [ ] Edit a note and confirm failure state appears.
- [ ] Reconnect network.
- [ ] Confirm app resyncs latest board state and returns to live behavior.

Result:
- [ ] Pass
- [ ] Fail
Notes:

## Security/Policy Spot Checks
- [ ] Verify board API calls use authenticated Bearer tokens.
- [ ] Verify no anon token path is used for board reads/writes.
- [ ] Verify only owner can create/revoke invites.
- [ ] Verify member role gates behavior (`owner/editor` can edit, `viewer` cannot).

## Observability Spot Checks
- [ ] Confirm conflict counter increments on conflict.
- [ ] Confirm sync failure counter increments on failed save.
- [ ] Confirm server logs contain invite and conflict events.

## Exit Criteria Sign-off
- [ ] Two authenticated collaborators can see near-realtime board updates.
- [ ] Stale writes are detected and handled without silent overwrites.
- [ ] Non-members cannot read/write board state, including realtime channels.
- [ ] Save failures and conflicts are visible and recoverable in UI.
- [ ] Test suite includes coverage for sync/conflict/authorization helpers.

## Sign-off
- Tester:
- Date:
- Environment:
- Notes:
