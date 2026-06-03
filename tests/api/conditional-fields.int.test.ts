import { randomUUID } from 'node:crypto';
import { app } from '@penpact/api';
import { createDatabase, type Database, signers } from '@penpact/db';
import { eq } from 'drizzle-orm';
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

describe.skipIf(!url)('conditional fields (integration)', () => {
  let db: Database;
  let key = '';

  beforeAll(async () => {
    db = createDatabase(url as string);
    await migrate(db, { migrationsFolder: 'packages/db/drizzle' });
    const su = await app.request('/dashboard/auth/signup', {
      method: 'POST',
      headers: J,
      body: JSON.stringify({
        email: `cond-${randomUUID()}@penpact.test`,
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

  /** Build an envelope with a checkbox + a required text that is conditional on it. */
  async function buildEnvelope() {
    const env = await (
      await app.request('/v1/envelopes', {
        method: 'POST',
        headers: { ...J, authorization: `Bearer ${key}` },
        body: JSON.stringify({
          documentName: 'Conditional',
          signers: [{ name: 'Ada', email: `ada-${randomUUID()}@x.test` }],
        }),
      })
    ).json();
    const sid = env.signers[0].id;
    await app.request(`/v1/envelopes/${env.id}/document`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/pdf' },
      body: await makePdf(),
    });
    // Place the controlling checkbox first to learn its id.
    const ctrlRes = await app.request(`/v1/envelopes/${env.id}/fields`, {
      method: 'POST',
      headers: { ...J, authorization: `Bearer ${key}` },
      body: JSON.stringify({
        fields: [
          {
            type: 'checkbox',
            signerId: sid,
            page: 1,
            x: 60,
            y: 100,
            width: 24,
            height: 24,
            required: false,
          },
        ],
      }),
    });
    const ctrlId = (await ctrlRes.json()).data[0].id;
    // A required text that only applies when the checkbox is "Yes".
    await app.request(`/v1/envelopes/${env.id}/fields`, {
      method: 'POST',
      headers: { ...J, authorization: `Bearer ${key}` },
      body: JSON.stringify({
        fields: [
          {
            type: 'text',
            signerId: sid,
            page: 1,
            x: 60,
            y: 140,
            width: 200,
            height: 24,
            required: true,
            condition: { fieldId: ctrlId, equals: 'Yes' },
          },
        ],
      }),
    });
    await app.request(`/v1/envelopes/${env.id}/send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
    });
    const token = (
      await db.select({ token: signers.signingToken }).from(signers).where(eq(signers.id, sid))
    )[0].token;
    const session = await (
      await app.request(`/v1/sign/${token}`, { headers: { accept: 'application/json' } })
    ).json();
    await app.request(`/v1/sign/${token}/consent`, {
      method: 'POST',
      headers: J,
      body: JSON.stringify({ disclosureHash: session.consentDisclosure.hash, agree: true }),
    });
    return { token, session };
  }

  it('does not require the conditional field when the condition is unmet', async () => {
    const { token, session } = await buildEnvelope();
    // Submit nothing — the conditional required text should not block completion.
    const res = await app.request(`/v1/sign/${token}/complete`, {
      method: 'POST',
      headers: J,
      body: JSON.stringify({ signatureType: 'typed', fields: [] }),
    });
    expect(res.status).toBe(200);
    void session;
  });

  it('requires the conditional field once the condition is met', async () => {
    const { token, session } = await buildEnvelope();
    const ctrl = session.fields.find((f: { type: string }) => f.type === 'checkbox');
    // Check the box (condition met) but omit the required text -> 422.
    const res = await app.request(`/v1/sign/${token}/complete`, {
      method: 'POST',
      headers: J,
      body: JSON.stringify({
        signatureType: 'typed',
        fields: [{ fieldId: ctrl.id, value: 'Yes' }],
      }),
    });
    expect(res.status).toBe(422);
  });
});
