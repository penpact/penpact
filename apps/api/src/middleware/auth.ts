import { apiKeys } from '@penpact/db';
import { and, eq, isNull } from 'drizzle-orm';
import type { MiddlewareHandler } from 'hono';
import { getDb } from '../db.js';
import { hashApiKey } from '../lib/crypto.js';
import { HttpProblem } from '../lib/problem.js';
import { personalOrgId } from '../services/organizations.js';
import type { AppEnv } from '../types.js';

/**
 * Authenticate the integrator by their secret API key (Bearer token).
 * We look up by SHA-256(key) — the raw key is never stored. High-entropy
 * random keys make an indexed equality lookup safe.
 */
export const apiKeyAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new HttpProblem({
      status: 401,
      title: 'Unauthorized',
      detail: 'Provide your API key as a Bearer token.',
    });
  }

  const key = header.slice('Bearer '.length).trim();
  const db = getDb();
  const rows = await db
    .select({ userId: apiKeys.userId, mode: apiKeys.mode, organizationId: apiKeys.organizationId })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hashApiKey(key)), isNull(apiKeys.revokedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new HttpProblem({ status: 401, title: 'Unauthorized', detail: 'Invalid API key.' });
  }

  c.set('db', db);
  c.set('userId', row.userId);
  c.set('mode', row.mode === 'test' ? 'test' : 'live');
  c.set('organizationId', row.organizationId ?? (await personalOrgId(db, row.userId)));
  await next();
};
