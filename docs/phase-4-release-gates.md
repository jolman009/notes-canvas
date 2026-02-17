# Phase 4 Release Gates

## Automated Gate Coverage
- End-to-end invite/join/edit flow:
  - `src/server/board-store.release-gates.test.ts`
  - Test: `covers end-to-end invite -> join -> edit flow`
- Role matrix checks (`owner`, `editor`, `viewer`, outsider):
  - `src/server/board-store.release-gates.test.ts`
  - Test: `covers role matrix for edit permissions...`
- Revoked/expired invite regressions:
  - `src/server/board-store.release-gates.test.ts`
  - Test: `covers invite regression: revoked and expired...`

## Required CI Checks
- Workflow: `.github/workflows/ci.yml`
- Required steps:
  - `npm run check`
  - `npm run check:service-role`
  - `npm run test`
  - `npm run test:release-gates`
  - `npm run build`

## Branch Protection Recommendation
- In GitHub branch protection for `main`, require status checks from `CI` to pass before merge.
