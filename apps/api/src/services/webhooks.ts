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
