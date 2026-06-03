import { ENVELOPE_STATUSES } from '@penpact/core';
import { Hono } from 'hono';
import { z } from 'zod';
import { HttpProblem } from '../lib/problem.js';
import { validateJson, validateQuery } from '../lib/validate.js';
import { apiKeyAuth } from '../middleware/auth.js';
import { envelopeCreateSchema, placeFieldsSchema } from '../schemas.js';
import { requireEnvelope } from '../services/access.js';
import { downloadDocument, uploadDocument } from '../services/documents.js';
import {
  createEnvelope,
  getEnvelope,
  type ListOptions,
  listEnvelopes,
} from '../services/envelopes.js';
import { placeFields } from '../services/fields.js';
import { getStorage } from '../storage/index.js';
import type { AppEnv } from '../types.js';

const listQuerySchema = z.object({
  status: z.enum(ENVELOPE_STATUSES).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const envelopesRoute = new Hono<AppEnv>();
envelopesRoute.use('*', apiKeyAuth);

envelopesRoute.post('/', validateJson(envelopeCreateSchema), async (c) => {
  const input = c.req.valid('json');
  const envelope = await createEnvelope(c.get('db'), c.get('userId'), input);
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
  const input = c.req.valid('json');
  const created = await placeFields(c.get('db'), c.get('userId'), c.req.param('id'), input);
  return c.json({ data: created }, 201);
});

envelopesRoute.post('/:id/fields/auto-detect', async (c) => {
  // Confirm ownership first, then signal the feature is not yet available.
  await requireEnvelope(c.get('db'), c.get('userId'), c.req.param('id'));
  throw new HttpProblem({
    status: 501,
    title: 'Not Implemented',
    detail: 'AI field auto-detection ships in a later release (Phase 4).',
  });
});

export const v1 = new Hono<AppEnv>();
v1.get('/', (c) => c.json({ version: 'v1', status: 'preview' }));
v1.route('/envelopes', envelopesRoute);

export type V1 = typeof v1;
