# Phase 4 Rollout and Rollback Playbook

## Scope
This playbook covers collaboration features, invite lifecycle, governance controls, and release gates introduced through Phase 4.

## Staged Rollout Plan
1. Dev environment
- Apply latest SQL artifacts:
  - `supabase/phase4_governance_policies.sql`
  - `supabase/phase4_ownership_transfer.sql`
  - `supabase/phase4_invite_lifecycle.sql`
- Run checks:
  - `npm run check:service-role`
  - `npm run test`
  - `npm run test:release-gates`
  - `npm run build`
- Validate manual smoke flow on dev users:
  - board create/open/edit
  - invite create/accept/revoke
  - role change and ownership transfer

2. Internal environment
- Deploy app build from the same commit verified in dev.
- Re-run SQL monitoring and backup/restore checks:
  - `supabase/phase4_monitoring_queries.sql`
  - `supabase/phase4_backup_restore_checks.sql`
- Run invite/join/edit and role matrix smoke tests with internal users.
- Monitor app logs for:
  - `[board.invite.create.failed]`
  - `[board.invite.accept.invalid]`
  - `[board.invite.accept.expired]`
  - `[board.invite.accept.revoked]`
  - `[board.save.conflict]`

3. Production rollout
- Deploy during a staffed release window.
- Run post-deploy smoke checklist (below).
- Keep active monitoring for at least 60 minutes after deployment.

## Rollback Triggers
- Sustained invite acceptance failures above baseline.
- Elevated board save conflict/error rates that impact normal editing.
- Access control regressions (unauthorized read/write observed).
- Critical UI failure on board load/edit paths.
- Failed smoke test in production.

## Rollback Procedure
1. Stop rollout and notify release channel.
2. Revert app deployment to previous stable release.
3. If required, revert SQL/function changes using pre-approved rollback scripts or previous function definitions.
4. Re-run smoke checks on reverted version:
- login
- board open/edit/save
- invite accept
5. Confirm monitoring returns to baseline.
6. Record incident timeline and follow-up actions.

## Post-Release Smoke Checklist
- Login succeeds for owner/editor/viewer accounts.
- Owner can create invite and copy link.
- Invitee can accept link and open board.
- Editor can update notes and owner sees changes after refresh.
- Viewer can read board and is blocked from write operations.
- Owner can revoke invite and revoked link is denied.
- Ownership transfer action succeeds and permissions update correctly.
- Board list and board page load without access or runtime errors.

## On-Call Release Owner
- Primary: `TBD`
- Secondary: `TBD`
- Release date/time: `TBD`
- Monitoring window: first 60 minutes post-deploy
