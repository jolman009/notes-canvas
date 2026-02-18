# Phase 5 — Rollout Playbook

## Overview
Phase 5 introduces note-level merge, editing activity broadcast, retry/backoff for saves, reconnection jitter, and collaboration telemetry. These changes are purely client-side — no database migrations needed.

## Staged Rollout

### Stage 1: Internal Testing
- Deploy to development environment
- Run through validation checklist with 2-3 concurrent users
- Monitor browser console for telemetry output
- Verify no regression in save/load/sync flows

### Stage 2: Beta Users
- Deploy to staging with a small group of beta testers
- Monitor Collaboration Health metrics in Settings drawer
- Collect feedback on editing indicators and merge behavior
- Watch for unexpected conflict rates (> 5% of saves)

### Stage 3: Production
- Deploy to production
- Monitor error rates in server logs for save endpoints
- Watch for elevated conflict counts via telemetry

## Rollback Procedures

### Quick Rollback
All Phase 5 changes are backward-compatible. To rollback:
1. Revert to the pre-Phase-5 commit
2. Redeploy — no data migration needed
3. Clients will reconnect and resume normal operation

### Partial Rollback
Individual features can be disabled by reverting specific changes:
- **Smart merge**: Revert `reloadLatestSnapshot` to use `setNotes(latest.notes)` directly
- **Broadcast**: Remove `.on('broadcast', ...)` handler from the channel subscription
- **Retry/backoff**: Revert `drainSaveQueue` to remove retry loop
- **Reconnection jitter**: Remove `reconnectJitterMs()` delay in subscription status handler

## Known Limitations
- Telemetry is client-side only — no server-side aggregation yet
- Broadcast throttle (2s) means very rapid activity changes may be delayed
- Remote activity indicators expire after 10s — stale pills may briefly appear
- Three-way merge takes remote version on true conflicts (both sides changed)
