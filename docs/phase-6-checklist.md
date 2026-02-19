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


 Phase 6: Mobile Accessibility & Production Deployment  

 Context

 Phases 1-5 delivered full collaboration features but the frontend lacks mobile usability, accessibility, and production error tracking. The app has ~7 aria-labels total, no role attributes, no visible focus      
 states for keyboard users, and the inspector doesn't adapt to small screens. User priority: mobile + a11y first, then production hardening with Sentry.

 The app already auto-deploys to Vercel via GitHub push, so deployment pipeline work is mainly documentation.

 ---
 Step 6.1 — Global Focus Styles + CSS Utilities

 File: src/styles.css

 - Add *:focus-visible rule with amber outline + !important (overrides Tailwind's outline-none)
 - Add animate-sheet-up keyframe for mobile inspector bottom sheet

 This single CSS change fixes invisible keyboard focus across all components without touching each className.

 ---
 Step 6.2 — Semantic ARIA for Dialogs, Toasts, and Drawers

 Files: ConfirmDialog.tsx, BoardSettingsDrawer.tsx, Toast.tsx

 ConfirmDialog.tsx:
 - Add role="dialog", aria-modal="true", aria-labelledby, aria-describedby
 - Add id attributes on title <h2> and description <p>
 - Add basic focus trap (Tab cycles within dialog)

 BoardSettingsDrawer.tsx:
 - Add role="dialog", aria-modal="true", aria-labelledby on drawer panel
 - Add id on drawer title heading

 Toast.tsx:
 - Add role="status" and aria-live="polite" on toast container
 - Error/warning toasts: role="alert" with aria-live="assertive"

 ---
 Step 6.3 — ARIA Labels for All Interactive Controls

 Files: BoardHeaderActions.tsx, CanvasToolbar.tsx, Inspector.tsx, BoardSettingsDrawer.tsx, Header.tsx, NoteCard.tsx

 - Add aria-label to all unlabeled buttons, inputs, selects
 - Add role="tablist"/role="tab"/role="tabpanel" with aria-selected to Inspector tabs
 - Add role="listbox"/role="option" to color dropdown in CanvasToolbar
 - Add aria-label to auth page inputs (login.tsx, signup.tsx)

 ---
 Step 6.4 — Mobile Inspector as Bottom Sheet

 Files: BoardCanvas.tsx, Inspector.tsx

 Problem: On <lg screens, inspector renders above canvas at full width, pushing canvas below fold.

 Solution:
 - Hide the inline inspector on <lg with hidden lg:block
 - Add floating "Inspector" toggle button visible only on <lg
 - Show inspector as a bottom sheet overlay (max-h-[70vh], slide-up animation, backdrop dismiss)
 - Add optional className prop to Inspector for styling context

 ---
 Step 6.5 — Touch Targets + Responsive Header/Toolbar

 Files: BoardHeaderActions.tsx, CanvasToolbar.tsx, NoteCard.tsx, Inspector.tsx

 - BoardHeaderActions: Collapse button text to icon-only on <sm, add min-h-[44px] touch targets
 - CanvasToolbar: Add flex-wrap on title row to prevent overflow
 - NoteCard: Enlarge reaction buttons to min 36px, resize handle to w-8 h-8, delete button padding to p-2
 - Inspector: Enlarge color swatches to h-8 w-8, tab buttons to h-10

 ---
 Step 6.6 — Pinch-to-Zoom on Canvas

 File: BoardCanvas.tsx

 - Add touchstart/touchmove/touchend listeners for 2-finger pinch
 - Track initial finger distance + zoom, compute ratio, apply zoom centered on midpoint
 - ~40 lines using a ref for touch state
 - Canvas already has touch-none CSS so browser won't interfere

 ---
 Step 6.7 — Keyboard Navigation for Notes

 Files: BoardCanvas.tsx, NoteCard.tsx

 - BoardCanvas: Add tabIndex={0} on canvas container, keydown listener for:
   - Tab/Shift+Tab: cycle through notes
   - Arrow keys: nudge selected note by 10px
   - Delete/Backspace: delete selected note
   - Escape: deselect
 - NoteCard: Add tabIndex={0}, role="button", onKeyDown (Enter/Space to select, Delete to remove)

 ---
 Step 6.8 — Error Boundary

 New file: src/components/ErrorBoundary.tsx

 - React class component error boundary
 - Fallback UI: error message, "Reload page" button, "Go to boards" link
 - Calls Sentry.captureException() in componentDidCatch when available

 ---
 Step 6.9 — Sentry Integration

 New file: src/lib/sentry.ts
 Modified: __root.tsx, package.json

 - Install @sentry/react
 - sentry.ts: init with DSN from VITE_SENTRY_DSN, 10% traces sample rate
 - __root.tsx: call initSentry(), wrap children with <ErrorBoundary>
 - vite.config.ts already excludes Sentry from server bundle

 ---
 Step 6.10 — Environment Validation

 New file: src/lib/env-check.ts
 Modified: __root.tsx

 - Validate required env vars at startup (SUPABASE_URL, SUPABASE_ANON_KEY)
 - Warn if optional vars missing (VITE_SENTRY_DSN)
 - Log results to console on mount

 ---
 Step 6.11 — Documentation

 New files:
 - docs/phase-6-mobile-a11y-validation.md — screen reader checklist, keyboard-only checklist, WCAG gaps, mobile viewport test matrix
 - docs/phase-6-production-readiness.md — env vars table, Supabase config checklist, SLO definitions, timeout/retry policies
 - docs/phase-6-deploy-runbook.md — pre/post-deploy checks, Vercel rollback procedure, migration steps
 - docs/phase-6-incident-template.md — incident response template with timeline, root cause, action items

 ---
 Step 6.12 — Update Phase 6 Checklist

 File: docs/phase-6-checklist.md — check off all completed items

 ---
 Execution Order

 Parallel A (no deps):  6.1, 6.2, 6.3, 6.6, 6.7, 6.8
 Then (needs 6.1):      6.4
 Parallel with 6.4:     6.5
 Then (needs 6.8):      6.9
 Parallel with 6.9:     6.10
 Last:                  6.11, 6.12

 Files Summary

 Action: New (3 code)
 Files: ErrorBoundary.tsx, sentry.ts, env-check.ts
 ────────────────────────────────────────
 Action: New (4 docs)
 Files: phase-6-mobile-a11y-validation.md, phase-6-production-readiness.md, phase-6-deploy-runbook.md, phase-6-incident-template.md
 ────────────────────────────────────────
 Action: Modified (12)
 Files: styles.css, ConfirmDialog.tsx, BoardSettingsDrawer.tsx, Toast.tsx, BoardHeaderActions.tsx, CanvasToolbar.tsx, Inspector.tsx, NoteCard.tsx, BoardCanvas.tsx, Header.tsx, __root.tsx, package.json

 Verification

 1. npm run dev — starts without errors
 2. npx biome check src/ — passes
 3. Mobile (375px viewport): inspector opens as bottom sheet, canvas is full width
 4. Pinch-to-zoom works on canvas
 5. All buttons are >= 36px touch targets
 6. Tab key navigates all controls with visible amber focus ring
 7. Arrow keys nudge selected note, Delete removes it
 8. Escape closes dialogs and drawers
 9. Screen reader announces dialog titles and toast messages
 10. Sentry captures errors when DSN is configured
 11. ErrorBoundary shows fallback on render crash
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌