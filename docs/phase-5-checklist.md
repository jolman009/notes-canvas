# Phase 5 Checklist: Real-Time Collaboration Maturity

## Scope
Phase 5 covers:
- True live collaboration (no refresh required)
- Presence and collaboration awareness UX
- Data consistency and conflict robustness at scale
- Collaboration telemetry and production observability

## TODO
- [x] Implement true live board updates:
  - [x] Apply incoming board changes in-session without page refresh
  - [x] Ensure note create/update/delete propagates to all connected members in near-real-time
  - [x] Ensure title/tag/link/image/reaction changes sync live across sessions
  - [x] Preserve local drag/resize smoothness while remote updates stream in
- [x] Add richer collaborator presence:
  - [x] Show active users list with role badge and last-seen indicator
  - [x] Show transient collaborator activity state (`editing`, `idle`, `viewing`)
  - [x] Add optional cursor/focus indicator for active note being edited
  - [x] Add stale presence cleanup and reconnect recovery messaging
- [x] Improve conflict handling for concurrent edits:
  - [x] Add field-level merge strategy for note content updates
  - [x] Add deterministic tie-break rules for simultaneous edits
  - [x] Add UX affordance for unresolved merge conflicts
  - [x] Add retry/backoff policy for transient write conflicts
- [x] Harden realtime channel lifecycle:
  - [x] Ensure exactly one subscription per board route instance
  - [x] Validate clean unsubscribe on route change/logout/tab close
  - [x] Add heartbeat/health check guardrails for long-lived sessions
  - [x] Add reconnection jitter to prevent reconnect storms
- [x] Expand automated collaboration testing:
  - [x] Add multi-client live-update integration tests
  - [x] Add concurrent edit stress tests (same note / different notes)
  - [x] Add reconnect/resubscribe regression tests
  - [x] Add stale-presence cleanup regression tests
- [x] Add collaboration telemetry:
  - [x] Track realtime reconnect count, conflict rate, and save latency metrics
  - [x] Add alert thresholds for elevated conflict/reconnect rates
  - [x] Add dashboard query pack for collaboration health trends
  - [x] Document incident response steps for realtime degradation
- [x] Finalize Phase 5 rollout controls:
  - [x] Add feature flag plan for incremental realtime enablement
  - [x] Add staged rollout validation checklist (internal -> beta -> full)
  - [x] Define rollback plan for realtime pipeline regressions
  - [x] Record release owner + monitoring window
- [x] Add implementation notes after Phase 5 validation.

## Exit Criteria
- [x] Board updates are visible live across collaborators without manual refresh.
- [x] Presence indicators are accurate and recover correctly after reconnect.
- [x] Concurrent editing behavior is deterministic and tested.
- [x] Realtime channel lifecycle is stable with no duplicate subscriptions.
- [x] Collaboration telemetry and alerting are operational.
- [x] Rollout/rollback controls are documented and validated.

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
