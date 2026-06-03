# Webhook Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans / test-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the single fire-once global webhook with per-customer endpoints, a durable delivery queue, signed retries with backoff, and a deliveries log visible in the dashboard.

**Architecture:** Two new tables — `webhook_endpoints` (per user, each with its own signing secret) and `webhook_deliveries` (the durable queue + audit log). On envelope completion/decline we enqueue one `pending` delivery row per active endpoint of the envelope's owner. An in-process worker drains due deliveries (`next_attempt_at <= now`), POSTs a timestamped HMAC-signed payload, and on failure reschedules with exponential backoff up to a max attempt count, then marks `failed`. The dashboard exposes endpoint CRUD (secret shown once) and a recent-deliveries view.

**Tech Stack:** Drizzle/Postgres, Hono, Node crypto (HMAC), Vitest. No new deps.

---

## File structure

- `packages/db/src/schema.ts` — add `webhookEndpoints`, `webhookDeliveries`, enum `webhook_delivery_status`, relations.
- `packages/db/drizzle/0004_webhooks.sql` + journal entry — migration.
- `apps/api/src/services/webhooks.ts` — rewrite: signing (timestamped), enqueue, drain/attempt, backoff, endpoint CRUD service fns.
- `apps/api/src/services/webhook-worker.ts` — `startWebhookWorker()` interval drainer; `drainDueDeliveries(db)` pure-ish core.
- `apps/api/src/services/signing.ts` — replace `dispatchWebhook(...)` calls with `enqueueEnvelopeEvent(db, 'envelope.completed'|'envelope.declined', ...)`.
- `apps/api/src/routes/dashboard.ts` — add endpoint CRUD + deliveries routes.
- `apps/api/src/schemas.ts` — `createWebhookEndpointSchema`.
- `apps/api/src/index.ts` — call `startWebhookWorker()` in the listener block.
- Tests: `tests/api/webhooks.test.ts` (extend: signing + backoff, pure units), `tests/api/webhooks.int.test.ts` (enqueue → drain → retry, DB-gated).

## Data model

`webhook_endpoints`: id, user_id (cascade), url (text), secret_hash? No — we must send the secret to sign, so store the secret in plaintext (it is a shared HMAC secret, not a password; needed at send time). Columns: id, user_id, url, secret (text, `whsec_…`), description (text null), active (bool default true), created_at.

`webhook_deliveries`: id, endpoint_id (cascade), event_id (text), event_type (text), payload (jsonb), status (enum), attempts (int default 0), max_attempts (int default 6), last_attempt_at (ts null), next_attempt_at (ts default now), response_status (int null), error (text null), created_at.

`webhook_delivery_status` enum: `pending`, `succeeded`, `failed`.

Backoff schedule by attempt count (after a failed attempt N, delay before next): `[0, 60, 300, 1800, 7200, 21600]` seconds (attempt 1 immediate, then 1m/5m/30m/2h/6h). After `max_attempts` failures → `failed`.

Signature: `Penpact-Signature: t=<unixSeconds>,v1=<hexHmac>` where hmac = HMAC_SHA256(secret, `${t}.${rawBody}`). Also send `Penpact-Event`, `Penpact-Delivery` (delivery id) headers. Receivers reject if |now - t| too large (replay) and recompute v1.

---

## Task 1: Signing helper (timestamped, pure unit)

**Files:** Modify `apps/api/src/services/webhooks.ts`; Test `tests/api/webhooks.test.ts`.

- [ ] Write failing test: `signPayload(secret, body, t)` returns `t=<t>,v1=<hmac>` and `hmac === HMAC_SHA256(secret, t + '.' + body)`; verify a known vector.
- [ ] Run → fails (function not exported).
- [ ] Implement `signPayload` + `parseSignatureHeader`.
- [ ] Run → passes. Commit.

## Task 2: Backoff schedule (pure unit)

- [ ] Failing test: `nextDelaySeconds(attempts)` → 0,60,300,1800,7200,21600 for 1..6; `isExhausted(attempts, max)` true at max.
- [ ] Implement `nextDelaySeconds` + `BACKOFF`. Run → pass. Commit.

## Task 3: Schema + migration

- [ ] Add tables/enum/relations to schema.ts.
- [ ] Hand-author `0004_webhooks.sql`, add journal entry idx 4.
- [ ] `pnpm --filter @penpact/db build` → clean. Apply to a DB later in int test. Commit.

## Task 4: Endpoint CRUD service + enqueue (DB-gated int test)

- [ ] Failing int test: create endpoint → list shows it (secret only on create); enqueue completed event → one pending delivery per active endpoint.
- [ ] Implement `createEndpoint/listEndpoints/deleteEndpoint`, `enqueueEnvelopeEvent`. Run int (DATABASE_URL) → pass. Commit.

## Task 5: Drain worker with retry (DB-gated int test)

- [ ] Failing int test: stub fetch to fail once then succeed; `drainDueDeliveries` after first run → attempts=1, status pending, next_attempt_at in future; force due + run again → succeeded.
- [ ] Implement `attemptDelivery` + `drainDueDeliveries(db, fetchImpl, now)`. Inject fetch + clock for testability. Run → pass. Commit.

## Task 6: Wire into signing + dashboard routes + worker start

- [ ] Replace dispatch calls in signing.ts with `enqueueEnvelopeEvent` (completed + declined).
- [ ] Dashboard: GET/POST/DELETE `/dashboard/webhook-endpoints`, GET `/dashboard/webhook-deliveries`.
- [ ] `startWebhookWorker()` in index.ts listener.
- [ ] Build + unit tests green. Commit.

## Task 7: Verify live + deploy

- [ ] Migrate prod, deploy, create endpoint via dashboard API pointing at a request-bin, run a real signing → observe delivery succeeded. (verification-before-completion)
