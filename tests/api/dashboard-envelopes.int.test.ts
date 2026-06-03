import { randomUUID } from 'node:crypto';
import { app } from '@penpact/api';
import { createDatabase, type Database } from '@penpact/db';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { PDFDocument } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL;
const json = { 'content-type': 'application/json' };

function sessionCookie(res: Response): string {
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/penpact_session=([^;]+)/);
  if (!match) throw new Error(`no session cookie in: ${setCookie}`);
  return `penpact_session=${match[1]}`;
}

async function makePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  return pdf.save();
}

/** Sign up a fresh account and mint an API key; return its cookie + key. */
async function newAccount(): Promise<{ cookie: string; key: string }> {
  const email = `denv-${randomUUID()}@penpact.test`;
  const signup = await app.request('/dashboard/auth/signup', {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ email, password: 'a-strong-passphrase-1' }),
  });
  const cookie = sessionCookie(signup);
  const mint = await app.request('/dashboard/api-keys', {
    method: 'POST',
    headers: { ...json, cookie },
    body: JSON.stringify({ name: 'env-key' }),
  });
  const key = (await mint.json()).key as string;
  return { cookie, key };
}

async function createEnvelope(key: string, name: string): Promise<string> {
  const res = await app.request('/v1/envelopes', {
    method: 'POST',
    headers: { ...json, authorization: `Bearer ${key}` },
    body: JSON.stringify({
      documentName: name,
      signers: [{ name: 'Signer', email: `s-${randomUUID()}@penpact.test` }],
    }),
  });
  return (await res.json()).id as string;
}

describe.skipIf(!url)('dashboard envelopes (integration)', () => {
  let A: { cookie: string; key: string };
  let B: { cookie: string; key: string };
  let envA: string;
  let envB: string;
  let pdfBytes: Uint8Array;

  beforeAll(async () => {
    const db: Database = createDatabase(url as string);
    await migrate(db, { migrationsFolder: 'packages/db/drizzle' });
    A = await newAccount();
    B = await newAccount();
    envA = await createEnvelope(A.key, 'Owner A doc');
    envB = await createEnvelope(B.key, 'Owner B doc');
    pdfBytes = await makePdf();
    const up = await app.request(`/v1/envelopes/${envA}/document`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${A.key}`, 'content-type': 'application/pdf' },
      body: pdfBytes,
    });
    expect(up.status).toBe(200);
  }, 60_000);

  it('lists only the owner’s envelopes by cookie session', async () => {
    const res = await app.request('/dashboard/envelopes', { headers: { cookie: A.cookie } });
    expect(res.status).toBe(200);
    const data = (await res.json()).data as Array<{ id: string; documentName: string }>;
    expect(data.find((e) => e.id === envA)).toBeTruthy();
    expect(data.find((e) => e.id === envB)).toBeUndefined();
  });

  it('requires a session for envelope routes', async () => {
    expect((await app.request('/dashboard/envelopes')).status).toBe(401);
    expect((await app.request(`/dashboard/envelopes/${envA}/document`)).status).toBe(401);
    expect((await app.request(`/dashboard/envelopes/${envA}/certificate`)).status).toBe(401);
  });

  it('downloads the document by session and enforces ownership', async () => {
    const ok = await app.request(`/dashboard/envelopes/${envA}/document`, {
      headers: { cookie: A.cookie },
    });
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toContain('application/pdf');
    const bytes = new Uint8Array(await ok.arrayBuffer());
    expect(bytes.byteLength).toBe(pdfBytes.byteLength);

    // Owner B must not reach owner A's document.
    const denied = await app.request(`/dashboard/envelopes/${envA}/document`, {
      headers: { cookie: B.cookie },
    });
    expect(denied.status).toBe(404);
  });

  it('returns 404 for a certificate that does not exist yet', async () => {
    const res = await app.request(`/dashboard/envelopes/${envA}/certificate`, {
      headers: { cookie: A.cookie },
    });
    expect(res.status).toBe(404);
  });
});
