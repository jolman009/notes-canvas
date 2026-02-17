# Phase 4 Ops Readiness

## 1) Service-role key exposure check
- Run:
```bash
npm run check:service-role
```
- Pass criteria:
  - No `SUPABASE_SERVICE_ROLE_KEY` or `VITE_SUPABASE_SERVICE_ROLE_KEY` references in `src/components`, `src/routes`, or `src/lib`.
  - No `service_role` token references in client-facing code or public docs.
- Notes:
  - This project currently uses `SUPABASE_ANON_KEY` with per-user JWT (`Authorization: Bearer <accessToken>`) for board operations.
  - No service-role key is required in browser code.

## 2) Monitoring and alert checks
- SQL checks file: `supabase/phase4_monitoring_queries.sql`
- Run in Supabase SQL Editor:
  - Invite create/accept trend in the last 24h.
  - Revoked/expired invite backlog.
  - High-churn boards (revision pressure proxy).
  - Owner-membership consistency.
- Alert thresholds (recommended):
  - Invite accepts drop to `0` while invite creates remain elevated for 30+ minutes.
  - Revoked/expired backlog continuously increases across checks.
  - Any board with unexpectedly large revision growth in a short window.
- App log filters (deployment logs):
  - `"[board.invite.create.failed]"`
  - `"[board.invite.accept.invalid]"`
  - `"[board.invite.accept.expired]"`
  - `"[board.invite.accept.revoked]"`
  - `"[board.save.conflict]"`
- Alert on sustained spikes from these log tags.

## 3) Backup and restore validation path
- Validation SQL file: `supabase/phase4_backup_restore_checks.sql`
- Restore validation flow:
  1. Restore latest backup into staging/restore target.
  2. Run `supabase/phase4_backup_restore_checks.sql`.
  3. Confirm:
     - row counts are expected,
     - orphan counts are `0`,
     - all boards have owner membership,
     - no negative revisions / null notes.
  4. Run smoke test:
     - login, open board, create note, save, refresh, verify state persisted.
