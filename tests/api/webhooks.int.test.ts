import { randomUUID } from 'node:crypto';
import {
  buildCompletedEvent,
  claimDueDeliveries,
  createEndpoint,
  deleteEndpoint,
  drainDueDeliveries,
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

  it('retries a failed delivery with backoff, then succeeds', async () => {
    // drainDueDeliveries is global (one worker drains all due rows), so clear
    // any backlog from earlier tests to make the attempt counts deterministic.
    await db.delete(webhookDeliveries);
    const owner = (
      await db
        .insert(users)
        .values({ email: `wh-${randomUUID()}@penpact.test` })
        .returning({ id: users.id })
    )[0]?.id as string;
    const endpoint = await createEndpoint(db, owner, 'https://drain.test/hook');
    await enqueueEnvelopeEvent(db, owner, buildCompletedEvent(randomUUID(), 'hash'));

    const deliveryId = (
      await db
        .select({ id: webhookDeliveries.id })
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.endpointId, endpoint.id))
    )[0]?.id as string;

    // A freshly enqueued delivery is due at insert time (DB now()), so drive
    // the injected clock from real time to keep the first attempt due.
    const t0 = new Date(Date.now() + 1_000);
    let calls = 0;
    const failThenOk = async () => {
      calls += 1;
      return calls === 1 ? { ok: false, status: 500 } : { ok: true, status: 200 };
    };

    // First drain: the send fails, so the delivery is rescheduled, not failed.
    const first = await drainDueDeliveries(db, { fetch: failThenOk, now: t0 });
    expect(first.attempted).toBe(1);
    const afterFail = (
      await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, deliveryId))
    )[0];
    expect(afterFail?.status).toBe('pending');
    expect(afterFail?.attempts).toBe(1);
    expect(afterFail?.nextAttemptAt.getTime()).toBeGreaterThan(t0.getTime());

    // Not due yet at t0: a drain at t0 should skip it.
    const skipped = await drainDueDeliveries(db, { fetch: failThenOk, now: t0 });
    expect(skipped.attempted).toBe(0);

    // Once due, the second attempt succeeds.
    const t1 = new Date(t0.getTime() + 120_000);
    const second = await drainDueDeliveries(db, { fetch: failThenOk, now: t1 });
    expect(second.attempted).toBe(1);
    const afterOk = (
      await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, deliveryId))
    )[0];
    expect(afterOk?.status).toBe('succeeded');
    expect(afterOk?.attempts).toBe(2);
    expect(afterOk?.responseStatus).toBe(200);
  });

  it('claimDueDeliveries leases rows so a second worker gets none (multi-instance safe)', async () => {
    await db.delete(webhookDeliveries);
    const owner = (
      await db
        .insert(users)
        .values({ email: `wh-${randomUUID()}@penpact.test` })
        .returning({ id: users.id })
    )[0]?.id as string;
    await createEndpoint(db, owner, 'https://claim.test/hook');
    await enqueueEnvelopeEvent(db, owner, buildCompletedEvent(randomUUID(), 'hash'));

    // Margin absorbs any clock skew between the test host and the database.
    const now = new Date(Date.now() + 5_000);
    const first = await claimDueDeliveries(db, now, 50, 60_000);
    expect(first.length).toBe(1);
    // A concurrent worker claiming at the same instant must get nothing: the
    // first claim leased the row by pushing next_attempt_at into the future.
    const second = await claimDueDeliveries(db, now, 50, 60_000);
    expect(second.length).toBe(0);
  });
});
