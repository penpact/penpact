import { Hono } from 'hono';

/**
 * Penpact v1 REST surface. Routes are stubs for now — the signing engine
 * (create envelope → place fields → send → sign → seal → certificate) lands in
 * Phase 1 proper. Kept in its own router so the public API contract is reviewable
 * in one place.
 */
export const v1 = new Hono();

v1.get('/', (c) => c.json({ version: 'v1', status: 'preview' }));

// Envelopes (create / read / send / download) — to be implemented.
v1.get('/envelopes', (c) => c.json({ envelopes: [] }));

export type V1 = typeof v1;
