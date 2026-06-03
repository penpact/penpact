import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { problemErrorHandler } from './lib/problem.js';
import { dashboard } from './routes/dashboard.js';
import { v1 } from './routes/v1.js';
import { startWebhookWorker } from './services/webhook-worker.js';
import type { AppEnv } from './types.js';
import { dashboardPageHtml } from './web/dashboard-page.js';
import { signPageHtml } from './web/sign-page.js';

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

// Human-facing hosted signing page. The token in the path is the signer's
// credential; the page calls the /v1/sign/:token API from the browser.
app.get('/sign/:token', (c) => c.html(signPageHtml(c.req.param('token'))));

app.route('/v1', v1);

// Self-serve dashboard API (cookie session): signup/login + API-key management.
app.route('/dashboard', dashboard);

// Dashboard UI (same origin as the /dashboard API so the session cookie flows).
app.get('/app', (c) => c.html(dashboardPageHtml()));

// Only start the HTTP listener when run directly (not when imported by tests).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 3000);
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Penpact API listening on http://localhost:${info.port}`);
  });
  // Drain the durable webhook queue on an interval.
  startWebhookWorker();
}
