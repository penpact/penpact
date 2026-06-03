import { type Context, Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { getDb } from '../db.js';
import { clientIp, userAgent } from '../lib/request.js';
import { validateJson } from '../lib/validate.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { SESSION_COOKIE, sessionAuth } from '../middleware/session.js';
import { createKeySchema, createWebhookEndpointSchema, credentialsSchema } from '../schemas.js';
import {
  createApiKey,
  getSessionUser,
  getUsage,
  listApiKeys,
  logIn,
  logOut,
  revokeApiKey,
  type SessionResult,
  signUp,
} from '../services/accounts.js';
import {
  createEndpoint,
  deleteEndpoint,
  listDeliveries,
  listEndpoints,
} from '../services/webhooks.js';
import type { AppEnv } from '../types.js';

const reqMeta = (c: Context) => ({ ip: clientIp(c), ua: userAgent(c) });
const secure = process.env.NODE_ENV === 'production';

function setSessionCookie(c: Context, session: SessionResult): void {
  setCookie(c, SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: '/',
    expires: session.expiresAt,
  });
}

export const dashboard = new Hono<AppEnv>();

// ─── Auth (cookie session) ───
const authRoute = new Hono<AppEnv>();
authRoute.use('*', rateLimit({ windowMs: 15 * 60_000, max: 30 }));

authRoute.post('/signup', validateJson(credentialsSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const session = await signUp(getDb(), email, password, reqMeta(c));
  setSessionCookie(c, session);
  return c.json({ ok: true }, 201);
});

authRoute.post('/login', validateJson(credentialsSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const session = await logIn(getDb(), email, password, reqMeta(c));
  setSessionCookie(c, session);
  return c.json({ ok: true });
});

authRoute.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    await logOut(getDb(), token);
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.body(null, 204);
});

dashboard.route('/auth', authRoute);

// ─── Authenticated dashboard API ───
const api = new Hono<AppEnv>();
api.use('*', sessionAuth);

api.get('/me', async (c) => {
  // sessionAuth already validated; re-read for the full record.
  const token = getCookie(c, SESSION_COOKIE) ?? '';
  const user = await getSessionUser(c.get('db'), token);
  return c.json({ email: user?.email, name: user?.name ?? null });
});

api.get('/api-keys', async (c) => {
  return c.json({ data: await listApiKeys(c.get('db'), c.get('userId')) });
});

api.post('/api-keys', validateJson(createKeySchema), async (c) => {
  const { name } = c.req.valid('json');
  const minted = await createApiKey(c.get('db'), c.get('userId'), name);
  // The full secret is returned exactly once.
  return c.json(minted, 201);
});

api.delete('/api-keys/:id', async (c) => {
  await revokeApiKey(c.get('db'), c.get('userId'), c.req.param('id'));
  return c.body(null, 204);
});

api.get('/usage', async (c) => {
  return c.json(await getUsage(c.get('db'), c.get('userId')));
});

// ─── Webhook endpoints + deliveries ───
api.get('/webhook-endpoints', async (c) => {
  return c.json({ data: await listEndpoints(c.get('db'), c.get('userId')) });
});

api.post('/webhook-endpoints', validateJson(createWebhookEndpointSchema), async (c) => {
  const { url, description } = c.req.valid('json');
  // The signing secret is returned exactly once.
  const created = await createEndpoint(c.get('db'), c.get('userId'), url, description);
  return c.json(created, 201);
});

api.delete('/webhook-endpoints/:id', async (c) => {
  await deleteEndpoint(c.get('db'), c.get('userId'), c.req.param('id'));
  return c.body(null, 204);
});

api.get('/webhook-deliveries', async (c) => {
  return c.json({ data: await listDeliveries(c.get('db'), c.get('userId')) });
});

dashboard.route('/', api);
