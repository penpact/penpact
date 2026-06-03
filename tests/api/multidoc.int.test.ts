import { randomUUID } from 'node:crypto';
import { app } from '@penpact/api';
import { generateApiKey } from '@penpact/api/crypto';
import { apiKeys, createDatabase, type Database, signers, users } from '@penpact/db';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { PDFDocument } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL;

async function pdfWithPages(n: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < n; i++) pdf.addPage([612, 792]);
  return pdf.save();
}

describe.skipIf(!url)('multi-document envelopes (integration)', () => {
  let db: Database;
  let apiKey = '';

  beforeAll(async () => {
    db = createDatabase(url as string);
    await migrate(db, { migrationsFolder: 'packages/db/drizzle' });
    const user = (
      await db
        .insert(users)
        .values({ email: `md-${randomUUID()}@penpact.test` })
        .returning()
    )[0];
    const gen = generateApiKey('test');
    apiKey = gen.key;
    await db.insert(apiKeys).values({ userId: user?.id as string, name: 'md', prefix: gen.prefix, keyHash: gen.hash });
  });

  const auth = () => ({ authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' });
  const pdfHeaders = () => ({ authorization: `Bearer ${apiKey}`, 'content-type': 'application/pdf' });

  it('holds two documents, fields per document, and seals a merged final', async () => {
    const env = await (
      await app.request('/v1/envelopes', {
        method: 'POST',
        headers: auth(),
        body: JSON.stringify({ documentName: 'Bundle', signers: [{ name: 'Sam', email: 'sam@x.test' }] }),
      })
    ).json();
    const signerId = env.signers[0].id;

    // upload two source documents
    const docA = await (
      await app.request(`/v1/envelopes/${env.id}/document`, {
        method: 'PUT',
        headers: pdfHeaders(),
        body: await pdfWithPages(2),
      })
    ).json();
    const docB = await (
      await app.request(`/v1/envelopes/${env.id}/document`, {
        method: 'PUT',
        headers: pdfHeaders(),
        body: await pdfWithPages(1),
      })
    ).json();
    expect(docA.position).toBe(0);
    expect(docB.position).toBe(1);

    // placing a field without documentId is ambiguous with two documents
    const ambiguous = await app.request(`/v1/envelopes/${env.id}/fields`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({
        fields: [{ type: 'signature', signerId, page: 1, x: 10, y: 10, width: 100, height: 30 }],
      }),
    });
    expect(ambiguous.status).toBe(422);

    // a field on each document
    const placed = await app.request(`/v1/envelopes/${env.id}/fields`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({
        fields: [
          { type: 'signature', signerId, documentId: docA.id, page: 2, x: 72, y: 100, width: 150, height: 40 },
          { type: 'text', signerId, documentId: docB.id, page: 1, x: 72, y: 100, width: 150, height: 20 },
        ],
      }),
    });
    expect(placed.status).toBe(201);

    // send + sign
    expect((await app.request(`/v1/envelopes/${env.id}/send`, { method: 'POST', headers: auth() })).status).toBe(200);
    const token = (
      await db.select({ t: signers.signingToken }).from(signers).where(eq(signers.id, signerId))
    )[0]?.t as string;

    const session = await (await app.request(`/v1/sign/${token}`)).json();
    expect(session.documents).toHaveLength(2);

    await app.request(`/v1/sign/${token}/consent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ disclosureHash: session.consentDisclosure.hash, agree: true }),
    });
    const sigField = session.fields.find((f: { type: string }) => f.type === 'signature');
    const txtField = session.fields.find((f: { type: string }) => f.type === 'text');
    const done = await app.request(`/v1/sign/${token}/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        signatureType: 'typed',
        fields: [
          { fieldId: sigField.id, value: 'Sam' },
          { fieldId: txtField.id, value: 'agreed' },
        ],
      }),
    });
    expect(done.status).toBe(200);

    // the sealed final merges both documents: 2 + 1 = 3 pages
    const finalBytes = new Uint8Array(
      await (await app.request(`/v1/envelopes/${env.id}/document`, { headers: { authorization: `Bearer ${apiKey}` } })).arrayBuffer(),
    );
    const finalPdf = await PDFDocument.load(finalBytes);
    expect(finalPdf.getPageCount()).toBe(3);
  });
});
