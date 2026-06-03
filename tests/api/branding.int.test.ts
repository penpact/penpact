import { randomUUID } from 'node:crypto';
import { app } from '@penpact/api';
import { createDatabase, type Database, signers } from '@penpact/db';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { PDFDocument } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';

async function makePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  return pdf.save();
}

const url = process.env.DATABASE_URL;
const J = { 'content-type': 'application/json' };

describe.skipIf(!url)('account branding (integration)', () => {
  let db: Database;
  let cookie = '';
  let key = '';

  beforeAll(async () => {
    db = createDatabase(url as string);
    await migrate(db, { migrationsFolder: 'packages/db/drizzle' });
    const su = await app.request('/dashboard/auth/signup', {
      method: 'POST',
      headers: J,
      body: JSON.stringify({
        email: `brand-${randomUUID()}@penpact.test`,
        password: 'a-strong-passphrase-1',
      }),
    });
    cookie = `penpact_session=${(su.headers.get('set-cookie') ?? '').match(/penpact_session=([^;]+)/)?.[1]}`;
    const mk = await app.request('/dashboard/api-keys', {
      method: 'POST',
      headers: { ...J, cookie },
      body: JSON.stringify({ name: 'k' }),
    });
    key = (await mk.json()).key;
  }, 60_000);

  it('rejects an invalid brand color', async () => {
    const res = await app.request('/dashboard/branding', {
      method: 'PUT',
      headers: { ...J, cookie },
      body: JSON.stringify({ brandColor: 'red' }),
    });
    expect(res.status).toBe(422);
  });

  it('saves branding and surfaces it on the signing session', async () => {
    const put = await app.request('/dashboard/branding', {
      method: 'PUT',
      headers: { ...J, cookie },
      body: JSON.stringify({ brandName: 'Acme Corp', brandColor: '#10b981' }),
    });
    expect(put.status).toBe(200);
    expect((await put.json()).brandName).toBe('Acme Corp');

    // It comes back on GET.
    const got = await app.request('/dashboard/branding', { headers: { cookie } });
    expect((await got.json()).brandColor).toBe('#10b981');

    // Create + send an envelope, then the signer's session carries the branding.
    const ce = await app.request('/v1/envelopes', {
      method: 'POST',
      headers: { ...J, authorization: `Bearer ${key}` },
      body: JSON.stringify({
        documentName: 'Branded',
        signers: [{ name: 'S', email: `s-${randomUUID()}@x.test` }],
      }),
    });
    const env = await ce.json();
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
    const rows = await db
      .select({ token: signers.signingToken })
      .from(signers)
      .where(eq(signers.id, sid));
    const session = await (
      await app.request(`/v1/sign/${rows[0].token}`, { headers: { accept: 'application/json' } })
    ).json();
    expect(session.branding.name).toBe('Acme Corp');
    expect(session.branding.color).toBe('#10b981');
  });
});
