# Phase 5 — Validation Checklist

## Prerequisites
- Two browser tabs open with different user accounts on the same board
- Network throttling tools available (Chrome DevTools or similar)

## Smart Merge (Three-Way)
- [ ] Create a note in Tab A -> appears in Tab B within ~2s
- [ ] Edit note text in Tab A while Tab B is idle -> Tab B receives update without losing scroll/zoom position
- [ ] Drag a note in Tab B while Tab A edits a different note -> Tab B's drag is not interrupted
- [ ] Edit the same note in both tabs simultaneously -> conflict toast appears with merge info
- [ ] Delete a note in Tab A while Tab B is idle -> note disappears from Tab B
- [ ] Create a note in Tab B before Tab A syncs -> locally created note persists after sync

## Broadcast Editing Activity
- [ ] Start editing a note in Tab A -> Tab B sees "Alice is editing" pill on that note
- [ ] Drag a note in Tab A -> Tab B sees "Alice is dragging" pill on that note
- [ ] Stop editing in Tab A -> pill disappears from Tab B within 10s
- [ ] Broadcast doesn't fire more than once per 2s (check network tab)

## Enhanced Presence
- [ ] Open Settings drawer -> online users show activity badges (editing/dragging)
- [ ] Header shows active editor count when someone is editing
- [ ] Presence updates when a user starts/stops editing

## Retry with Exponential Backoff
- [ ] Simulate network failure during save (DevTools offline) -> retries up to 3 times
- [ ] After 3 failures, error toast is shown and retrying stops
- [ ] Successful save after retry resets the retry counter
- [ ] Conflict errors (revision mismatch) do NOT trigger retry

## Reconnection Jitter
- [ ] Kill network, wait 10s, restore -> client reconnects with a jitter delay (1-5s)
- [ ] Status shows "connecting" during the jitter delay
- [ ] Two tabs reconnecting don't reconnect at the exact same time

## Collaboration Telemetry
- [ ] Open Settings drawer -> "Collaboration Health" section is visible
- [ ] Metrics include: total saves, avg/p95 latency, reconnects, conflicts, broadcasts
- [ ] On page navigation away, metrics are logged to console
- [ ] Metrics reset on fresh page load

## Regression Checks
- [ ] `npm run dev` — app starts without errors
- [ ] Login/signup flow works unchanged
- [ ] Creating, editing, deleting notes works normally
- [ ] Inspector sidebar works identically to before
- [ ] Board rename, delete, leave, transfer ownership all work
- [ ] Invite creation and management work
- [ ] Zoom/pan canvas works correctly
- [ ] `npx biome check src/` — no lint errors
