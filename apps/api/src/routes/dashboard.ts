import { type Context, Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { getDb } from '../db.js';
import { logger } from '../lib/logger.js';
import { clientIp, userAgent } from '../lib/request.js';
import { validateJson } from '../lib/validate.js';
import { csrfProtect } from '../middleware/csrf.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { SESSION_COOKIE, sessionAuth } from '../middleware/session.js';
import {
  createKeySchema,
  createWebhookEndpointSchema,
  credentialsSchema,
  requestResetSchema,
  resetPasswordSchema,
  tokenSchema,
} from '../schemas.js';
import {
  createApiKey,
  createEmailVerifyToken,
  getSessionUser,
  getUsage,
  listApiKeys,
  logIn,
  logOut,
  requestPasswordReset,
  resetPassword,
  revokeApiKey,
  type SessionResult,
  signUp,
  verifyEmail,
} from '../services/accounts.js';
import { downloadCertificate, listEnvelopeEvents } from '../services/certificate.js';
import { downloadDocument } from '../services/documents.js';
import { buildResetEmail, buildVerifyEmail, sendEmail } from '../services/email.js';
import { type ListOptions, listEnvelopes } from '../services/envelopes.js';
import {
  createEndpoint,
  deleteEndpoint,
  listDeliveries,
  listEndpoints,
} from '../services/webhooks.js';
import { getStorage } from '../storage/index.js';
import type { AppEnv } from '../types.js';

const reqMeta = (c: Context) => ({ ip: clientIp(c), ua: userAgent(c) });
const secure = process.env.NODE_ENV === 'production';
const appUrl = (path: string) => `${process.env.PUBLIC_BASE_URL ?? ''}${path}`;

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

// Cookie-authenticated surface: reject cross-origin unsafe requests (CSRF).
dashboard.use('*', csrfProtect);

// ─── Auth (cookie session) ───
const authRoute = new Hono<AppEnv>();
authRoute.use('*', rateLimit({ windowMs: 15 * 60_000, max: 30 }));

authRoute.post('/signup', validateJson(credentialsSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const db = getDb();
  const session = await signUp(db, email, password, reqMeta(c));
  setSessionCookie(c, session);
  // Best-effort verification email (no-op if email is unconfigured).
  try {
    const { token } = await createEmailVerifyToken(db, session.userId);
    await sendEmail(buildVerifyEmail({ to: email, verifyUrl: appUrl(`/app?verify=${token}`) }));
  } catch (err) {
    logger.error('verify email send failed', { err: String(err) });
  }
  return c.json({ ok: true }, 201);
});

authRoute.post('/verify-email', validateJson(tokenSchema), async (c) => {
  const ok = await verifyEmail(getDb(), c.req.valid('json').token);
  return ok ? c.json({ ok: true }) : c.json({ ok: false }, 400);
});

authRoute.post('/request-reset', validateJson(requestResetSchema), async (c) => {
  const { email } = c.req.valid('json');
  const result = await requestPasswordReset(getDb(), email);
  if (result) {
    await sendEmail(buildResetEmail({ to: email, resetUrl: appUrl(`/app?reset=${result.token}`) }));
  }
  // Always 200 — do not reveal whether the email exists.
  return c.json({ ok: true });
});

authRoute.post('/reset-password', validateJson(resetPasswordSchema), async (c) => {
  const { token, password } = c.req.valid('json');
  const ok = await resetPassword(getDb(), token, password);
  return ok ? c.json({ ok: true }) : c.json({ ok: false }, 400);
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
  return c.json({
    email: user?.email,
    name: user?.name ?? null,
    emailVerified: user?.emailVerified ?? false,
  });
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

// ─── Envelopes (the account's own documents, by cookie session) ───
api.get('/envelopes', async (c) => {
  const limitParam = Number(c.req.query('limit'));
  const options: ListOptions = {
    limit: Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50,
  };
  const status = c.req.query('status');
  if (status) {
    options.status = status as NonNullable<ListOptions['status']>;
  }
  const cursor = c.req.query('cursor');
  if (cursor) {
    options.cursor = cursor;
  }
  const result = await listEnvelopes(c.get('db'), c.get('userId'), options);
  return c.json({
    data: result.data,
    pagination: { nextCursor: result.nextCursor, hasMore: result.hasMore },
  });
});

// Owner-scoped download of the signed final PDF (or the source if not yet sealed).
api.get('/envelopes/:id/document', async (c) => {
  const bytes = await downloadDocument(
    c.get('db'),
    getStorage(),
    c.get('userId'),
    c.req.param('id'),
  );
  return new Response(bytes, { headers: { 'Content-Type': 'application/pdf' } });
});

// Owner-scoped download of the Certificate of Completion (404 until completed).
api.get('/envelopes/:id/certificate', async (c) => {
  const bytes = await downloadCertificate(
    c.get('db'),
    getStorage(),
    c.get('userId'),
    c.req.param('id'),
  );
  return new Response(bytes, { headers: { 'Content-Type': 'application/pdf' } });
});

// Owner-scoped audit trail (every recorded event for the envelope).
api.get('/envelopes/:id/events', async (c) => {
  const data = await listEnvelopeEvents(c.get('db'), c.get('userId'), c.req.param('id'));
  return c.json({ data });
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
