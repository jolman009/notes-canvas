# Phase 4 Load Test Scenario (Manual)

## Goal
Validate multi-user concurrent editing behavior and reconnect resilience before production rollout.

## Test Setup
- Environment: local app connected to Supabase project
- Board: one shared board with at least 3 members
- Users:
  - `owner`
  - `editor-a`
  - `editor-b`
- Browser sessions:
  - Use 3 independent sessions (different browsers or incognito profiles)
- Duration target: 10 to 15 minutes

## Scenario A: Concurrent Editing Burst
1. Open the same board as all 3 users.
2. For 5 minutes:
   - `editor-a` performs rapid note text edits and drags notes.
   - `editor-b` resizes notes and edits titles/tags.
   - `owner` creates/deletes/changes note colors intermittently.
3. Expected:
   - No app crash or frozen UI.
   - Sync status recovers to `Live` after save cycles.
   - Conflict prompts/actions appear when collisions happen.
   - No uncontrolled error toasts loop.

## Scenario B: Flaky Network Reconnect
1. In one editor session, throttle network to `Offline` in DevTools for 20 to 40 seconds.
2. Continue editing locally while offline.
3. Restore network to `Online`.
4. Expected:
   - User sees reconnect/offline status transition (`Offline` -> `Reconnecting` -> `Live`).
   - App retries and re-syncs latest board state.
   - No duplicate collaborator entries after reconnection.

## Scenario C: Route Transition Subscription Check
1. In a single session, navigate repeatedly:
   - `Boards` -> `Board A` -> `Boards` -> `Board A` (repeat 10x)
2. Keep another user active on the board to generate realtime events.
3. Expected:
   - Event handling remains stable (no repeated duplicate updates per change).
   - Presence list does not duplicate the same user.
   - Realtime status remains healthy after repeated transitions.

## Pass Criteria
- No duplicate subscription symptoms (duplicated realtime event side effects).
- No stale presence users persisting beyond timeout window.
- Reconnect flow self-recovers without page reload in normal cases.
- Core editing remains usable under concurrent activity.

## Notes Template
- Date/time:
- Environment:
- Users tested:
- Scenario A result:
- Scenario B result:
- Scenario C result:
- Issues found:
- Follow-up actions:
