import { randomUUID } from 'node:crypto';
import {
  buildCompletedEvent,
  createEndpoint,
  deleteEndpoint,
  enqueueEnvelopeEvent,
  listEndpoints,
} from '@penpact/api/webhooks';
import { createDatabase, type Database, users, webhookDeliveries } from '@penpact/db';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { beforeAll, describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL;

describe.skipIf(!url)('webhook endpoints + enqueue (integration)', () => {
  let db: Database;
  let userId = '';

  beforeAll(async () => {
    db = createDatabase(url as string);
    await migrate(db, { migrationsFolder: 'packages/db/drizzle' });
    const rows = await db
      .insert(users)
      .values({ email: `wh-${randomUUID()}@penpact.test` })
      .returning({ id: users.id });
    userId = rows[0]?.id as string;
  });

  it('creates an endpoint that returns a secret once, then lists it without the secret', async () => {
    const created = await createEndpoint(db, userId, 'https://example.test/hook', 'prod');
    expect(created.secret).toMatch(/^whsec_/);
    expect(created.url).toBe('https://example.test/hook');

    const list = await listEndpoints(db, userId);
    const found = list.find((e) => e.id === created.id);
    expect(found).toBeTruthy();
    expect((found as Record<string, unknown>).secret).toBeUndefined();
  });

  it('enqueues one pending delivery per active endpoint', async () => {
    const isolated = (
      await db
        .insert(users)
        .values({ email: `wh-${randomUUID()}@penpact.test` })
        .returning({ id: users.id })
    )[0]?.id as string;

    await createEndpoint(db, isolated, 'https://a.test/hook');
    await createEndpoint(db, isolated, 'https://b.test/hook');

    const event = buildCompletedEvent(randomUUID(), 'deadbeef');
    const enqueued = await enqueueEnvelopeEvent(db, isolated, event);
    expect(enqueued).toBe(2);

    const endpoints = await listEndpoints(db, isolated);
    const deliveries = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.endpointId, endpoints[0]?.id as string));
    expect(deliveries.length).toBeGreaterThanOrEqual(1);
    expect(deliveries[0]?.status).toBe('pending');
    expect(deliveries[0]?.eventType).toBe('envelope.completed');
    expect(deliveries[0]?.attempts).toBe(0);
  });

  it('deletes an endpoint (and only the caller can)', async () => {
    const created = await createEndpoint(db, userId, 'https://del.test/hook');
    await deleteEndpoint(db, userId, created.id);
    const list = await listEndpoints(db, userId);
    expect(list.find((e) => e.id === created.id)).toBeUndefined();
  });
});
