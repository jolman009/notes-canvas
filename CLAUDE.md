 UI/UX Improvement Plan — Canvas Notes App                                                                                         │
│                                                                                                                                   │
│ Context                                                                                                                           │
│                                                                                                                                   │
│ The app has production-grade backend features (auth, RBAC, invites, realtime sync, conflict resolution) but the frontend hasn't   │
│ kept pace. The entire UI lives in 2 components (BoardCanvas.tsx at 808 lines, Header.tsx at 34 lines) and a monolithic route file │
│  (board.$boardId.tsx at 1,793 lines with 30+ state variables). Key problems: settings/members/invites buried below the canvas     │
│ requiring scroll, header overflow with 13+ inline elements, hex color codes shown to users, tiny resize handles, jarring          │
│ window.confirm() dialogs, no loading skeletons, no animations, and inconsistent toast positioning with no auto-dismiss.           │
│                                                                                                                                   │
│ Phase 1: Component Decomposition + Visual Wins (no schema changes)                                                                │
│                                                                                                                                   │
│ Step 1.1 — Add color name map to src/lib/notes.ts                                                                                 │
│                                                                                                                                   │
│ Add NOTE_COLOR_LABELS mapping hex values to human-readable names ("Warm Yellow", "Sky Blue", etc.). Move roleBadgeClassName       │
│ helper here from board.$boardId.tsx since it's shared.                                                                            │
│                                                                                                                                   │
│ Step 1.2 — Create src/components/ConfirmDialog.tsx                                                                                │
│                                                                                                                                   │
│ Modal dialog replacing all window.confirm() / window.prompt() calls.                                                              │
│ - Portal into document.body, backdrop fixed inset-0 z-50 bg-black/60, centered card                                               │
│ - Two modes: confirm (title + description + Cancel/Confirm) and prompt (adds text input, confirm disabled until input matches     │
│ validation string)                                                                                                                │
│ - variant: 'default' | 'destructive' controls button color                                                                        │
│ - Escape key closes, auto-focuses cancel button (or input in prompt mode)                                                         │
│ - Props: open, title, description?, confirmLabel?, cancelLabel?, variant?, promptMode?, promptPlaceholder?, promptValidation?,    │
│ onConfirm, onCancel                                                                                                               │
│                                                                                                                                   │
│ Step 1.3 — Create src/components/Toast.tsx                                                                                        │
│                                                                                                                                   │
│ Centralized toast system replacing 3 ad-hoc positioned notification divs.                                                         │
│ - ToastProvider (React Context) + useToast() hook exposing addToast()/removeToast()                                               │
│ - All toasts render bottom-right, stacked vertically via portal                                                                   │
│ - Types: info (sky), success (emerald), warning (amber), error (rose), conflict (amber)                                           │
│ - Auto-dismiss: 5s for info/success, 8s for error/warning, manual-only for conflict                                               │
│ - Supports optional action buttons (for "Keep mine" / "Keep latest" conflict flow)                                                │
│ - Each toast has a dismiss X button                                                                                               │
│ - Exports: ToastProvider, useToast                                                                                                │
│                                                                                                                                   │
│ Step 1.4 — Create src/components/Skeleton.tsx                                                                                     │
│                                                                                                                                   │
│ Skeleton loading primitives using Tailwind animate-pulse.                                                                         │
│ - Skeleton — base block (rounded-lg bg-slate-700/40 animate-pulse, caller sizes via className)                                    │
│ - BoardCardSkeleton — matches board card layout (rounded-xl card with 2 skeleton lines)                                           │
│ - BoardPageSkeleton — full-page skeleton matching canvas layout (toolbar + inspector + canvas area)                               │
│                                                                                                                                   │
│ Step 1.5 — Add animations to src/styles.css                                                                                       │
│                                                                                                                                   │
│ Add custom keyframes via Tailwind 4.x @theme block:                                                                               │
│ - animate-note-appear — scale(0.95)+opacity(0) to scale(1)+opacity(1) over 200ms                                                  │
│ - animate-drawer-in — translateX(100%) to translateX(0) over 300ms                                                                │
│                                                                                                                                   │
│ Step 1.6 — Extract src/components/NoteCard.tsx from BoardCanvas                                                                   │
│                                                                                                                                   │
│ Lines 649-762 of BoardCanvas become a standalone component.                                                                       │
│ - Props: note, isActive, isSelected, onSelect, onStartDrag, onStartResize, onRemove, onReactionToggle                             │
│ - Fix: Resize handle enlarged from w-4 h-4 to w-6 h-6 with GripHorizontal icon from lucide-react                                  │
│ - Fix: Add animate-note-appear class + transition-shadow duration-150 for selection ring                                          │
│ - Keeps toSafeLink as a local helper (or moves to src/lib/notes.ts)                                                               │
│                                                                                                                                   │
│ Step 1.7 — Extract src/components/Inspector.tsx from BoardCanvas                                                                  │
│                                                                                                                                   │
│ Lines 423-637 become a standalone component.                                                                                      │
│ - Props: selectedNote, onUpdateNote, onUpdateNoteImage, onFitNoteToImage, onRemoveNoteImage, onRemoveNote                         │
│ - Manages own inspectorTab state internally                                                                                       │
│ - Color swatches show title tooltip with label from NOTE_COLOR_LABELS                                                             │
│                                                                                                                                   │
│ Step 1.8 — Extract src/components/CanvasToolbar.tsx from BoardCanvas                                                              │
│                                                                                                                                   │
│ Lines 347-419 become a standalone component.                                                                                      │
│ - Props: title, filteredCount, totalCount, syncState, query, onQueryChange, colorFilter, onColorFilterChange, tagFilter,          │
│ onTagFilterChange, tags, onCreateNote, rightActions?                                                                              │
│ - Fix: Replace color filter <select> showing hex values with a custom dropdown rendering color swatch circles + labels from       │
│ NOTE_COLOR_LABELS                                                                                                                 │
│                                                                                                                                   │
│ Step 1.9 — Update src/components/BoardCanvas.tsx to use extracted components                                                      │
│                                                                                                                                   │
│ Becomes a ~250-line composition shell. State management + drag/resize handlers stay here. Image read helpers move to              │
│ src/lib/canvas-helpers.ts.                                                                                                        │
│                                                                                                                                   │
│ Step 1.10 — Create src/components/BoardSettingsDrawer.tsx                                                                         │
│                                                                                                                                   │
│ Slide-out drawer replacing the below-canvas settings/members/invites sections (lines 1556-1723 of board.$boardId.tsx).            │
│ - Slides from right: fixed inset-y-0 right-0 z-40 w-full max-w-md, backdrop closes on click                                       │
│ - Transition: translate-x-full <-> translate-x-0 with duration-300                                                                │
│ - Three sections: Invites (create + active list), Board Settings (rename, delete/leave), Members (list with role/remove/transfer  │
│ actions)                                                                                                                          │
│ - Uses ConfirmDialog for destructive actions instead of window.confirm()/window.prompt()                                          │
│ - Shows presence users, sync stats (revision, last sync, conflicts, realtime status) — moved from header                          │
│ - Invite creation controls (role/mode selects + create button) — moved from header                                                │
│                                                                                                                                   │
│ Step 1.11 — Create src/components/BoardHeaderActions.tsx                                                                          │
│                                                                                                                                   │
│ Compact responsive header replacing 13+ inline elements.                                                                          │
│ - Shows only: realtime status dot, presence count, "Settings" button (gear icon), "Boards" link, "Log out" button                 │
│ - Stats/invite controls moved into the drawer (Step 1.10)                                                                         │
│                                                                                                                                   │
│ Step 1.12 — Update src/routes/__root.tsx                                                                                          │
│                                                                                                                                   │
│ Wrap children with <ToastProvider>.                                                                                               │
│                                                                                                                                   │
│ Step 1.13 — Update src/routes/board.$boardId.tsx (main integration)                                                               │
│                                                                                                                                   │
│ - Add settingsOpen state; pass <BoardHeaderActions> as rightActions                                                               │
│ - Render <BoardSettingsDrawer> instead of below-canvas sections                                                                   │
│ - Replace 3 notification divs with useToast() calls                                                                               │
│ - Replace 4x window.confirm()/window.prompt() with ConfirmDialog state                                                            │
│ - Move roleBadgeClassName to notes.ts                                                                                             │
│ - Replace loading states with <BoardPageSkeleton />                                                                               │
│                                                                                                                                   │
│ Step 1.14 — Update src/routes/boards.tsx                                                                                          │
│                                                                                                                                   │
│ - Replace "Loading boards..." with 4x <BoardCardSkeleton /> in grid                                                               │
│ - Enrich board cards: role badge (colored), relative timestamp ("Updated 2h ago")                                                 │
│                                                                                                                                   │
│ Execution Order                                                                                                                   │
│                                                                                                                                   │
│ Parallel:  1.1, 1.2, 1.3, 1.4, 1.5 (no dependencies)                                                                              │
│ Parallel:  1.6, 1.7, 1.8 (depend on 1.1/1.5)                                                                                      │
│ Then:      1.9 (depends on 1.6-1.8)                                                                                               │
│ Parallel:  1.10 (depends on 1.2), 1.11 (depends on 1.10)                                                                          │
│ Then:      1.12 (depends on 1.3), 1.13 (depends on all above), 1.14 (depends on 1.4)                                              │
│                                                                                                                                   │
│                                                                                                                                   │
│ Files Created (9 new)                                                                                                             │
│                                                                                                                                   │
│ - src/components/ConfirmDialog.tsx                                                                                                │
│ - src/components/Toast.tsx                                                                                                        │
│ - src/components/Skeleton.tsx                                                                                                     │
│ - src/components/NoteCard.tsx                                                                                                     │
│ - src/components/Inspector.tsx                                                                                                    │
│ - src/components/CanvasToolbar.tsx                                                                                                │
│ - src/components/BoardSettingsDrawer.tsx                                                                                          │
│ - src/components/BoardHeaderActions.tsx                                                                                           │
│ - src/lib/canvas-helpers.ts                                                                                                       │
│                                                                                                                                   │
│ Files Modified (6)                                                                                                                │
│                                                                                                                                   │
│ - src/lib/notes.ts — add NOTE_COLOR_LABELS, roleBadgeClassName, toSafeLink                                                        │
│ - src/styles.css — add @theme animations                                                                                          │
│ - src/components/BoardCanvas.tsx — replace internals with extracted components                                                    │
│ - src/routes/__root.tsx — add ToastProvider                                                                                       │
│ - src/routes/board.$boardId.tsx — use new components, remove old inline UI                                                        │
│ - src/routes/boards.tsx — skeletons + card metadata                                                                               │
│                                                                                                                                   │
│ ---                                                                                                                               │
│ Phase 2: Canvas Zoom/Pan (after Phase 1)                                                                                          │
│                                                                                                                                   │
│ - Add zoom, panX, panY state to BoardCanvas                                                                                       │
│ - Inner transform wrapper: transform: translate(${panX}px, ${panY}px) scale(${zoom})                                              │
│ - Mouse wheel zoom (toward cursor), drag-on-empty-canvas for pan                                                                  │
│ - Update drag/resize handlers: divide screen deltas by zoom                                                                       │
│ - Remove position clamping in sanitizeNotes (allow negative coords for infinite canvas)                                           │
│ - Create src/components/ZoomControls.tsx — floating +/- buttons + zoom % + reset                                                  │
│                                                                                                                                   │
│ Phase 3: Member Display Names (after Phase 1, requires Supabase migration)                                                        │
│                                                                                                                                   │
│ - Create user_profiles table with RLS policies                                                                                    │
│ - Populate profile on signup in auth-fns.ts                                                                                       │
│ - Join profiles in listBoardMembers query in board-store.ts                                                                       │
│ - Update BoardMemberSummary type to include displayName                                                                           │
│ - Show names in BoardSettingsDrawer member list                                                                                   │
│                                                                                                                                   │
│ ---                                                                                                                               │
│ Verification                                                                                                                      │
│                                                                                                                                   │
│ After Phase 1 implementation:                                                                                                     │
│ 1. npm run dev — app starts without errors                                                                                        │
│ 2. Login/signup flow works unchanged                                                                                              │
│ 3. Boards page shows skeleton loading, then cards with role badges + timestamps                                                   │
│ 4. Board page: header is compact (status dot, settings gear, boards link, logout)                                                 │
│ 5. Clicking "Settings" gear opens right-side drawer with invites, settings, members                                               │
│ 6. Destructive actions (delete board, remove member, transfer ownership, leave board) show styled dialog instead of browser       │
│ confirm                                                                                                                           │
│ 7. Toast notifications appear bottom-right, auto-dismiss after timeout                                                            │
│ 8. Color filter shows color swatches + names instead of hex strings                                                               │
│ 9. Resize handle on notes is larger and has a visible grip icon                                                                   │
│ 10. Notes animate in on creation with scale+opacity transition                                                                    │
│ 11. Inspector sidebar works identically to before                                                                                 │
│ 12. All drag/resize/edit/save/sync functionality preserved                                                                        │
│ 13. Realtime presence and collaboration continue working                                                                          │
│ 14. Run npx biome check src/ — no lint errors   
