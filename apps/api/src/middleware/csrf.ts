import type { Context, MiddlewareHandler } from 'hono';
import { HttpProblem } from '../lib/problem.js';
import type { AppEnv } from '../types.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function allowedOrigin(c: Context): string | null {
  const base = process.env.PUBLIC_BASE_URL;
  if (base) {
    try {
      return new URL(base).origin;
    } catch {
      // fall through to host-derived origin
    }
  }
  const host = c.req.header('host');
  if (!host) return null;
  const proto = c.req.header('x-forwarded-proto') ?? 'http';
  return `${proto}://${host}`;
}

/**
 * CSRF defense for cookie-authenticated routes: reject unsafe-method requests
 * whose Origin header does not match the app's own origin. Browsers always send
 * Origin on cross-site fetch/form submissions, so a mismatched Origin is the
 * CSRF signature. Requests without an Origin (curl, server-to-server) pass;
 * the SameSite=Lax session cookie is the second layer of defense.
 */
export const csrfProtect: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!SAFE_METHODS.has(c.req.method)) {
    const origin = c.req.header('origin');
    if (origin) {
      const allowed = allowedOrigin(c);
      if (allowed && origin !== allowed) {
        throw new HttpProblem({
          status: 403,
          title: 'Forbidden',
          detail: 'Cross-origin request blocked.',
        });
      }
    }
  }
  await next();
};
