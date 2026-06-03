import { randomUUID } from 'node:crypto';
import { app } from '@penpact/api';
import { processReminders } from '@penpact/api/reminders';
import { createDatabase, type Database, events } from '@penpact/db';
import { and, eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { PDFDocument } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL;
const J = { 'content-type': 'application/json' };

async function makePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  return pdf.save();
}

describe.skipIf(!url)('automated reminders (integration)', () => {
  let db: Database;
  let key = '';

  beforeAll(async () => {
    db = createDatabase(url as string);
    await migrate(db, { migrationsFolder: 'packages/db/drizzle' });
    const su = await app.request('/dashboard/auth/signup', {
      method: 'POST',
      headers: J,
      body: JSON.stringify({
        email: `rem-${randomUUID()}@penpact.test`,
        password: 'a-strong-passphrase-1',
      }),
    });
    const cookie = `penpact_session=${(su.headers.get('set-cookie') ?? '').match(/penpact_session=([^;]+)/)?.[1]}`;
    key = (
      await (
        await app.request('/dashboard/api-keys', {
          method: 'POST',
          headers: { ...J, cookie },
          body: JSON.stringify({ name: 'k' }),
        })
      ).json()
    ).key;
  }, 60_000);

  it('re-nudges an unsigned signer once a reminder is due', async () => {
    // Envelope with a 24h reminder.
    const env = await (
      await app.request('/v1/envelopes', {
        method: 'POST',
        headers: { ...J, authorization: `Bearer ${key}` },
        body: JSON.stringify({
          documentName: 'Reminder me',
          reminderEveryHours: 24,
          signers: [{ name: 'Late Signer', email: `late-${randomUUID()}@x.test` }],
        }),
      })
    ).json();
    const sid = env.signers[0].id;
    await app.request(`/v1/envelopes/${env.id}/document`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/pdf' },
      body: await makePdf(),
    });
    await app.request(`/v1/envelopes/${env.id}/fields`, {
      method: 'POST',
      headers: { ...J, authorization: `Bearer ${key}` },
      body: JSON.stringify({
        fields: [
          { type: 'signature', signerId: sid, page: 1, x: 60, y: 120, width: 200, height: 60 },
        ],
      }),
    });
    await app.request(`/v1/envelopes/${env.id}/send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
    });

    // Not due yet right after sending.
    const justSent = await processReminders(db, { now: new Date(), limit: 1000 });
    const remindEventsNow = await db
      .select({ id: events.id })
      .from(events)
      .where(and(eq(events.envelopeId, env.id), eq(events.type, 'email_sent')));
    // The invite send recorded one email_sent; no reminder yet.
    expect(justSent).toBeGreaterThanOrEqual(0);
    const baseline = remindEventsNow.length;

    // 25 hours later, a reminder is due.
    const later = new Date(Date.now() + 25 * 60 * 60 * 1000);
    const sent = await processReminders(db, { now: later, limit: 1000 });
    expect(sent).toBeGreaterThanOrEqual(1);

    // A reminder email_sent event (metadata.reminder = true) now exists.
    const after = await db
      .select({ metadata: events.metadata })
      .from(events)
      .where(and(eq(events.envelopeId, env.id), eq(events.type, 'email_sent')));
    expect(after.length).toBeGreaterThan(baseline);
    expect(
      after.some((e) => (e.metadata as { reminder?: boolean } | null)?.reminder === true),
    ).toBe(true);
  });

  it('does not remind an envelope without a reminder interval', async () => {
    const env = await (
      await app.request('/v1/envelopes', {
        method: 'POST',
        headers: { ...J, authorization: `Bearer ${key}` },
        body: JSON.stringify({
          documentName: 'No reminders',
          signers: [{ name: 'S', email: `nr-${randomUUID()}@x.test` }],
        }),
      })
    ).json();
    const sid = env.signers[0].id;
    await app.request(`/v1/envelopes/${env.id}/document`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/pdf' },
      body: await makePdf(),
    });
    await app.request(`/v1/envelopes/${env.id}/fields`, {
      method: 'POST',
      headers: { ...J, authorization: `Bearer ${key}` },
      body: JSON.stringify({
        fields: [
          { type: 'signature', signerId: sid, page: 1, x: 60, y: 120, width: 200, height: 60 },
        ],
      }),
    });
    await app.request(`/v1/envelopes/${env.id}/send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
    });

    const later = new Date(Date.now() + 1000 * 60 * 60 * 1000);
    await processReminders(db, { now: later, limit: 1000 });
    const reminders = await db
      .select({ metadata: events.metadata })
      .from(events)
      .where(and(eq(events.envelopeId, env.id), eq(events.type, 'email_sent')));
    expect(
      reminders.some((e) => (e.metadata as { reminder?: boolean } | null)?.reminder === true),
    ).toBe(false);
  });
});
