import { ENVELOPE_STATUSES } from '@penpact/core';
import { type Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { getDb } from '../db.js';
import { HttpProblem } from '../lib/problem.js';
import { clientIp, userAgent } from '../lib/request.js';
import { validateJson, validateQuery } from '../lib/validate.js';
import { apiKeyAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';
import {
  completeSchema,
  consentSchema,
  declineSchema,
  envelopeCreateSchema,
  placeFieldsSchema,
  voidSchema,
} from '../schemas.js';
import { autoDetectEnvelopeFields } from '../services/ai-fields.js';
import { downloadCertificate } from '../services/certificate.js';
import { downloadDocument, uploadDocument } from '../services/documents.js';
import {
  createEnvelope,
  getEnvelope,
  type ListOptions,
  listEnvelopes,
  type RequestContext,
  resendInvite,
  sendEnvelope,
  voidEnvelope,
} from '../services/envelopes.js';
import { placeFields } from '../services/fields.js';
import {
  acceptConsent,
  completeSigning,
  declineSigning,
  getSignerDocument,
  getSigningSession,
} from '../services/signing.js';
import { getStorage } from '../storage/index.js';
import type { AppEnv } from '../types.js';

const reqCtx = (c: Context): RequestContext => ({ ip: clientIp(c), ua: userAgent(c) });

const listQuerySchema = z.object({
  status: z.enum(ENVELOPE_STATUSES).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Integrator routes (API-key auth) ───
const envelopesRoute = new Hono<AppEnv>();
envelopesRoute.use('*', apiKeyAuth);

envelopesRoute.post('/', validateJson(envelopeCreateSchema), async (c) => {
  const envelope = await createEnvelope(c.get('db'), c.get('userId'), c.req.valid('json'));
  return c.json(envelope, 201);
});

envelopesRoute.get('/', validateQuery(listQuerySchema), async (c) => {
  const query = c.req.valid('query');
  const options: ListOptions = { limit: query.limit };
  if (query.status) {
    options.status = query.status;
  }
  if (query.cursor) {
    options.cursor = query.cursor;
  }
  const result = await listEnvelopes(c.get('db'), c.get('userId'), options);
  return c.json({
    data: result.data,
    pagination: { nextCursor: result.nextCursor, hasMore: result.hasMore },
  });
});

envelopesRoute.get('/:id', async (c) => {
  const envelope = await getEnvelope(c.get('db'), c.get('userId'), c.req.param('id'));
  if (!envelope) {
    throw new HttpProblem({ status: 404, title: 'Not Found', detail: 'Envelope not found.' });
  }
  return c.json(envelope);
});

envelopesRoute.put('/:id/document', async (c) => {
  const body = new Uint8Array(await c.req.arrayBuffer());
  const document = await uploadDocument(
    c.get('db'),
    getStorage(),
    c.get('userId'),
    c.req.param('id'),
    body,
  );
  return c.json(document);
});

envelopesRoute.get('/:id/document', async (c) => {
  const bytes = await downloadDocument(
    c.get('db'),
    getStorage(),
    c.get('userId'),
    c.req.param('id'),
  );
  return new Response(bytes, { headers: { 'Content-Type': 'application/pdf' } });
});

envelopesRoute.post('/:id/fields', validateJson(placeFieldsSchema), async (c) => {
  const created = await placeFields(
    c.get('db'),
    c.get('userId'),
    c.req.param('id'),
    c.req.valid('json'),
  );
  return c.json({ data: created }, 201);
});

envelopesRoute.post('/:id/fields/auto-detect', async (c) => {
  const proposals = await autoDetectEnvelopeFields(
    c.get('db'),
    getStorage(),
    c.get('userId'),
    c.req.param('id'),
  );
  return c.json({ data: proposals });
});

envelopesRoute.post('/:id/send', async (c) => {
  const envelope = await sendEnvelope(c.get('db'), c.get('userId'), c.req.param('id'), reqCtx(c));
  return c.json(envelope);
});

envelopesRoute.post('/:id/void', validateJson(voidSchema), async (c) => {
  const envelope = await voidEnvelope(
    c.get('db'),
    c.get('userId'),
    c.req.param('id'),
    c.req.valid('json').reason,
    reqCtx(c),
  );
  return c.json(envelope);
});

envelopesRoute.post('/:id/signers/:signerId/resend', async (c) => {
  await resendInvite(
    c.get('db'),
    c.get('userId'),
    c.req.param('id'),
    c.req.param('signerId'),
    reqCtx(c),
  );
  return c.body(null, 204);
});

envelopesRoute.get('/:id/certificate', async (c) => {
  const bytes = await downloadCertificate(
    c.get('db'),
    getStorage(),
    c.get('userId'),
    c.req.param('id'),
  );
  return new Response(bytes, { headers: { 'Content-Type': 'application/pdf' } });
});

// ─── Signer routes (authorized by the signingToken in the path, not an API key) ───
const signRoute = new Hono<AppEnv>();
// The embeddable <Sign/> component calls these from the host app's origin, so
// allow CORS. Auth is the unguessable path token (no cookies), so origin '*'
// is safe; the key-authed /v1 envelope endpoints deliberately get no CORS.
signRoute.use(
  '*',
  cors({ origin: '*', allowMethods: ['GET', 'POST', 'OPTIONS'], allowHeaders: ['content-type'] }),
);
signRoute.use('*', rateLimit({ windowMs: 60_000, max: 120 }));
signRoute.use('*', async (c, next) => {
  c.set('db', getDb());
  await next();
});

signRoute.get('/:token', async (c) => {
  return c.json(await getSigningSession(c.get('db'), c.req.param('token'), reqCtx(c)));
});

signRoute.get('/:token/document', async (c) => {
  const bytes = await getSignerDocument(c.get('db'), getStorage(), c.req.param('token'));
  return new Response(bytes, { headers: { 'Content-Type': 'application/pdf' } });
});

signRoute.post('/:token/consent', validateJson(consentSchema), async (c) => {
  await acceptConsent(
    c.get('db'),
    c.req.param('token'),
    c.req.valid('json').disclosureHash,
    reqCtx(c),
  );
  return c.body(null, 204);
});

signRoute.post('/:token/complete', validateJson(completeSchema), async (c) => {
  return c.json(
    await completeSigning(
      c.get('db'),
      getStorage(),
      c.req.param('token'),
      c.req.valid('json'),
      reqCtx(c),
    ),
  );
});

signRoute.post('/:token/decline', validateJson(declineSchema), async (c) => {
  return c.json(
    await declineSigning(c.get('db'), c.req.param('token'), c.req.valid('json'), reqCtx(c)),
  );
});

export const v1 = new Hono<AppEnv>();
v1.get('/', (c) => c.json({ version: 'v1', status: 'preview' }));
v1.route('/envelopes', envelopesRoute);
v1.route('/sign', signRoute);

export type V1 = typeof v1;
