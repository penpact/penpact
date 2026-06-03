import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { problemErrorHandler } from './lib/problem.js';
import { v1 } from './routes/v1.js';
import type { AppEnv } from './types.js';

export const app = new Hono<AppEnv>();

app.use('*', logger());
app.onError(problemErrorHandler);

app.get('/', (c) =>
  c.json({
    name: 'Penpact',
    description: 'Open-source, embeddable e-signature API.',
    docs: 'https://penpact.dev/docs',
  }),
);

app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/v1', v1);

// Only start the HTTP listener when run directly (not when imported by tests).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3000);
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Penpact API listening on http://localhost:${info.port}`);
  });
}
