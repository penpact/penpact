import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { getDb } from '../db.js';
import { HttpProblem } from '../lib/problem.js';
import { getSessionUser } from '../services/accounts.js';
import type { AppEnv } from '../types.js';

export const SESSION_COOKIE = 'penpact_session';

/** Authenticate a dashboard request by its session cookie. */
export const sessionAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) {
    throw new HttpProblem({ status: 401, title: 'Unauthorized', detail: 'Sign in to continue.' });
  }
  const db = getDb();
  const user = await getSessionUser(db, token);
  if (!user) {
    throw new HttpProblem({
      status: 401,
      title: 'Unauthorized',
      detail: 'Your session has expired.',
    });
  }
  c.set('db', db);
  c.set('userId', user.id);
  await next();
};
