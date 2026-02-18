# Phase 6 Checklist: Mobile Accessibility and Production Deployment Readiness

## Scope
Phase 6 covers:
- Mobile-first usability and responsive collaboration flows
- Accessibility compliance improvements (keyboard, screen reader, contrast)
- Production deployment hardening, release controls, and environment readiness

## TODO
- [ ] Improve mobile board usability:
  - [ ] Add touch-friendly controls for drag/resize notes
  - [ ] Improve note action layout for small screens (no overlap/clipping)
  - [ ] Add mobile-safe inspector behavior (drawer/sheet pattern)
  - [ ] Ensure board header actions remain usable on narrow widths
- [ ] Improve accessibility baseline:
  - [ ] Add semantic labels/roles for all board controls
  - [ ] Add complete keyboard navigation for note operations
  - [ ] Add visible focus states for interactive elements
  - [ ] Fix color contrast issues in note buttons and badges
- [ ] Add accessibility validation:
  - [ ] Run automated a11y scans on key routes (`/login`, `/boards`, `/board/$boardId`)
  - [ ] Add manual screen reader smoke checklist
  - [ ] Add keyboard-only interaction checklist
  - [ ] Record WCAG gap list and remediation notes
- [ ] Prepare production environment readiness:
  - [ ] Document required production env vars and secrets handling
  - [ ] Validate Supabase project config (RLS, auth providers, URL allowlists)
  - [ ] Add production-grade error logging configuration
  - [ ] Add request timeout and retry policy documentation
- [ ] Harden deployment pipeline:
  - [ ] Define production deployment strategy (blue/green or rolling)
  - [ ] Add pre-deploy migration/runbook step verification
  - [ ] Add post-deploy smoke automation
  - [ ] Add rollback rehearsal checklist and recovery RTO target
- [ ] Add production reliability checks:
  - [ ] Define SLOs for availability, save latency, and invite acceptance
  - [ ] Add alert routing and escalation chain
  - [ ] Add dashboard links for runtime health and collaboration metrics
  - [ ] Add incident response template for production outages
- [ ] Add implementation notes after Phase 6 validation.

## Exit Criteria
- [ ] Core app flows are mobile-usable on common viewport sizes.
- [ ] Accessibility checks pass for critical routes and board interactions.
- [ ] Production environment and secret configuration are validated.
- [ ] Deployment and rollback runbooks are tested in a staging rehearsal.
- [ ] Monitoring, alerting, and incident-response ownership are in place.

## Phase 6 Artifacts (Planned)
- `docs/phase-6-checklist.md`
- `docs/phase-6-mobile-a11y-validation.md`
- `docs/phase-6-production-readiness.md`
- `docs/phase-6-deploy-runbook.md`
- `docs/phase-6-incident-template.md`
- `.github/workflows/ci.yml`
- `src/routes/board.$boardId.tsx`
- `src/components/BoardCanvas.tsx`
- `src/components/Header.tsx`
