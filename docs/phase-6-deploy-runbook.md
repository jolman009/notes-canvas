# Phase 6: Deployment Runbook

## Overview

Canvas Notes auto-deploys to Vercel on push to `main`. This runbook covers pre-deploy checks, post-deploy verification, and rollback procedures.

## Pre-Deploy Checklist

1. **Code quality**
   - [ ] `npx biome check src/` passes with no errors
   - [ ] `npm run dev` starts without errors
   - [ ] Manual smoke test on localhost (login, create board, add note, invite)

2. **Database migrations**
   - [ ] Any new SQL migrations applied to production Supabase project
   - [ ] Migrations tested on staging/preview first
   - [ ] RLS policies verified for new tables/columns
   - [ ] Rollback SQL prepared for each migration

3. **Environment variables**
   - [ ] All required env vars set in Vercel project settings
   - [ ] `SUPABASE_SERVICE_ROLE_KEY` NOT in client-exposed vars
   - [ ] `npm run check:service-role` passes

4. **Dependencies**
   - [ ] `npm audit` shows no high/critical vulnerabilities
   - [ ] Lock file (`package-lock.json`) committed

## Deployment

Push to `main` triggers automatic deployment:

```bash
git push origin main
```

Vercel will:
1. Install dependencies
2. Run `vite build`
3. Deploy to production URL
4. Keep previous deployment as instant rollback target

## Post-Deploy Verification

1. **Smoke tests** (manual, within 5 minutes of deploy):
   - [ ] Production URL loads without errors
   - [ ] Login/signup flow works
   - [ ] Board list loads
   - [ ] Can create and edit notes
   - [ ] Realtime sync between two tabs
   - [ ] Settings drawer opens and functions

2. **Monitoring checks**:
   - [ ] Sentry dashboard shows no spike in errors
   - [ ] Vercel Analytics shows normal response times
   - [ ] No increase in 5xx error rate

## Rollback Procedure

### Vercel Instant Rollback

1. Go to Vercel dashboard → Project → Deployments
2. Find the previous successful deployment
3. Click "..." menu → "Promote to Production"
4. Verify production URL returns to previous version

### Database Rollback

If a migration was applied:

1. Connect to Supabase SQL Editor
2. Run the prepared rollback SQL
3. Verify RLS policies are restored
4. Test affected queries from the app

### Emergency Procedure

If the app is completely down:

1. **Rollback Vercel** immediately (< 2 minutes)
2. Check Supabase status page for outages
3. Check Sentry for error patterns
4. If database issue: rollback migration
5. Notify stakeholders via incident template

## Recovery Time Objectives

| Scenario | Target RTO |
|----------|------------|
| Bad deploy (code only) | < 5 minutes (Vercel rollback) |
| Bad migration | < 15 minutes (SQL rollback + Vercel rollback) |
| Supabase outage | Dependent on Supabase (monitor status page) |
| Complete platform failure | < 30 minutes (restore from backup) |
