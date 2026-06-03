# Email Verification + Password Reset Implementation Plan

> REQUIRED SUB-SKILL: superpowers:test-driven-development. Checkbox steps.

**Goal:** Let users verify their email after signup and reset a forgotten password, using the now-live Resend `sendEmail` primitive.

**Architecture:** One `auth_tokens` table holds single-use, hashed, expiring tokens with a `purpose` ('verify_email' | 'password_reset'). A small `auth-tokens.ts` service mints (returns the raw token, stores SHA-256) and consumes (validates unused+unexpired, marks used) tokens. Accounts service gains `verifyEmail`, `requestPasswordReset`, `resetPassword`. Dashboard routes email a link on signup / reset request and accept the token back. The `/app` page handles `?verify=` and `?reset=` query params. No user enumeration on reset request.

**Tech Stack:** Drizzle/Postgres, Hono, Node crypto, Resend (sendEmail), Vitest.

---

## File structure
- `packages/db/src/schema.ts` — add `users.email_verified_at`, `auth_tokens` table + enum `auth_token_purpose`, relation.
- `packages/db/drizzle/0005_auth_tokens.sql` + journal.
- `apps/api/src/services/auth-tokens.ts` — createAuthToken / consumeAuthToken (pure-ish, DB).
- `apps/api/src/services/accounts.ts` — verifyEmail, requestPasswordReset, resetPassword; signUp returns userId; getSessionUser returns emailVerified.
- `apps/api/src/services/email.ts` — buildVerifyEmail, buildResetEmail (pure).
- `apps/api/src/routes/dashboard.ts` — email on signup; POST /auth/verify-email, /auth/request-reset, /auth/reset-password.
- `apps/api/src/schemas.ts` — tokenSchema, requestResetSchema, resetPasswordSchema.
- `apps/api/src/web/dashboard-page.ts` — handle ?verify= and ?reset=, add "Forgot password?".
- Tests: `tests/api/email.test.ts` (+ verify/reset templates), `tests/api/accounts-tokens.int.test.ts` (token lifecycle + verify + reset).

## Data model
`auth_token_purpose` enum: `verify_email`, `password_reset`.
`auth_tokens`: id, user_id (cascade), purpose (enum), token_hash (text, unique), expires_at (tz), used_at (tz null), created_at. Token = base62(40), stored as SHA-256(token). Verify TTL 7d, reset TTL 1h.
`users.email_verified_at` (tz, null).

## Task 1: Email templates (pure)
- [ ] RED: `buildVerifyEmail({to, verifyUrl})` subject mentions "verify"/"confirm", html contains the url; `buildResetEmail({to, resetUrl})` contains the url; both escape nothing dangerous (urls are ours).
- [ ] GREEN. Commit.

## Task 2: Schema + migration 0005
- [ ] Add enum, table, `email_verified_at`, relation; hand-author SQL + journal idx 5; `pnpm --filter @penpact/db build`. Commit.

## Task 3: auth-tokens service (DB int)
- [ ] RED int: createAuthToken returns a raw token; consumeAuthToken with the right token+purpose returns userId once (second use → null); wrong purpose → null; expired → null.
- [ ] GREEN createAuthToken/consumeAuthToken. Commit.

## Task 4: accounts verifyEmail / requestPasswordReset / resetPassword (DB int)
- [ ] RED int: signUp then verifyEmail(token) sets email_verified_at; requestPasswordReset returns a token for an existing email and null for unknown (no throw); resetPassword(token,newpw) changes the hash so logIn works with the new password and old sessions are gone.
- [ ] GREEN. signUp returns userId. Commit.

## Task 5: Routes + signup email + dashboard UI
- [ ] POST /dashboard/auth/{verify-email,request-reset,reset-password}; signup emails a verify link; request-reset always 200; rate-limit reset endpoints. Dashboard page handles ?verify=/?reset= and a "Forgot password?" form. Build + unit green. Commit.

## Task 6: Live verification
- [ ] Deploy; signup a user with to=delivered@resend.dev style check via logs; request reset → Resend delivered; reset password → login with new password works. (verification-before-completion)
