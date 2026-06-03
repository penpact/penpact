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

describe.skipIf(!url)('bulk send (integration)', () => {
  let key = '';
  let templateId = '';

  beforeAll(async () => {
    const db: Database = createDatabase(url as string);
    await migrate(db, { migrationsFolder: 'packages/db/drizzle' });
    const su = await app.request('/dashboard/auth/signup', {
      method: 'POST',
      headers: J,
      body: JSON.stringify({
        email: `bulk-${randomUUID()}@penpact.test`,
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

    const tpl = await (
      await app.request('/v1/templates', {
        method: 'POST',
        headers: { ...J, authorization: `Bearer ${key}` },
        body: JSON.stringify({ name: 'NDA', documentName: 'NDA.pdf', roles: [{ name: 'Signer' }] }),
      })
    ).json();
    templateId = tpl.id;
    await app.request(`/v1/templates/${templateId}/document`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/pdf' },
      body: await makePdf(),
    });
    await app.request(`/v1/templates/${templateId}/fields`, {
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
  }, 60_000);

  it('sends to many recipients from JSON', async () => {
    const res = await app.request(`/v1/templates/${templateId}/bulk-send`, {
      method: 'POST',
      headers: { ...J, authorization: `Bearer ${key}` },
      body: JSON.stringify({
        recipients: [
          { name: 'Ada', email: `ada-${randomUUID()}@x.test` },
          { name: 'Grace', email: `grace-${randomUUID()}@x.test` },
        ],
      }),
    });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.sent).toBe(2);
    expect(body.failed).toBe(0);
    expect(body.envelopes).toHaveLength(2);
    // Each envelope is real and was sent.
    const env = await (
      await app.request(`/v1/envelopes/${body.envelopes[0].envelopeId}`, {
        headers: { authorization: `Bearer ${key}` },
      })
    ).json();
    expect(['sent', 'viewed']).toContain(env.status);
  });

  it('accepts a raw CSV body', async () => {
    const csv = `name,email\nBob,bob-${randomUUID()}@x.test\nCarol,carol-${randomUUID()}@x.test`;
    const res = await app.request(`/v1/templates/${templateId}/bulk-send`, {
      method: 'POST',
      headers: { 'content-type': 'text/csv', authorization: `Bearer ${key}` },
      body: csv,
    });
    expect(res.status).toBe(202);
    expect((await res.json()).sent).toBe(2);
  });
});
