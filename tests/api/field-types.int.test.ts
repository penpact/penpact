import { randomUUID } from 'node:crypto';
import { app } from '@penpact/api';
import { createDatabase, type Database, signers } from '@penpact/db';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { PDFDocument } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL;
const J = { 'content-type': 'application/json' };

// 1x1 transparent PNG as a stamp image value.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function makePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  return pdf.save();
}

describe.skipIf(!url)('extended field types (integration)', () => {
  let db: Database;
  let key = '';

  beforeAll(async () => {
    db = createDatabase(url as string);
    await migrate(db, { migrationsFolder: 'packages/db/drizzle' });
    const su = await app.request('/dashboard/auth/signup', {
      method: 'POST',
      headers: J,
      body: JSON.stringify({
        email: `ft-${randomUUID()}@penpact.test`,
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

  it('places dropdown/radio/stamp fields, surfaces options, and seals chosen values', async () => {
    const env = await (
      await app.request('/v1/envelopes', {
        method: 'POST',
        headers: { ...J, authorization: `Bearer ${key}` },
        body: JSON.stringify({
          documentName: 'Field types',
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

    const place = await app.request(`/v1/envelopes/${env.id}/fields`, {
      method: 'POST',
      headers: { ...J, authorization: `Bearer ${key}` },
      body: JSON.stringify({
        fields: [
          {
            type: 'dropdown',
            signerId: sid,
            page: 1,
            x: 60,
            y: 100,
            width: 120,
            height: 24,
            options: ['Yes', 'No'],
          },
          {
            type: 'radio',
            signerId: sid,
            page: 1,
            x: 60,
            y: 140,
            width: 120,
            height: 24,
            options: ['A', 'B'],
          },
          { type: 'stamp', signerId: sid, page: 1, x: 60, y: 200, width: 120, height: 60 },
          { type: 'text', signerId: sid, page: 1, x: 60, y: 280, width: 200, height: 24 },
        ],
      }),
    });
    expect(place.status).toBe(201);
    const placed = (await place.json()).data;
    const drop = placed.find((f: { type: string }) => f.type === 'dropdown');
    expect(drop.options).toEqual(['Yes', 'No']);

    await app.request(`/v1/envelopes/${env.id}/send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
    });
    const token = (
      await db.select({ token: signers.signingToken }).from(signers).where(eq(signers.id, sid))
    )[0].token;

    // The signer session carries the choices.
    const session = await (
      await app.request(`/v1/sign/${token}`, { headers: { accept: 'application/json' } })
    ).json();
    const sessionDrop = session.fields.find((f: { type: string }) => f.type === 'dropdown');
    expect(sessionDrop.options).toEqual(['Yes', 'No']);

    await app.request(`/v1/sign/${token}/consent`, {
      method: 'POST',
      headers: J,
      body: JSON.stringify({ disclosureHash: session.consentDisclosure.hash, agree: true }),
    });

    const fieldValues = session.fields.map((f: { id: string; type: string }) => {
      if (f.type === 'dropdown') return { fieldId: f.id, value: 'No' };
      if (f.type === 'radio') return { fieldId: f.id, value: 'B' };
      if (f.type === 'stamp') return { fieldId: f.id, value: PNG };
      return { fieldId: f.id, value: 'hello world' };
    });
    const complete = await app.request(`/v1/sign/${token}/complete`, {
      method: 'POST',
      headers: J,
      body: JSON.stringify({ signatureType: 'typed', fields: fieldValues }),
    });
    expect(complete.status).toBe(200);
    expect((await complete.json()).status).toBe('signed');

    // The sealed final downloads as a valid PDF.
    const final = await app.request(`/v1/envelopes/${env.id}/document`, {
      headers: { authorization: `Bearer ${key}` },
    });
    const bytes = new Uint8Array(await final.arrayBuffer());
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
  });
});
