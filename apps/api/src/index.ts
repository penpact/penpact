import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { v1 } from './routes/v1.js';

const app = new Hono();

app.use('*', logger());

app.get('/', (c) =>
  c.json({
    name: 'Penpact',
    description: 'Open-source, embeddable e-signature API.',
    docs: 'https://penpact.dev/docs',
  }),
);

app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/v1', v1);

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
  // Startup line only; request logging is handled by hono/logger.
  console.log(`Penpact API listening on http://localhost:${info.port}`);
});

export { app };
