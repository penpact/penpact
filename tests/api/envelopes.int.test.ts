import { randomUUID } from 'node:crypto';
import { app } from '@penpact/api';
import { generateApiKey } from '@penpact/api/crypto';
import { apiKeys, createDatabase, type Database, signers, users } from '@penpact/db';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { PDFDocument } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';

async function onePagePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  return pdf.save();
}

const url = process.env.DATABASE_URL;

// Integration tests run only when a Postgres URL is provided (CI + local docker).
describe.skipIf(!url)('envelopes (integration)', () => {
  let db: Database;
  let apiKey = '';

  beforeAll(async () => {
    db = createDatabase(url as string);
    await migrate(db, { migrationsFolder: 'packages/db/drizzle' });

    const userRows = await db
      .insert(users)
      .values({ email: `it-${randomUUID()}@penpact.test`, name: 'IT User' })
      .returning();
    const user = userRows[0];
    if (!user) {
      throw new Error('seed user failed');
    }

    const generated = generateApiKey('test');
    apiKey = generated.key;
    await db.insert(apiKeys).values({
      userId: user.id,
      name: 'integration',
      prefix: generated.prefix,
      keyHash: generated.hash,
    });
  });

  const headers = () => ({
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json',
  });

  it('creates, retrieves and lists an envelope', async () => {
    const createRes = await app.request('/v1/envelopes', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        documentName: 'Mutual NDA',
        signers: [{ name: 'Bob', email: 'bob@example.com' }],
      }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.status).toBe('draft');
    expect(created.signers).toHaveLength(1);
    expect(created.documentName).toBe('Mutual NDA');

    const getRes = await app.request(`/v1/envelopes/${created.id}`, { headers: headers() });
    expect(getRes.status).toBe(200);
    expect((await getRes.json()).id).toBe(created.id);

    const listRes = await app.request('/v1/envelopes?limit=10', { headers: headers() });
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(Array.isArray(list.data)).toBe(true);
    expect(list.data.length).toBeGreaterThanOrEqual(1);
    expect(list.pagination).toHaveProperty('hasMore');
  });

  it('rejects an unknown API key', async () => {
    const res = await app.request('/v1/envelopes?limit=1', {
      headers: { authorization: 'Bearer pk_test_does_not_exist' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 404 for an envelope that does not exist', async () => {
    const res = await app.request(`/v1/envelopes/${randomUUID()}`, { headers: headers() });
    expect(res.status).toBe(404);
  });

  async function createDraft(): Promise<{ id: string; signerId: string }> {
    const res = await app.request('/v1/envelopes', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        documentName: 'Doc',
        signers: [{ name: 'Bob', email: 'bob@example.com' }],
      }),
    });
    const env = await res.json();
    return { id: env.id, signerId: env.signers[0].id };
  }

  it('uploads a PDF, places a field, downloads it, and stubs auto-detect', async () => {
    const { id, signerId } = await createDraft();
    const pdfBytes = await onePagePdf();

    const upload = await app.request(`/v1/envelopes/${id}/document`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/pdf' },
      body: pdfBytes,
    });
    expect(upload.status).toBe(200);
    const doc = await upload.json();
    expect(doc.pageCount).toBe(1);
    expect(doc.contentHash).toMatch(/^[0-9a-f]{64}$/);

    const place = await app.request(`/v1/envelopes/${id}/fields`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        fields: [{ type: 'signature', signerId, page: 1, x: 100, y: 100, width: 150, height: 40 }],
      }),
    });
    expect(place.status).toBe(201);
    expect((await place.json()).data).toHaveLength(1);

    const badPage = await app.request(`/v1/envelopes/${id}/fields`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        fields: [{ type: 'date', signerId, page: 9, x: 1, y: 1, width: 10, height: 10 }],
      }),
    });
    expect(badPage.status).toBe(422);

    const download = await app.request(`/v1/envelopes/${id}/document`, { headers: headers() });
    expect(download.status).toBe(200);
    expect(download.headers.get('content-type')).toContain('application/pdf');
    expect(new Uint8Array(await download.arrayBuffer()).byteLength).toBe(pdfBytes.byteLength);

    const auto = await app.request(`/v1/envelopes/${id}/fields/auto-detect`, {
      method: 'POST',
      headers: headers(),
    });
    expect(auto.status).toBe(501);
  });

  it('rejects a non-PDF upload with 422', async () => {
    const { id } = await createDraft();
    const res = await app.request(`/v1/envelopes/${id}/document`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/pdf' },
      body: new Uint8Array([1, 2, 3]),
    });
    expect(res.status).toBe(422);
  });

  const jsonHeaders = { 'content-type': 'application/json' };

  async function sentEnvelopeWithSigner(): Promise<{ id: string; token: string }> {
    const { id, signerId } = await createDraft();
    await app.request(`/v1/envelopes/${id}/document`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/pdf' },
      body: await onePagePdf(),
    });
    await app.request(`/v1/envelopes/${id}/fields`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        fields: [{ type: 'signature', signerId, page: 1, x: 100, y: 100, width: 150, height: 40 }],
      }),
    });
    const sent = await app.request(`/v1/envelopes/${id}/send`, {
      method: 'POST',
      headers: headers(),
    });
    expect(sent.status).toBe(200);
    const tokenRows = await db
      .select({ token: signers.signingToken })
      .from(signers)
      .where(eq(signers.envelopeId, id));
    const token = tokenRows[0]?.token;
    if (!token) {
      throw new Error('missing signing token');
    }
    return { id, token };
  }

  it('runs the full signing flow (view → consent gate → complete → completed)', async () => {
    const { id, token } = await sentEnvelopeWithSigner();

    const sessionRes = await app.request(`/v1/sign/${token}`);
    expect(sessionRes.status).toBe(200);
    const session = await sessionRes.json();
    expect(session.consentRequired).toBe(true);
    expect(session.consentDisclosure.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(session.fields).toHaveLength(1);
    const fieldId = session.fields[0].id;
    const disclosureHash = session.consentDisclosure.hash;

    const docRes = await app.request(`/v1/sign/${token}/document`);
    expect(docRes.status).toBe(200);
    expect(docRes.headers.get('content-type')).toContain('application/pdf');

    // Signing before consent is blocked.
    const early = await app.request(`/v1/sign/${token}/complete`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ signatureType: 'typed', fields: [{ fieldId, value: 'Bob' }] }),
    });
    expect(early.status).toBe(422);

    const consent = await app.request(`/v1/sign/${token}/consent`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ disclosureHash, agree: true }),
    });
    expect(consent.status).toBe(204);

    const complete = await app.request(`/v1/sign/${token}/complete`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ signatureType: 'typed', fields: [{ fieldId, value: 'Bob' }] }),
    });
    expect(complete.status).toBe(200);
    expect((await complete.json()).status).toBe('signed');

    const envRes = await app.request(`/v1/envelopes/${id}`, { headers: headers() });
    const envBody = await envRes.json();
    expect(envBody.status).toBe('completed');
    expect(envBody.documentHashFinal).toMatch(/^[0-9a-f]{64}$/);

    // The sealed document and Certificate of Completion are available.
    const finalDoc = await app.request(`/v1/envelopes/${id}/document`, { headers: headers() });
    expect(finalDoc.status).toBe(200);
    const certRes = await app.request(`/v1/envelopes/${id}/certificate`, { headers: headers() });
    expect(certRes.status).toBe(200);
    expect(certRes.headers.get('content-type')).toContain('application/pdf');
    expect(new Uint8Array(await certRes.arrayBuffer()).byteLength).toBeGreaterThan(0);

    // The session is gone once completed.
    expect((await app.request(`/v1/sign/${token}`)).status).toBe(410);
  });

  it('404s the certificate before completion', async () => {
    const { id } = await createDraft();
    const res = await app.request(`/v1/envelopes/${id}/certificate`, { headers: headers() });
    expect(res.status).toBe(404);
  });

  it('records a decline and closes the envelope', async () => {
    const { id, token } = await sentEnvelopeWithSigner();
    const res = await app.request(`/v1/sign/${token}/decline`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ reason: 'No thanks' }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('declined');
    const env = await app.request(`/v1/envelopes/${id}`, { headers: headers() });
    expect((await env.json()).status).toBe('declined');
  });

  it('404s an unknown signing token', async () => {
    expect((await app.request('/v1/sign/nope-not-a-token')).status).toBe(404);
  });
});
