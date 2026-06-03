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

describe.skipIf(!url)('public template signing links (integration)', () => {
  let key = '';

  beforeAll(async () => {
    const db: Database = createDatabase(url as string);
    await migrate(db, { migrationsFolder: 'packages/db/drizzle' });
    const su = await app.request('/dashboard/auth/signup', {
      method: 'POST',
      headers: J,
      body: JSON.stringify({
        email: `pub-${randomUUID()}@penpact.test`,
        password: 'a-strong-passphrase-1',
      }),
    });
    const cookie = `penpact_session=${(su.headers.get('set-cookie') ?? '').match(/penpact_session=([^;]+)/)?.[1]}`;
    const mk = await app.request('/dashboard/api-keys', {
      method: 'POST',
      headers: { ...J, cookie },
      body: JSON.stringify({ name: 'k' }),
    });
    key = (await mk.json()).key;
  }, 60_000);

  async function singleRoleTemplate(): Promise<string> {
    const create = await app.request('/v1/templates', {
      method: 'POST',
      headers: { ...J, authorization: `Bearer ${key}` },
      body: JSON.stringify({
        name: 'Waiver',
        documentName: 'Waiver.pdf',
        roles: [{ name: 'Signer' }],
      }),
    });
    const tpl = await create.json();
    await app.request(`/v1/templates/${tpl.id}/document`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/pdf' },
      body: await makePdf(),
    });
    await app.request(`/v1/templates/${tpl.id}/fields`, {
      method: 'POST',
      headers: { ...J, authorization: `Bearer ${key}` },
      body: JSON.stringify({
        fields: [
          {
            type: 'signature',
            roleId: tpl.roles[0].id,
            page: 1,
            x: 60,
            y: 120,
            width: 200,
            height: 60,
          },
        ],
      }),
    });
    return tpl.id as string;
  }

  it('publishes a single-role template and self-serves a fresh envelope', async () => {
    const id = await singleRoleTemplate();
    const pub = await app.request(`/v1/templates/${id}/publish`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
    });
    expect(pub.status).toBe(200);
    const { slug } = await pub.json();
    expect(slug).toBeTruthy();

    // Public metadata is readable without auth.
    const meta = await app.request(`/v1/public/templates/${slug}`);
    expect(meta.status).toBe(200);
    expect((await meta.json()).name).toBe('Waiver');

    // A self-identified signer starts a session — no API key.
    const start = await app.request(`/v1/public/templates/${slug}/start`, {
      method: 'POST',
      headers: J,
      body: JSON.stringify({ name: 'Public Signer', email: `ps-${randomUUID()}@x.test` }),
    });
    expect(start.status).toBe(200);
    const { signUrl, token } = await start.json();
    expect(signUrl).toContain(`/sign/${token}`);

    // The returned token resolves to a real, sent signing session with the doc.
    const session = await (
      await app.request(`/v1/sign/${token}`, { headers: { accept: 'application/json' } })
    ).json();
    expect(session.signer.name).toBe('Public Signer');
    expect(session.documents).toHaveLength(1);

    // Two starts create two independent envelopes (evergreen).
    const start2 = await app.request(`/v1/public/templates/${slug}/start`, {
      method: 'POST',
      headers: J,
      body: JSON.stringify({ name: 'Second', email: `s2-${randomUUID()}@x.test` }),
    });
    expect((await start2.json()).token).not.toBe(token);
  });

  it('refuses to publish a multi-role template', async () => {
    const create = await app.request('/v1/templates', {
      method: 'POST',
      headers: { ...J, authorization: `Bearer ${key}` },
      body: JSON.stringify({
        name: 'Two',
        documentName: 'Two.pdf',
        roles: [{ name: 'A' }, { name: 'B' }],
      }),
    });
    const tpl = await create.json();
    await app.request(`/v1/templates/${tpl.id}/document`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/pdf' },
      body: await makePdf(),
    });
    const pub = await app.request(`/v1/templates/${tpl.id}/publish`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
    });
    expect(pub.status).toBe(409);
  });

  it('404s an unknown public slug', async () => {
    expect((await app.request('/v1/public/templates/nope-nope')).status).toBe(404);
  });
});
