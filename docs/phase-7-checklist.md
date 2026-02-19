# Phase 7 Checklist: Deployment Path

## Scope
Phase 7 covers:
- Vercel project configuration and deployment pipeline
- Production environment variable management and secrets hygiene
- Health check endpoint for post-deploy verification and uptime monitoring
- CI/CD deployment gates and automated smoke tests
- Sentry production error tracking activation
- Domain, HTTPS, and auth redirect configuration
- Database production hardening and backup strategy
- Monitoring, alerting, and observability wiring

## TODO
- [ ] Set up Vercel project:
  - [ ] Create or link Vercel project to GitHub repo
  - [ ] Configure build settings (framework preset: Vite, build command: `npm run build`, output directory)
  - [x] Add `vercel.json` with build command, install command, and framework preset
  - [ ] Set production branch to `main` and enable preview deploys for PRs
- [ ] Configure production environment variables:
  - [ ] Set `SUPABASE_URL` in Vercel project settings (available to client + server)
  - [ ] Set `SUPABASE_ANON_KEY` in Vercel project settings (available to client + server)
  - [ ] Set `SUPABASE_SERVICE_ROLE_KEY` in Vercel project settings (server-only, NOT exposed to client)
  - [ ] Set `VITE_SENTRY_DSN` in Vercel project settings (client-only)
  - [x] Verify `.env` is in `.gitignore` (already present)
  - [x] Create `.env.production.example` documenting all required and optional vars
  - [x] Update outdated `.env.example` to match current variable names (`SUPABASE_URL` instead of `SUPABASE_PROJECT_ID`)
- [x] Add health check endpoint:
  - [x] Create `/api/health` server route returning `{ status: "ok", timestamp }` with 200 status
  - [ ] Optionally verify Supabase connectivity in health check (ping auth or a lightweight query)
  - [ ] Document health endpoint URL for uptime monitoring services
- [x] Harden CI/CD deployment pipeline:
  - [x] Existing CI already gates on test/build failure (`checks` job)
  - [x] Add post-deploy smoke test job (curl health endpoint, verify 200 response)
  - [ ] Verify Vercel GitHub integration auto-deploys on push to `main`
  - [ ] Verify preview deploys generate for pull requests
  - [x] Update `.github/workflows/ci.yml` with deploy gate and smoke test jobs
- [ ] Activate Sentry in production:
  - [ ] Set `VITE_SENTRY_DSN` in Vercel environment variables
  - [ ] Verify error capture works in production (trigger test error, confirm in Sentry dashboard)
  - [ ] Configure Sentry alert rules for error rate spikes and new issue notifications
  - [x] Verify `@sentry/react` is excluded from server bundle (`vite.config.ts` external — already configured)
- [ ] Configure domain and HTTPS:
  - [ ] Add custom domain in Vercel project settings (if applicable)
  - [ ] Verify HTTPS/SSL certificate is provisioned automatically by Vercel
  - [ ] Update Supabase Auth redirect URLs (`Site URL`, `Redirect URLs`) for production domain
  - [ ] Update any hardcoded localhost references in codebase
- [ ] Harden database for production:
  - [ ] Verify RLS is enabled on all tables (`boards`, `board_members`, `board_invites`, `user_profiles`, `notes`)
  - [ ] Document migration workflow (apply via Supabase SQL Editor, test on staging first)
  - [ ] Verify Supabase auth providers are configured for production (email/password, any OAuth)
  - [ ] Enable database backups (point-in-time recovery) in Supabase dashboard
  - [ ] Rotate JWT secret from default in Supabase project settings
  - [ ] Configure connection pooling for production load
- [ ] Set up monitoring and observability:
  - [ ] Verify Sentry error tracking captures production errors
  - [ ] Set up uptime monitoring on `/api/health` endpoint (e.g., UptimeRobot, Vercel Cron)
  - [ ] Enable Vercel Analytics for Web Vitals and request metrics (if desired)
  - [ ] Configure alert routing — Sentry alerts to team channel/email
  - [ ] Document on-call rotation and escalation chain (reference `phase-6-incident-template.md`)
- [ ] Add implementation notes after Phase 7 validation.

## Exit Criteria
- [ ] App is deployed and accessible at production URL.
- [ ] All environment variables are configured in Vercel (not committed to repo).
- [x] Health check endpoint (`/api/health`) returns 200 with status payload.
- [ ] Sentry captures errors in production (verified with test error).
- [x] CI pipeline gates deploys on test/build failure.
- [x] Post-deploy smoke test runs automatically after each deploy.
- [ ] Database has RLS enabled on all tables and backups configured.
- [ ] Custom domain configured with HTTPS (if applicable).
- [x] `.env.production.example` documents all required variables.

## Phase 7 Artifacts
- `docs/phase-7-checklist.md`
- `vercel.json`
- `.env.production.example`
- `src/routes/api.health.ts`
- `.env.example` (updated with current variable names)
- `.github/workflows/ci.yml` (updated with deploy gates and smoke tests)

## Implementation Notes (Step 7.1–7.4)

### 7.1 — Environment Variable Templates
- Created `.env.production.example` with all 4 production vars documented (required vs optional, client vs server scope)
- Updated `.env.example` to replace outdated `SUPABASE_PROJECT_ID` format with `SUPABASE_URL`
- `.env` was already in `.gitignore` (line 7)

### 7.2 — Health Check Endpoint
- Created `src/routes/api.health.ts` using TanStack Start's `createFileRoute` with `server.handlers.GET`
- Returns `{ status: "ok", timestamp: "<ISO 8601>" }` with HTTP 200
- Uses `Response.json()` for proper JSON response
- Route auto-registered in `routeTree.gen.ts` at path `/api/health`
- Verified working via `curl http://localhost:3000/api/health` on dev server

### 7.3 — Vercel Configuration
- Created `vercel.json` with `buildCommand: "npm run build"`, `installCommand: "npm ci"`, `framework: "vite"`
- Minimal config — Vercel auto-detects most settings for Vite projects

### 7.4 — CI/CD Smoke Test
- Added `smoke-test` job to `.github/workflows/ci.yml`
- Only runs on push to `main` (not on PRs) after `checks` job passes
- Waits 120s for Vercel deployment, then curls `$PRODUCTION_URL/api/health`
- Uses `vars.PRODUCTION_URL` repo variable — gracefully skips if not configured
- Checks HTTP status code is 200; fails the workflow if not
- Existing `checks` job already gates deploys via service-role guard, tests, and build
