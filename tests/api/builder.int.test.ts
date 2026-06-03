import { randomUUID } from 'node:crypto';
import { app } from '@penpact/api';
import { createDatabase, type Database } from '@penpact/db';
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

describe.skipIf(!url)('field builder endpoints (integration)', () => {
  let cookie = '';
  let key = '';

  beforeAll(async () => {
    const db: Database = createDatabase(url as string);
    await migrate(db, { migrationsFolder: 'packages/db/drizzle' });
    const su = await app.request('/dashboard/auth/signup', {
      method: 'POST',
      headers: J,
      body: JSON.stringify({
        email: `bld-${randomUUID()}@penpact.test`,
        password: 'a-strong-passphrase-1',
      }),
    });
    cookie = `penpact_session=${(su.headers.get('set-cookie') ?? '').match(/penpact_session=([^;]+)/)?.[1]}`;
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

  it('serves the builder page', async () => {
    const res = await app.request('/builder?envelope=abc');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('field builder');
  });

  it('reads an envelope and places fields by cookie session', async () => {
    const env = await (
      await app.request('/v1/envelopes', {
        method: 'POST',
        headers: { ...J, authorization: `Bearer ${key}` },
        body: JSON.stringify({
          documentName: 'Builder',
          signers: [{ name: 'Ada', email: `ada-${randomUUID()}@x.test` }],
        }),
      })
    ).json();
    await app.request(`/v1/envelopes/${env.id}/document`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/pdf' },
      body: await makePdf(),
    });

    // The builder fetches the envelope (signers) by cookie.
    const got = await app.request(`/dashboard/envelopes/${env.id}`, { headers: { cookie } });
    expect(got.status).toBe(200);
    const fetched = await got.json();
    expect(fetched.signers).toHaveLength(1);
    const signerId = fetched.signers[0].id;

    // And places fields by cookie.
    const place = await app.request(`/dashboard/envelopes/${env.id}/fields`, {
      method: 'POST',
      headers: { ...J, cookie },
      body: JSON.stringify({
        fields: [{ type: 'signature', signerId, page: 1, x: 80, y: 150, width: 180, height: 48 }],
      }),
    });
    expect(place.status).toBe(201);
    expect((await place.json()).data).toHaveLength(1);

    // Ownership: a second account cannot read this envelope.
    const su2 = await app.request('/dashboard/auth/signup', {
      method: 'POST',
      headers: J,
      body: JSON.stringify({
        email: `bld2-${randomUUID()}@penpact.test`,
        password: 'a-strong-passphrase-1',
      }),
    });
    const cookie2 = `penpact_session=${(su2.headers.get('set-cookie') ?? '').match(/penpact_session=([^;]+)/)?.[1]}`;
    const denied = await app.request(`/dashboard/envelopes/${env.id}`, {
      headers: { cookie: cookie2 },
    });
    expect(denied.status).toBe(404);
  });
});
