import { createHmac, randomUUID } from 'node:crypto';
import { type Database, webhookDeliveries, webhookEndpoints } from '@penpact/db';
import { and, eq, lte } from 'drizzle-orm';
import { generateWebhookSecret } from '../lib/crypto.js';

export interface WebhookEvent {
  id: string;
  type: 'envelope.completed' | 'envelope.declined';
  createdAt: string;
  data: { envelopeId: string; status: string; documentHashFinal: string | null };
}

/** HMAC-SHA256 of the raw JSON body — receivers verify the `Penpact-Signature` header. */
export function signWebhook(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

/**
 * Timestamped signature (Stripe-style) for the `Penpact-Signature` header:
 * `t=<unixSeconds>,v1=<hex HMAC of "t.body">`. The timestamp lets receivers
 * reject replays; v1 is recomputed over `${t}.${rawBody}`.
 */
export function signPayload(secret: string, rawBody: string, unixSeconds: number): string {
  const v1 = createHmac('sha256', secret).update(`${unixSeconds}.${rawBody}`).digest('hex');
  return `t=${unixSeconds},v1=${v1}`;
}

export function parseSignatureHeader(header: string): { t: number; v1: string } | null {
  const parts = new Map<string, string>();
  for (const segment of header.split(',')) {
    const eq = segment.indexOf('=');
    if (eq === -1) continue;
    parts.set(segment.slice(0, eq).trim(), segment.slice(eq + 1).trim());
  }
  const tRaw = parts.get('t');
  const v1 = parts.get('v1');
  if (!tRaw || !v1) return null;
  const t = Number(tRaw);
  if (!Number.isInteger(t)) return null;
  return { t, v1 };
}

/**
 * Delay (seconds) before the next attempt, indexed by attempts already made.
 * 0 = deliver immediately; then 1m, 5m, 30m, 2h, 6h. Clamps to the last value.
 */
export const BACKOFF_SECONDS = [0, 60, 300, 1800, 7200, 21600] as const;

export function nextDelaySeconds(attemptsMade: number): number {
  const last = BACKOFF_SECONDS[BACKOFF_SECONDS.length - 1] as number;
  return BACKOFF_SECONDS[attemptsMade] ?? last;
}

export function isExhausted(attemptsMade: number, maxAttempts: number): boolean {
  return attemptsMade >= maxAttempts;
}

export function buildCompletedEvent(
  envelopeId: string,
  documentHashFinal: string | null,
): WebhookEvent {
  return {
    id: `evt_${randomUUID()}`,
    type: 'envelope.completed',
    createdAt: new Date().toISOString(),
    data: { envelopeId, status: 'completed', documentHashFinal },
  };
}

/**
 * Best-effort delivery to a configured endpoint. Per-customer endpoints + a
 * retry queue arrive with the dashboard (Phase 5); for now a single
 * `WEBHOOK_URL`/`WEBHOOK_SECRET` is used when present.
 */
export async function dispatchWebhook(event: WebhookEvent): Promise<void> {
  const url = process.env.WEBHOOK_URL;
  if (!url) {
    return;
  }
  const body = JSON.stringify(event);
  const signature = signWebhook(body, process.env.WEBHOOK_SECRET ?? '');
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Penpact-Signature': signature },
      body,
    });
  } catch {
    // Swallow delivery errors; a durable retry queue is a later increment.
  }
}

// ─── Per-customer endpoints + durable delivery queue ───

export interface EndpointSummary {
  id: string;
  url: string;
  description: string | null;
  active: boolean;
  createdAt: string;
}

export interface CreatedEndpoint extends EndpointSummary {
  /** The signing secret — returned once on creation, never listed again. */
  secret: string;
}

export async function createEndpoint(
  db: Database,
  userId: string,
  url: string,
  description?: string,
): Promise<CreatedEndpoint> {
  const secret = generateWebhookSecret();
  const inserted = await db
    .insert(webhookEndpoints)
    .values({ userId, url, secret, description: description ?? null })
    .returning();
  const row = inserted[0];
  if (!row) {
    throw new Error('Failed to create webhook endpoint');
  }
  return {
    id: row.id,
    url: row.url,
    description: row.description,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    secret,
  };
}

export async function listEndpoints(db: Database, userId: string): Promise<EndpointSummary[]> {
  const rows = await db
    .select({
      id: webhookEndpoints.id,
      url: webhookEndpoints.url,
      description: webhookEndpoints.description,
      active: webhookEndpoints.active,
      createdAt: webhookEndpoints.createdAt,
    })
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.userId, userId));
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    description: r.description,
    active: r.active,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function deleteEndpoint(db: Database, userId: string, id: string): Promise<void> {
  await db
    .delete(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.userId, userId)));
}

/**
 * Enqueue one durable delivery per active endpoint of the envelope's owner.
 * Returns how many deliveries were enqueued. The worker handles the actual send.
 */
export async function enqueueEnvelopeEvent(
  db: Database,
  userId: string,
  event: WebhookEvent,
): Promise<number> {
  const endpoints = await db
    .select({ id: webhookEndpoints.id })
    .from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.userId, userId), eq(webhookEndpoints.active, true)));
  if (endpoints.length === 0) {
    return 0;
  }
  await db.insert(webhookDeliveries).values(
    endpoints.map((e) => ({
      endpointId: e.id,
      eventId: event.id,
      eventType: event.type,
      payload: event,
    })),
  );
  return endpoints.length;
}

export interface WebhookFetchResponse {
  ok: boolean;
  status: number;
}
export type WebhookFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<WebhookFetchResponse>;

export interface DrainOptions {
  fetch?: WebhookFetch;
  now?: Date;
  limit?: number;
}

export interface DrainSummary {
  attempted: number;
  succeeded: number;
  rescheduled: number;
  failed: number;
}

/**
 * Send every due `pending` delivery once. On 2xx → succeeded. On failure →
 * reschedule with exponential backoff, or mark `failed` once attempts reach
 * maxAttempts. The fetch impl and clock are injectable for testing.
 */
export async function drainDueDeliveries(db: Database, opts: DrainOptions = {}): Promise<DrainSummary> {
  const now = opts.now ?? new Date();
  const send = opts.fetch ?? (globalThis.fetch as unknown as WebhookFetch);
  const limit = opts.limit ?? 50;

  const due = await db
    .select({
      id: webhookDeliveries.id,
      attempts: webhookDeliveries.attempts,
      maxAttempts: webhookDeliveries.maxAttempts,
      eventType: webhookDeliveries.eventType,
      payload: webhookDeliveries.payload,
      url: webhookEndpoints.url,
      secret: webhookEndpoints.secret,
    })
    .from(webhookDeliveries)
    .innerJoin(webhookEndpoints, eq(webhookEndpoints.id, webhookDeliveries.endpointId))
    .where(and(eq(webhookDeliveries.status, 'pending'), lte(webhookDeliveries.nextAttemptAt, now)))
    .limit(limit);

  const summary: DrainSummary = { attempted: due.length, succeeded: 0, rescheduled: 0, failed: 0 };

  for (const d of due) {
    const body = JSON.stringify(d.payload);
    const signature = signPayload(d.secret, body, Math.floor(now.getTime() / 1000));
    let ok = false;
    let responseStatus: number | null = null;
    let error: string | null = null;
    try {
      const res = await send(d.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'Penpact-Signature': signature,
          'Penpact-Event': d.eventType,
          'Penpact-Delivery': d.id,
        },
        body,
      });
      ok = res.ok;
      responseStatus = res.status;
      if (!ok) error = `HTTP ${res.status}`;
    } catch (e) {
      error = e instanceof Error ? e.message : 'delivery failed';
    }

    const attempts = d.attempts + 1;
    if (ok) {
      await db
        .update(webhookDeliveries)
        .set({ status: 'succeeded', attempts, lastAttemptAt: now, responseStatus, error: null })
        .where(eq(webhookDeliveries.id, d.id));
      summary.succeeded += 1;
    } else if (isExhausted(attempts, d.maxAttempts)) {
      await db
        .update(webhookDeliveries)
        .set({ status: 'failed', attempts, lastAttemptAt: now, responseStatus, error })
        .where(eq(webhookDeliveries.id, d.id));
      summary.failed += 1;
    } else {
      const nextAttemptAt = new Date(now.getTime() + nextDelaySeconds(attempts) * 1000);
      await db
        .update(webhookDeliveries)
        .set({ status: 'pending', attempts, lastAttemptAt: now, responseStatus, error, nextAttemptAt })
        .where(eq(webhookDeliveries.id, d.id));
      summary.rescheduled += 1;
    }
  }

  return summary;
}
