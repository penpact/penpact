import { randomUUID } from 'node:crypto';
import { app } from '@penpact/api';
import { createDatabase, type Database } from '@penpact/db';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { PDFDocument } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL;
const J = { 'content-type': 'application/json' };

describe.skipIf(!url)('document generation (integration)', () => {
  let key = '';

  beforeAll(async () => {
    const db: Database = createDatabase(url as string);
    await migrate(db, { migrationsFolder: 'packages/db/drizzle' });
    const su = await app.request('/dashboard/auth/signup', {
      method: 'POST',
      headers: J,
      body: JSON.stringify({
        email: `gen-${randomUUID()}@penpact.test`,
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

  it('generates an envelope from a template with variables', async () => {
    const res = await app.request('/v1/envelopes/generate', {
      method: 'POST',
      headers: { ...J, authorization: `Bearer ${key}` },
      body: JSON.stringify({
        documentName: 'Generated NDA',
        template: '# NDA\n\nBetween {{a}} and {{b}}.\n\n## Terms\n\n- Confidentiality applies.',
        variables: { a: 'Penpact', b: 'Ada' },
        signers: [{ name: 'Ada', email: `ada-${randomUUID()}@x.test` }],
      }),
    });
    expect(res.status).toBe(201);
    const env = await res.json();
    expect(env.documentName).toBe('Generated NDA');

    // The generated PDF is attached and downloadable.
    const doc = await app.request(`/v1/envelopes/${env.id}/document`, {
      headers: { authorization: `Bearer ${key}` },
    });
    expect(doc.status).toBe(200);
    const bytes = new Uint8Array(await doc.arrayBuffer());
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
