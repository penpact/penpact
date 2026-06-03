# Webhooks

Penpact delivers signed, durable webhooks so your app reacts to signing events
without polling. Add an endpoint in the dashboard (or via the API); each endpoint
gets its own signing secret, shown once.

## Event catalog

| Event | Fires when | Key payload fields |
|---|---|---|
| `envelope.completed` | Every signer has signed and the document is sealed | `envelopeId`, `documentHashFinal`, `completedAt` |
| `envelope.declined` | A signer declines | `envelopeId`, `signerId`, `reason` |
| `envelope.voided` | The sender voids the envelope | `envelopeId`, `reason` |

More events (`envelope.sent`, `envelope.viewed`, `signer.signed`) are on the
roadmap; the audit trail already records them and is retrievable per envelope.

## Delivery & retries

Deliveries are queued and retried with exponential backoff
(`0, 1m, 5m, 30m, 2h, 6h`, up to 6 attempts). The queue is multi-instance safe
(`FOR UPDATE SKIP LOCKED` lease), so horizontally-scaled workers never
double-send. Delivery status is visible in the dashboard.

## Verifying signatures

Every request carries a timestamped HMAC signature header:

```
Penpact-Signature: t=1718000000,v1=<hex hmac-sha256>
```

Recompute `HMAC_SHA256(secret, "{t}.{rawBody}")` and compare to `v1` in constant
time. Reject timestamps older than your tolerance (e.g. 5 minutes) to prevent
replay.

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

function verify(rawBody: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  const expected = createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1 ?? '');
  return a.length === b.length && timingSafeEqual(a, b);
}
```
