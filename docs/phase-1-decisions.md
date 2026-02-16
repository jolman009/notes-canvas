# Phase 1 Decisions

## Collaboration Model
- Roles: `owner`, `editor`, `viewer`
- Permissions:
  - `owner`: full board management, member management, content edit, delete
  - `editor`: content read/write, no member management
  - `viewer`: read-only

## Invite Model (Initial)
- Invite type: reusable token (one token can be used by multiple invited users)
- Token expiry: required, default 7 days in future
- Anonymous access: not allowed
- Access requires authenticated Supabase user

## Board / Session Identifier
- Canonical board identifier: `boards.id` UUID
- Session for collaboration is the board ID (or invite token that resolves to board ID)

## Ownership Rules
- `boards.owner_user_id` is immutable in Phase 1
- Ownership transfer is out of scope for Phase 1
- Only `owner` can change membership/roles

## Migration Direction
- Existing single-user data (`user:<user_id>`) will migrate into a default board per user
- Migration execution is deferred to Phase 1 validation/rollout step
