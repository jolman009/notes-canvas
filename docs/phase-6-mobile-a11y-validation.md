# Phase 6: Mobile Accessibility Validation

## Screen Reader Checklist

| Route | Element | Expected Announcement | Status |
|-------|---------|----------------------|--------|
| `/login` | Email input | "Email address" | Pass |
| `/login` | Password input | "Password" | Pass |
| `/login` | Error message | role="alert" — announced immediately | Pass |
| `/signup` | All 4 inputs | Labeled: Name, Email, Password, Confirm password | Pass |
| `/boards` | Board cards | Board title + role badge | Pass |
| `/board/$boardId` | Settings drawer | role="dialog", title "Board Settings" | Pass |
| `/board/$boardId` | Confirm dialogs | role="dialog", aria-modal, title + description | Pass |
| `/board/$boardId` | Toast notifications | role="status" (info/success), role="alert" (error/warning) | Pass |
| `/board/$boardId` | Inspector tabs | role="tablist" with role="tab" items | Pass |
| `/board/$boardId` | Color filter | role="listbox" with role="option" items | Pass |
| `/board/$boardId` | Note cards | role="button" with descriptive aria-label | Pass |

## Keyboard-Only Interaction Checklist

| Action | Key(s) | Expected Behavior | Status |
|--------|--------|-------------------|--------|
| Focus any interactive element | Tab | Amber focus ring visible | Pass |
| Navigate through notes | Tab / Shift+Tab on canvas | Cycles through filtered notes | Pass |
| Select a note | Enter / Space on focused note | Note selected, inspector updates | Pass |
| Nudge selected note | Arrow keys | Moves note 10px in direction | Pass |
| Delete selected note | Delete / Backspace | Note removed from canvas | Pass |
| Deselect note | Escape | No note selected | Pass |
| Close dialog | Escape | Dialog closes | Pass |
| Close settings drawer | Escape | Drawer closes | Pass |
| Dialog focus trap | Tab within dialog | Focus cycles within dialog only | Pass |

## WCAG 2.1 Level AA Gap Assessment

| Criterion | Status | Notes |
|-----------|--------|-------|
| 1.1.1 Non-text Content | Pass | Images have alt text, icons are decorative (aria-hidden) |
| 1.3.1 Info and Relationships | Pass | Semantic roles on tabs, dialogs, listboxes |
| 1.4.3 Contrast (Minimum) | Partial | Dark theme meets 4.5:1 for most text; note card text on colored backgrounds may need review |
| 2.1.1 Keyboard | Pass | All functionality accessible via keyboard |
| 2.4.3 Focus Order | Pass | Logical tab order follows visual layout |
| 2.4.7 Focus Visible | Pass | Global `*:focus-visible` amber outline |
| 2.5.5 Target Size | Pass | Touch targets minimum 36px, key buttons 44px |
| 4.1.2 Name, Role, Value | Pass | ARIA labels on all interactive controls |

## Mobile Viewport Test Matrix

| Device / Viewport | Test | Expected | Status |
|-------------------|------|----------|--------|
| iPhone SE (375px) | Board page loads | Canvas full width, no horizontal scroll | Pass |
| iPhone SE (375px) | Inspector | Bottom sheet overlay, max 70vh | Pass |
| iPhone SE (375px) | Header actions | Icon-only buttons, no overflow | Pass |
| iPhone SE (375px) | Toolbar | Title row wraps gracefully | Pass |
| iPhone 14 (390px) | Pinch-to-zoom | Zoom centered on pinch midpoint | Pass |
| iPad (768px) | Settings drawer | Full-height slide-out panel | Pass |
| iPad (768px) | Inspector | Bottom sheet (under lg breakpoint) | Pass |
| Desktop (1280px+) | Inspector | Inline sidebar left of canvas | Pass |
| Desktop (1280px+) | Mobile toggle | Hidden (lg:hidden) | Pass |
