import { ENVELOPE_STATUSES } from '@penpact/core';
import { type Context, Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { getDb } from '../db.js';
import { parseRecipientsCsv } from '../lib/csv.js';
import { HttpProblem } from '../lib/problem.js';
import { clientIp, userAgent } from '../lib/request.js';
import { validateJson, validateQuery } from '../lib/validate.js';
import { apiKeyAuth } from '../middleware/auth.js';
import { idempotency } from '../middleware/idempotency.js';
import { rateLimit } from '../middleware/rate-limit.js';
import {
  attachmentSchema,
  authenticateSchema,
  bulkSendSchema,
  completeSchema,
  consentSchema,
  declineSchema,
  envelopeCreateSchema,
  generateDocumentSchema,
  instantiateTemplateSchema,
  placeFieldsSchema,
  placeTemplateFieldsSchema,
  publicStartSchema,
  reassignSchema,
  templateCreateSchema,
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
import { generateEnvelopeFromText } from '../services/generate.js';
import {
  acceptConsent,
  authenticateSigner,
  completeSigning,
  declineSigning,
  getSignerDocument,
  getSigningSession,
  previewSigning,
  reassignSigner,
  uploadAttachment,
} from '../services/signing.js';
import {
  bulkSendTemplate,
  createTemplate,
  deleteTemplate,
  getPublicTemplate,
  getTemplate,
  instantiateTemplate,
  listTemplates,
  placeTemplateFields,
  publishTemplate,
  startPublicSigning,
  unpublishTemplate,
  uploadTemplateDocument,
} from '../services/templates.js';
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
envelopesRoute.use('*', idempotency);

envelopesRoute.post('/', validateJson(envelopeCreateSchema), async (c) => {
  const envelope = await createEnvelope(
    c.get('db'),
    c.get('userId'),
    c.req.valid('json'),
    c.get('mode'),
    c.get('organizationId'),
  );
  return c.json(envelope, 201);
});

// Generate an envelope from a text/markdown template with {{variable}} merge.
envelopesRoute.post('/generate', validateJson(generateDocumentSchema), async (c) => {
  const envelope = await generateEnvelopeFromText(
    c.get('db'),
    getStorage(),
    c.get('userId'),
    c.get('mode'),
    c.req.valid('json'),
    c.get('organizationId'),
  );
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
  const bytes = await getSignerDocument(
    c.get('db'),
    getStorage(),
    c.req.param('token'),
    c.req.query('documentId'),
  );
  return new Response(bytes, { headers: { 'Content-Type': 'application/pdf' } });
});

signRoute.post('/:token/authenticate', validateJson(authenticateSchema), async (c) => {
  await authenticateSigner(c.get('db'), c.req.param('token'), c.req.valid('json').code, reqCtx(c));
  return c.body(null, 204);
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

// Server-rendered preview: flatten the signer's proposed values into the PDF
// (same renderer as the final seal, no PAdES) so they can review before finishing.
signRoute.post('/:token/preview', validateJson(completeSchema), async (c) => {
  const bytes = await previewSigning(
    c.get('db'),
    getStorage(),
    c.req.param('token'),
    c.req.valid('json').fields,
  );
  return new Response(bytes, { headers: { 'Content-Type': 'application/pdf' } });
});

// Signer delegates their signing to a different person.
signRoute.post('/:token/reassign', validateJson(reassignSchema), async (c) => {
  return c.json(
    await reassignSigner(c.get('db'), c.req.param('token'), c.req.valid('json'), reqCtx(c)),
  );
});

// Signer uploads a file against one of their attachment fields.
signRoute.post('/:token/attachment', validateJson(attachmentSchema), async (c) => {
  return c.json(
    await uploadAttachment(
      c.get('db'),
      getStorage(),
      c.req.param('token'),
      c.req.valid('json'),
      reqCtx(c),
    ),
  );
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

// ─── Template routes (API-key auth) ───
const templatesRoute = new Hono<AppEnv>();
templatesRoute.use('*', apiKeyAuth);
templatesRoute.use('*', idempotency);

templatesRoute.post('/', validateJson(templateCreateSchema), async (c) => {
  return c.json(
    await createTemplate(
      c.get('db'),
      c.get('userId'),
      c.req.valid('json'),
      c.get('organizationId'),
    ),
    201,
  );
});

templatesRoute.get('/', async (c) => {
  return c.json({ data: await listTemplates(c.get('db'), c.get('userId')) });
});

templatesRoute.get('/:id', async (c) => {
  const tpl = await getTemplate(c.get('db'), c.get('userId'), c.req.param('id'));
  if (!tpl) {
    throw new HttpProblem({ status: 404, title: 'Not Found', detail: 'Template not found.' });
  }
  return c.json(tpl);
});

templatesRoute.delete('/:id', async (c) => {
  await deleteTemplate(c.get('db'), c.get('userId'), c.req.param('id'));
  return c.body(null, 204);
});

templatesRoute.put('/:id/document', async (c) => {
  const body = new Uint8Array(await c.req.arrayBuffer());
  return c.json(
    await uploadTemplateDocument(
      c.get('db'),
      getStorage(),
      c.get('userId'),
      c.req.param('id'),
      body,
    ),
  );
});

templatesRoute.post('/:id/fields', validateJson(placeTemplateFieldsSchema), async (c) => {
  const created = await placeTemplateFields(
    c.get('db'),
    c.get('userId'),
    c.req.param('id'),
    c.req.valid('json'),
  );
  return c.json({ data: created }, 201);
});

templatesRoute.post('/:id/envelopes', validateJson(instantiateTemplateSchema), async (c) => {
  const envelope = await instantiateTemplate(
    c.get('db'),
    getStorage(),
    c.get('userId'),
    c.req.param('id'),
    c.req.valid('json'),
  );
  return c.json(envelope, 201);
});

templatesRoute.post('/:id/publish', async (c) => {
  const { slug } = await publishTemplate(c.get('db'), c.get('userId'), c.req.param('id'));
  const base = process.env.PUBLIC_BASE_URL ?? '';
  return c.json({ slug, publicUrl: `${base}/s/${slug}` });
});

templatesRoute.delete('/:id/publish', async (c) => {
  await unpublishTemplate(c.get('db'), c.get('userId'), c.req.param('id'));
  return c.body(null, 204);
});

// Bulk send: JSON { recipients: [...] } or a raw text/csv body (name,email header).
templatesRoute.post('/:id/bulk-send', async (c) => {
  const contentType = c.req.header('content-type') ?? '';
  let recipients: Array<{ name: string; email: string }>;
  if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
    recipients = parseRecipientsCsv(await c.req.text());
  } else {
    recipients = bulkSendSchema.parse(await c.req.json()).recipients;
  }
  const result = await bulkSendTemplate(
    c.get('db'),
    getStorage(),
    c.get('userId'),
    c.req.param('id'),
    recipients,
    reqCtx(c),
  );
  return c.json(result, 202);
});

// ─── Public self-serve template signing (no API key; rate-limited) ───
const publicRoute = new Hono<AppEnv>();
publicRoute.use('*', rateLimit({ windowMs: 60_000, max: 20 }));
publicRoute.use('*', async (c, next) => {
  c.set('db', getDb());
  await next();
});

publicRoute.get('/templates/:slug', async (c) => {
  const meta = await getPublicTemplate(c.get('db'), c.req.param('slug'));
  if (!meta) {
    throw new HttpProblem({ status: 404, title: 'Not Found', detail: 'Signing link not found.' });
  }
  return c.json(meta);
});

publicRoute.post('/templates/:slug/start', validateJson(publicStartSchema), async (c) => {
  const { token } = await startPublicSigning(
    c.get('db'),
    getStorage(),
    c.req.param('slug'),
    c.req.valid('json'),
    reqCtx(c),
  );
  const base = process.env.PUBLIC_BASE_URL ?? '';
  return c.json({ signUrl: `${base}/sign/${token}`, token });
});

export const v1 = new Hono<AppEnv>();
v1.get('/', (c) => c.json({ version: 'v1', status: 'preview' }));
v1.route('/envelopes', envelopesRoute);
v1.route('/templates', templatesRoute);
v1.route('/public', publicRoute);
v1.route('/sign', signRoute);

export type V1 = typeof v1;
