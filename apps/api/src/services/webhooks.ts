import { createHmac, randomUUID } from 'node:crypto';

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
