# Session ID Collaboration Rollout Plan

## Goal
Implement collaborative canvases using shareable session identifiers (board IDs / invite tokens) with secure access control and scalable sync.

## 12-Step Implementation Plan

1. Define collaboration model
- Decide roles: `owner`, `editor`, `viewer`.
- Decide invite behavior: one-time token vs reusable link.
- Decide whether anonymous invite access is allowed (recommended: no).

2. Add database schema
- Create `boards` table: `id`, `title`, `owner_user_id`, `created_at`.
- Create `board_members` table: `board_id`, `user_id`, `role`, `created_at`.
- Create `board_state` table: `board_id`, `notes`, `updated_at`.
- Create indexes on `board_members.user_id` and `board_state.board_id`.

3. Add RLS policies
- Allow select/update on `board_state` only for users in `board_members`.
- Allow board management only for owners.
- Allow member insert/delete only by owners (or admins).

4. Add invite-token system
- Create `board_invites` table: `token`, `board_id`, `role`, `expires_at`, `created_by`.
- Add server function to create invite token (owner-only).
- Add server function to accept invite token and insert into `board_members`.

5. Refactor persistence layer
- Replace `user:<user_id>` storage key with `board:<board_id>`.
- Update load/save server functions to require `board_id`.
- Validate membership on every load/save call server-side.

6. Add board selection UX
- Add "My Boards" page: list boards user belongs to.
- Add create-board flow.
- Add route structure like `/board/$boardId`.

7. Add share UX
- Add "Invite" button in board header.
- Generate copyable invite link with token.
- Add `/invite/$token` route to accept and redirect to board.

8. Add realtime sync
- Subscribe to `board_state` changes (Supabase Realtime) by `board_id`.
- Merge incoming state with local changes (last-write-wins initially).
- Show collaborator presence/status indicator (optional first pass).

9. Add conflict handling
- Add optimistic updates with rollback on save failure.
- Add lightweight version field (`revision`) to prevent silent overwrites.
- Surface "board updated elsewhere" notifications.

10. Security hardening
- Remove anon write access to board tables.
- Enforce authenticated access everywhere.
- Rotate keys and confirm env usage in server-only code.

11. Migration and backfill
- Create default board per existing user.
- Move existing `user:<user_id>` notes into `board_state`.
- Insert owner into `board_members`.

12. Testing and rollout
- Unit test membership checks and invite acceptance.
- Integration test: owner invites user, invited user edits same board.
- Manual QA on create/invite/join/edit/logout/login paths.

## Review Notes
- The sequence is solid: data model -> auth/RLS -> invites -> UX -> realtime.
- Main risk area is step ordering between RLS and invite acceptance; Phase 1 should lock policy design early to avoid rework.
- Current plan assumes a single-board storage model migration; Phase 1 should explicitly define backward compatibility for existing `user:<user_id>` data.

## Phase 1 TODO (Foundation and Security Baseline)

### Scope
Phase 1 covers steps 1 to 3: collaboration model definition, schema creation, and RLS policy baseline.

### TODO Checklist
- [ ] Finalize collaboration roles and permissions matrix (`owner`, `editor`, `viewer`).
- [ ] Finalize invite policy decision:
  - [ ] One-time token or reusable token
  - [ ] Expiration strategy
  - [ ] Anonymous access allowed or not (default: not allowed)
- [ ] Define canonical board/session identifier format (`board_id` UUID).
- [ ] Define persistence ownership rules:
  - [ ] Board owner is immutable unless ownership transfer flow is implemented
  - [ ] Member role changes require owner privileges
- [ ] Create SQL migration for core tables:
  - [ ] `boards`
  - [ ] `board_members`
  - [ ] `board_state`
- [ ] Add required indexes:
  - [ ] `board_members(user_id)`
  - [ ] `board_members(board_id)`
  - [ ] `board_state(board_id)`
- [ ] Add initial RLS policies:
  - [ ] `board_state` select/update restricted to board members
  - [ ] `boards` read/write restricted by ownership/membership
  - [ ] `board_members` insert/update/delete restricted to owner
- [ ] Create SQL policy test queries for:
  - [ ] Owner access
  - [ ] Editor access
  - [ ] Viewer access
  - [ ] Non-member denial
- [ ] Decide migration approach for existing data:
  - [ ] Create one default board per current user
  - [ ] Move `user:<user_id>` notes into `board_state`
- [ ] Add implementation notes to this doc after SQL is validated in Supabase.

### Phase 1 Exit Criteria
- Schema is applied in Supabase without manual patching.
- RLS blocks non-members from reading/updating board state.
- Owners can manage members; non-owners cannot.
- Existing users can be mapped to one default board without data loss.
