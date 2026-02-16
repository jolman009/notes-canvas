# Phase 1 Checklist: Collaboration Session ID Foundation

## Scope
Phase 1 covers:
- Collaboration model definition
- Database schema setup
- RLS policy baseline

## TODO
- [x] Finalize collaboration roles and permissions matrix (`owner`, `editor`, `viewer`).
- [x] Finalize invite policy decision:
  - [x] One-time token or reusable token
  - [x] Expiration strategy
  - [x] Anonymous access allowed or not (default: not allowed)
- [x] Define canonical board/session identifier format (`board_id` UUID).
- [x] Define persistence ownership rules:
  - [x] Board owner is immutable unless ownership transfer flow is implemented
  - [x] Member role changes require owner privileges
- [x] Create SQL migration for core tables:
  - [x] `boards`
  - [x] `board_members`
  - [x] `board_state`
- [x] Add required indexes:
  - [x] `board_members(user_id)`
  - [x] `board_members(board_id)`
  - [x] `board_state(board_id)`
- [x] Add initial RLS policies:
  - [x] `board_state` select/update restricted to board members
  - [x] `boards` read/write restricted by ownership/membership
  - [x] `board_members` insert/update/delete restricted to owner
- [x] Create SQL policy test queries for:
  - [x] Owner access
  - [x] Editor access
  - [x] Viewer access
  - [x] Non-member denial
- [x] Decide migration approach for existing data:
  - [x] Create one default board per current user
  - [x] Move `user:<user_id>` notes into `board_state`
- [x] Add implementation notes after SQL is validated in Supabase.

## Exit Criteria
- [x] Schema is applied in Supabase without manual patching.
- [x] RLS blocks non-members from reading/updating board state.
- [x] Owners can manage members; non-owners cannot.
- [x] Existing users can be mapped to one default board without data loss.

## Artifacts Added
- `docs/phase-1-decisions.md`
- `supabase/phase1_collaboration_schema.sql`
- `supabase/phase1_policy_tests.sql`

## Validation Notes
- Supabase SQL Editor run completed for `supabase/phase1_collaboration_schema.sql`.
- Policy checks validated via `supabase/phase1_policy_tests.sql` and data verification:
  - Owner and editor writes succeeded (`revision` advanced to `2`).
  - Viewer/non-owner write paths were denied as expected.
