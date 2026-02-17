# Phase 5 Checklist: Real-Time Collaboration Maturity

## Scope
Phase 5 covers:
- True live collaboration (no refresh required)
- Presence and collaboration awareness UX
- Data consistency and conflict robustness at scale
- Collaboration telemetry and production observability

## TODO
- [ ] Implement true live board updates:
  - [ ] Apply incoming board changes in-session without page refresh
  - [ ] Ensure note create/update/delete propagates to all connected members in near-real-time
  - [ ] Ensure title/tag/link/image/reaction changes sync live across sessions
  - [ ] Preserve local drag/resize smoothness while remote updates stream in
- [ ] Add richer collaborator presence:
  - [ ] Show active users list with role badge and last-seen indicator
  - [ ] Show transient collaborator activity state (`editing`, `idle`, `viewing`)
  - [ ] Add optional cursor/focus indicator for active note being edited
  - [ ] Add stale presence cleanup and reconnect recovery messaging
- [ ] Improve conflict handling for concurrent edits:
  - [ ] Add field-level merge strategy for note content updates
  - [ ] Add deterministic tie-break rules for simultaneous edits
  - [ ] Add UX affordance for unresolved merge conflicts
  - [ ] Add retry/backoff policy for transient write conflicts
- [ ] Harden realtime channel lifecycle:
  - [ ] Ensure exactly one subscription per board route instance
  - [ ] Validate clean unsubscribe on route change/logout/tab close
  - [ ] Add heartbeat/health check guardrails for long-lived sessions
  - [ ] Add reconnection jitter to prevent reconnect storms
- [ ] Expand automated collaboration testing:
  - [ ] Add multi-client live-update integration tests
  - [ ] Add concurrent edit stress tests (same note / different notes)
  - [ ] Add reconnect/resubscribe regression tests
  - [ ] Add stale-presence cleanup regression tests
- [ ] Add collaboration telemetry:
  - [ ] Track realtime reconnect count, conflict rate, and save latency metrics
  - [ ] Add alert thresholds for elevated conflict/reconnect rates
  - [ ] Add dashboard query pack for collaboration health trends
  - [ ] Document incident response steps for realtime degradation
- [ ] Finalize Phase 5 rollout controls:
  - [ ] Add feature flag plan for incremental realtime enablement
  - [ ] Add staged rollout validation checklist (internal -> beta -> full)
  - [ ] Define rollback plan for realtime pipeline regressions
  - [ ] Record release owner + monitoring window
- [ ] Add implementation notes after Phase 5 validation.

## Exit Criteria
- [ ] Board updates are visible live across collaborators without manual refresh.
- [ ] Presence indicators are accurate and recover correctly after reconnect.
- [ ] Concurrent editing behavior is deterministic and tested.
- [ ] Realtime channel lifecycle is stable with no duplicate subscriptions.
- [ ] Collaboration telemetry and alerting are operational.
- [ ] Rollout/rollback controls are documented and validated.

## Phase 5 Artifacts (Planned)
- `docs/phase-5-checklist.md`
- `docs/phase-5-validation-checklist.md`
- `docs/phase-5-rollout-playbook.md`
- `docs/phase-5-collaboration-metrics.md`
- `supabase/phase5_realtime_checks.sql`
- `src/routes/board.$boardId.tsx`
- `src/server/board-store.ts`
- `src/server/board-store.realtime.test.ts`
- `.github/workflows/ci.yml`
