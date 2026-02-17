# Phase 4 Checklist: Production Readiness and Collaboration Governance

## Scope
Phase 4 covers:
- Collaboration governance and role management completion
- Production hardening and operational readiness
- End-to-end rollout and release controls

## TODO
- [x] Finalize board governance flows:
  - [x] Add ownership transfer flow (explicit confirmation + safety checks)
  - [x] Add owner UI for member role changes (`editor` <-> `viewer`)
  - [x] Add owner flow to remove members from a board
  - [x] Add self-service "Leave board" flow for non-owners
- [x] Harden invite lifecycle:
  - [x] Add default invite expiration policy (for example: 7 days)
  - [x] Add reusable vs one-time invite option (owner-controlled)
  - [x] Add invite audit fields (`accepted_by`, `accepted_at`) if needed
  - [x] Add cleanup path for expired/revoked invites
- [ ] Improve board management UX:
  - [x] Rename board from board header/settings
  - [x] Add archive/delete board flow with confirmation guardrails
  - [x] Add clear empty/loading/error states for board list and board page
  - [x] Add member list panel with role badges and ownership indicator
- [ ] Improve realtime UX polish:
  - [x] Add clearer sync status states (`Live`, `Reconnecting`, `Offline`)
  - [x] Show last successful sync timestamp in board UI
  - [x] Add clearer conflict resolution affordances and retry messaging
  - [x] Add presence timeout cleanup for stale users
- [ ] Add performance and reliability safeguards:
  - [x] Tune save throttling/debouncing under fast edit bursts
  - [x] Verify reconnect behavior under flaky network conditions
  - [x] Add load test scenario for multi-user concurrent editing
  - [x] Verify no duplicate subscriptions on route transitions
- [x] Complete security and ops readiness:
  - [x] Add rate limiting for invite create/accept endpoints
  - [x] Verify service-role usage is server-only and never client-exposed
  - [x] Add monitoring/alerts for invite failures and conflict spikes
  - [x] Validate backup and restore path for `boards`, `board_members`, `board_state`
- [ ] Add automated release gates:
  - [ ] Add end-to-end invite/join/edit test flow
  - [ ] Add role-matrix E2E checks (`owner`, `editor`, `viewer`, outsider)
  - [ ] Add revoked/expired invite regression tests
  - [ ] Require passing CI checks before production deploy
- [ ] Define rollout and rollback playbook:
  - [ ] Add staged rollout plan (dev -> internal -> production)
  - [ ] Define rollback triggers and rollback procedure
  - [ ] Add post-release smoke checklist
  - [ ] Record on-call owner for release window
- [ ] Add implementation notes after Phase 4 validation.

## Exit Criteria
- [x] Ownership/member governance flows are complete and validated.
- [x] Invite lifecycle policies are enforced and observable in production.
- [ ] Realtime sync UX clearly communicates status and recovery paths.
- [ ] Security/ops checks and backup/restore verification are signed off.
- [ ] E2E test coverage gates release for invite, access, and collaboration paths.
- [ ] Rollout and rollback runbooks are documented and tested.

## Phase 4 Artifacts (Planned)
- `supabase/phase4_governance_policies.sql`
- `supabase/phase4_governance_policy_tests.sql`
- `supabase/phase4_ownership_transfer.sql`
- `supabase/phase4_invite_lifecycle.sql`
- `src/routes/board.$boardId.tsx`
- `src/routes/boards.tsx`
- `src/server/board-store.ts`
- `src/server/invites.ts`
- `docs/phase-4-load-test-scenario.md`
- `docs/phase-4-validation-checklist.md`
- `docs/phase-4-ops-readiness.md`
- `supabase/phase4_monitoring_queries.sql`
- `supabase/phase4_backup_restore_checks.sql`
