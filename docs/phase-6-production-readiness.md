# Phase 6: Production Readiness

## Environment Variables

| Variable | Required | Where Used | Description |
|----------|----------|------------|-------------|
| `SUPABASE_URL` | Yes | Client + Server | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Client + Server | Supabase anonymous/public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server only | Service role key for admin operations |
| `VITE_SENTRY_DSN` | No | Client only | Sentry DSN for error tracking |

### Notes
- `SUPABASE_URL` and `SUPABASE_ANON_KEY` are exposed to the client via `envPrefix: ['VITE_', 'SUPABASE_']` in `vite.config.ts`
- `SUPABASE_SERVICE_ROLE_KEY` must NEVER be exposed to the client — verified by `scripts/verify-service-role-exposure.mjs`
- `VITE_SENTRY_DSN` is optional; if absent, Sentry is silently disabled
- Environment validation runs on app mount via `src/lib/env-check.ts`

## Supabase Configuration Checklist

- [ ] RLS enabled on all tables (`boards`, `board_members`, `board_invites`, `user_profiles`, `notes`)
- [ ] Auth providers configured (email/password enabled)
- [ ] Site URL and redirect URLs configured for production domain
- [ ] JWT secret rotated from default
- [ ] Database backups enabled (point-in-time recovery)
- [ ] Connection pooling configured for production load
- [ ] Rate limiting configured on auth endpoints

## SLO Definitions

| Metric | Target | Measurement |
|--------|--------|-------------|
| Availability | 99.5% uptime | Vercel status + Supabase status |
| Save latency (p95) | < 2000ms | Client-side telemetry (`collab-telemetry.ts`) |
| Page load (LCP) | < 3000ms | Vercel Analytics / Sentry Web Vitals |
| Invite acceptance | < 5s from click to board access | Manual testing |
| Realtime reconnection | < 10s after disconnect | Reconnect jitter (1-5s) + channel resubscribe |

## Timeout and Retry Policies

| Operation | Timeout | Retries | Backoff |
|-----------|---------|---------|---------|
| Board save | 10s (fetch default) | 3 attempts | Exponential, 500ms base |
| Board load | 10s | 1 (no retry) | — |
| Auth operations | 10s | 1 (no retry) | — |
| Invite creation | 10s | 1 (no retry) | — |
| Realtime reconnect | — | Unlimited | Random jitter 1-5s |

## Error Tracking (Sentry)

- **SDK:** `@sentry/react` v9.x
- **Initialization:** Lazy-loaded in `src/lib/sentry.ts`, called from `__root.tsx`
- **Traces sample rate:** 10% (`tracesSampleRate: 0.1`)
- **Error boundary:** `src/components/ErrorBoundary.tsx` captures React render errors
- **Server bundle:** Sentry is excluded from server via `rollupConfig: { external: [/^@sentry\//] }` in `vite.config.ts`
