import type { MiddlewareHandler } from 'hono';
import { HttpProblem } from '../lib/problem.js';
import { clientIp } from '../lib/request.js';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Minimal in-memory fixed-window rate limiter, keyed by client IP.
 * Defense-in-depth (signing tokens are already high-entropy). Per-instance only;
 * swap for a shared store (Redis) when running multiple nodes.
 */
export function rateLimit(options: { windowMs: number; max: number }): MiddlewareHandler {
  const buckets = new Map<string, Bucket>();
  return async (c, next) => {
    const key = clientIp(c) ?? 'unknown';
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    const remaining = Math.max(0, options.max - bucket.count);
    c.header('X-RateLimit-Limit', String(options.max));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > options.max) {
      c.header('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      throw new HttpProblem({
        status: 429,
        title: 'Too Many Requests',
        detail: 'Rate limit exceeded. Slow down and retry shortly.',
      });
    }
    await next();
  };
}
