import { idempotencyKeys } from '@penpact/db';
import { and, eq } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { sha256Hex } from '../lib/crypto.js';
import { HttpProblem } from '../lib/problem.js';
import type { AppEnv } from '../types.js';

/**
 * Stripe-style idempotent POST. When the client sends an `Idempotency-Key`
 * header we claim the key with a placeholder row (unique on user+key), run the
 * handler once, and store its response. A retry with the same key replays the
 * stored response; a retry with the same key but a different body is a 422; a
 * retry while the original is still in flight is a 409.
 *
 * Must run AFTER apiKeyAuth (needs `userId` + `db`).
 */
export const idempotency: MiddlewareHandler<AppEnv> = async (c, next) => {
  const key = c.req.header('Idempotency-Key');
  if (!key || c.req.method !== 'POST') {
    return next();
  }
  if (key.length > 255) {
    throw new HttpProblem({
      status: 422,
      title: 'Unprocessable Entity',
      detail: 'Idempotency-Key must be at most 255 characters.',
    });
  }

  const db = c.get('db');
  const userId = c.get('userId');
  const bodyText = await c.req.text();
  const requestHash = sha256Hex(`${c.req.method} ${c.req.path} ${bodyText}`);

  // Claim the key. If it already exists, replay / conflict / mismatch.
  const claimed = await db
    .insert(idempotencyKeys)
    .values({ userId, idempotencyKey: key, requestHash, responseStatus: 0 })
    .onConflictDoNothing()
    .returning({ id: idempotencyKeys.id });

  if (claimed.length === 0) {
    const rows = await db
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.idempotencyKey, key)))
      .limit(1);
    const row = rows[0];
    if (row && row.requestHash !== requestHash) {
      throw new HttpProblem({
        status: 422,
        title: 'Unprocessable Entity',
        detail: 'This Idempotency-Key was already used with a different request.',
      });
    }
    if (!row || row.responseStatus === 0) {
      throw new HttpProblem({
        status: 409,
        title: 'Conflict',
        detail: 'A request with this Idempotency-Key is still being processed.',
      });
    }
    c.header('Idempotent-Replayed', 'true');
    return c.json(row.responseBody as unknown, row.responseStatus as 200);
  }

  // We own the key — run the handler once.
  try {
    await next();
  } catch (err) {
    // Release the claim so the caller can retry cleanly.
    await db
      .delete(idempotencyKeys)
      .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.idempotencyKey, key)));
    throw err;
  }

  const res = c.res;
  if (res.status >= 200 && res.status < 300) {
    let parsed: unknown = null;
    try {
      parsed = await res.clone().json();
    } catch {
      parsed = null;
    }
    await db
      .update(idempotencyKeys)
      .set({ responseStatus: res.status, responseBody: parsed })
      .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.idempotencyKey, key)));
  } else {
    // Non-2xx is not cached — drop the claim so a corrected retry can proceed.
    await db
      .delete(idempotencyKeys)
      .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.idempotencyKey, key)));
  }
};
