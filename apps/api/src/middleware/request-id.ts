import { randomUUID } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types.js';

/**
 * Assign every request a correlation id. Honors an inbound `X-Request-Id`
 * (so a caller can trace across services) and always echoes it back on the
 * response — the Stripe-style request handle.
 */
export const requestId: MiddlewareHandler<AppEnv> = async (c, next) => {
  const incoming = c.req.header('X-Request-Id');
  const id =
    incoming && incoming.length <= 200 ? incoming : `req_${randomUUID().replace(/-/g, '')}`;
  c.set('requestId', id);
  c.header('X-Request-Id', id);
  await next();
};
