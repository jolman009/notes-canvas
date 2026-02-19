# Incident Report Template

## Incident Summary

| Field | Value |
|-------|-------|
| **Incident ID** | INC-YYYY-MM-DD-NNN |
| **Severity** | P1 / P2 / P3 |
| **Status** | Investigating / Identified / Monitoring / Resolved |
| **Started** | YYYY-MM-DD HH:MM UTC |
| **Resolved** | YYYY-MM-DD HH:MM UTC |
| **Duration** | X minutes |
| **Impact** | Brief description of user impact |

## Timeline

| Time (UTC) | Event |
|------------|-------|
| HH:MM | First alert / user report |
| HH:MM | Investigation started |
| HH:MM | Root cause identified |
| HH:MM | Fix deployed / rollback performed |
| HH:MM | Service restored |
| HH:MM | Monitoring confirmed stable |

## Root Cause

Describe the technical root cause. Include:
- What failed and why
- Any contributing factors
- Was this a regression from a recent change?

## Resolution

Describe the fix applied:
- Code changes, rollbacks, or configuration changes
- Database migrations rolled back (if any)
- Sentry error references

## Impact Assessment

| Metric | Value |
|--------|-------|
| Users affected | N |
| Data loss | None / Describe |
| Downtime | X minutes |
| Error rate during incident | N% |

## Action Items

| # | Action | Owner | Due Date | Status |
|---|--------|-------|----------|--------|
| 1 | (e.g., Add monitoring for X) | | | Open |
| 2 | (e.g., Add test coverage for Y) | | | Open |
| 3 | (e.g., Update runbook for Z) | | | Open |

## Lessons Learned

- What went well during the response?
- What could be improved?
- Were existing runbooks/documentation helpful?
