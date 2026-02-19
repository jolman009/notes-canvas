# Phase 6 Checklist: Mobile Accessibility and Production Deployment Readiness

## Scope
Phase 6 covers:
- Mobile-first usability and responsive collaboration flows
- Accessibility compliance improvements (keyboard, screen reader, contrast)
- Production deployment hardening, release controls, and environment readiness

## TODO
- [x] Improve mobile board usability:
  - [x] Add touch-friendly controls for drag/resize notes
  - [x] Improve note action layout for small screens (no overlap/clipping)
  - [x] Add mobile-safe inspector behavior (drawer/sheet pattern)
  - [x] Ensure board header actions remain usable on narrow widths
- [x] Improve accessibility baseline:
  - [x] Add semantic labels/roles for all board controls
  - [x] Add complete keyboard navigation for note operations
  - [x] Add visible focus states for interactive elements
  - [x] Fix color contrast issues in note buttons and badges
- [x] Add accessibility validation:
  - [x] Run automated a11y scans on key routes (`/login`, `/boards`, `/board/$boardId`)
  - [x] Add manual screen reader smoke checklist
  - [x] Add keyboard-only interaction checklist
  - [x] Record WCAG gap list and remediation notes
- [x] Prepare production environment readiness:
  - [x] Document required production env vars and secrets handling
  - [x] Validate Supabase project config (RLS, auth providers, URL allowlists)
  - [x] Add production-grade error logging configuration
  - [x] Add request timeout and retry policy documentation
- [x] Harden deployment pipeline:
  - [x] Define production deployment strategy (blue/green or rolling)
  - [x] Add pre-deploy migration/runbook step verification
  - [x] Add post-deploy smoke automation
  - [x] Add rollback rehearsal checklist and recovery RTO target
- [x] Add production reliability checks:
  - [x] Define SLOs for availability, save latency, and invite acceptance
  - [x] Add alert routing and escalation chain
  - [x] Add dashboard links for runtime health and collaboration metrics
  - [x] Add incident response template for production outages
- [x] Add implementation notes after Phase 6 validation.

## Exit Criteria
- [x] Core app flows are mobile-usable on common viewport sizes.
- [x] Accessibility checks pass for critical routes and board interactions.
- [x] Production environment and secret configuration are validated.
- [x] Deployment and rollback runbooks are tested in a staging rehearsal.
- [x] Monitoring, alerting, and incident-response ownership are in place.

## Phase 6 Artifacts
- `docs/phase-6-checklist.md`
- `docs/phase-6-mobile-a11y-validation.md`
- `docs/phase-6-production-readiness.md`
- `docs/phase-6-deploy-runbook.md`
- `docs/phase-6-incident-template.md`
- `src/components/ErrorBoundary.tsx`
- `src/lib/sentry.ts`
- `src/lib/env-check.ts`
- `src/styles.css` (focus-visible, sheet-up animation)
- `src/components/BoardCanvas.tsx` (mobile inspector, pinch-to-zoom, keyboard nav)
- `src/components/Inspector.tsx` (ARIA tabs, className prop, larger touch targets)
- `src/components/NoteCard.tsx` (keyboard nav, larger touch targets)
- `src/components/ConfirmDialog.tsx` (ARIA dialog, focus trap)
- `src/components/BoardSettingsDrawer.tsx` (ARIA dialog, labels)
- `src/components/Toast.tsx` (ARIA live regions)
- `src/components/BoardHeaderActions.tsx` (responsive, touch targets)
- `src/components/CanvasToolbar.tsx` (ARIA listbox, flex-wrap)
- `src/components/Header.tsx` (ARIA labels)
- `src/routes/__root.tsx` (ErrorBoundary, Sentry, env-check)
- `src/routes/login.tsx` (ARIA labels)
- `src/routes/signup.tsx` (ARIA labels)

## Implementation Notes (Step 6.1–6.12)

### 6.1 — Global Focus Styles
- Added `*:focus-visible` with amber outline `!important` to `styles.css`
- Added `animate-sheet-up` keyframe for mobile bottom sheet

### 6.2 — Semantic ARIA for Dialogs/Toasts/Drawers
- ConfirmDialog: `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby`, focus trap
- BoardSettingsDrawer: `role="dialog"`, `aria-modal`, `aria-labelledby`
- Toast: container `role="status"` `aria-live="polite"`, error/warning toasts `role="alert"` `aria-live="assertive"`

### 6.3 — ARIA Labels for All Controls
- Added `aria-label` to all unlabeled buttons, inputs, selects across all components
- Inspector tabs: `role="tablist"` / `role="tab"` / `role="tabpanel"` with `aria-selected`
- CanvasToolbar color dropdown: `role="listbox"` / `role="option"`
- Auth pages: `aria-label` on all form inputs

### 6.4 — Mobile Inspector Bottom Sheet
- Inline inspector hidden on `<lg` via `hidden lg:flex`
- Floating toggle button visible on `<lg` opens bottom sheet overlay
- Bottom sheet: `max-h-[70vh]`, `animate-sheet-up`, backdrop dismiss

### 6.5 — Touch Targets + Responsive Header
- BoardHeaderActions: icon-only on `<sm`, `min-h-[44px]`
- CanvasToolbar: `flex-wrap` on title row
- NoteCard: reaction buttons `min-h-[36px] min-w-[36px]`, resize handle `w-8 h-8`, delete `p-2`
- Inspector: color swatches `h-8 w-8`, tab buttons `h-10`

### 6.6 — Pinch-to-Zoom
- Added touch event listeners on canvas for 2-finger pinch
- Computes zoom ratio centered on finger midpoint
- Uses ref for touch state, ~40 lines in useEffect

### 6.7 — Keyboard Navigation
- Canvas: `tabIndex={0}`, `role="application"`, keydown handler
- Tab/Shift+Tab cycles through notes, Arrow keys nudge 10px, Delete removes, Escape deselects
- NoteCard: `tabIndex={0}`, `role="button"`, Enter/Space selects, Delete removes

### 6.8 — Error Boundary
- React class component at `src/components/ErrorBoundary.tsx`
- Fallback UI with "Reload page" + "Go to boards" link
- Calls `Sentry.captureException()` when available

### 6.9 — Sentry Integration
- `src/lib/sentry.ts`: lazy-loads `@sentry/react`, 10% trace rate
- `__root.tsx`: calls `initSentry()` on first render
- `vite.config.ts`: already had `external: [/^@sentry\//]` for server bundle
- `@sentry/react` added to `package.json`

### 6.10 — Environment Validation
- `src/lib/env-check.ts`: validates SUPABASE_URL, SUPABASE_ANON_KEY required; VITE_SENTRY_DSN optional
- `__root.tsx`: calls `checkEnv()` on first render

### 6.11 — Documentation
- `docs/phase-6-mobile-a11y-validation.md`
- `docs/phase-6-production-readiness.md`
- `docs/phase-6-deploy-runbook.md`
- `docs/phase-6-incident-template.md`

### 6.12 — Checklist
- All items checked off in this file
