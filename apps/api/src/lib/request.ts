import type { Context } from 'hono';

/** Best-effort client IP for the audit trail (behind a proxy/CDN). */
export function clientIp(c: Context): string | null {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? null;
  }
  return c.req.header('x-real-ip') ?? null;
}

export function userAgent(c: Context): string | null {
  return c.req.header('user-agent') ?? null;
}
