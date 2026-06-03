import { randomUUID } from 'node:crypto';
import { app } from '@penpact/api';
import { sha256Hex } from '@penpact/api/crypto';
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

async function mintKey(): Promise<string> {
  const email = `auth-${randomUUID()}@penpact.test`;
  const su = await app.request('/dashboard/auth/signup', {
    method: 'POST',
    headers: J,
    body: JSON.stringify({ email, password: 'a-strong-passphrase-1' }),
  });
  const cookie = `penpact_session=${(su.headers.get('set-cookie') ?? '').match(/penpact_session=([^;]+)/)?.[1]}`;
  const mk = await app.request('/dashboard/api-keys', {
    method: 'POST',
    headers: { ...J, cookie },
    body: JSON.stringify({ name: 'k' }),
  });
  return (await mk.json()).key as string;
}

/** Create + upload + place a field + send; return the signer's token. */
async function sendEnvelopeWith(
  key: string,
  signer: { name: string; email: string; authMethod: string; accessCode?: string },
  db: Database,
): Promise<{ token: string; signerId: string; envelopeId: string }> {
  const ce = await app.request('/v1/envelopes', {
    method: 'POST',
    headers: { ...J, authorization: `Bearer ${key}` },
    body: JSON.stringify({ documentName: 'Auth test', signers: [signer] }),
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
  return { token: rows[0].token, signerId: sid, envelopeId: env.id };
}

describe.skipIf(!url)('signer authentication (integration)', () => {
  let db: Database;
  let key: string;

  beforeAll(async () => {
    db = createDatabase(url as string);
    await migrate(db, { migrationsFolder: 'packages/db/drizzle' });
    key = await mintKey();
  }, 60_000);

  it('gates a session behind an access code', async () => {
    const { token } = await sendEnvelopeWith(
      key,
      {
        name: 'Ada',
        email: `a-${randomUUID()}@x.test`,
        authMethod: 'access_code',
        accessCode: 'secret-123',
      },
      db,
    );

    // The session is withheld until the code is supplied.
    const gated = await app.request(`/v1/sign/${token}`, {
      headers: { accept: 'application/json' },
    });
    expect(gated.status).toBe(200);
    const body = await gated.json();
    expect(body.authRequired).toBe('access_code');
    expect(body.documents ?? []).toHaveLength(0);

    // Wrong code is rejected.
    const wrong = await app.request(`/v1/sign/${token}/authenticate`, {
      method: 'POST',
      headers: J,
      body: JSON.stringify({ code: 'nope' }),
    });
    expect(wrong.status).toBe(401);

    // Correct code passes, then the full session is available.
    const ok = await app.request(`/v1/sign/${token}/authenticate`, {
      method: 'POST',
      headers: J,
      body: JSON.stringify({ code: 'secret-123' }),
    });
    expect(ok.status).toBe(204);

    const full = await app.request(`/v1/sign/${token}`, {
      headers: { accept: 'application/json' },
    });
    const fullBody = await full.json();
    expect(fullBody.authRequired).toBeUndefined();
    expect(fullBody.documents).toHaveLength(1);
  });

  it('issues and verifies an email OTP', async () => {
    const { token, signerId } = await sendEnvelopeWith(
      key,
      { name: 'Bob', email: `b-${randomUUID()}@x.test`, authMethod: 'email_otp' },
      db,
    );

    // First view issues an OTP (hash stored, not yet passed).
    const gated = await app.request(`/v1/sign/${token}`, {
      headers: { accept: 'application/json' },
    });
    expect((await gated.json()).authRequired).toBe('email_otp');
    const issued = await db
      .select({ otpHash: signers.otpHash, otpExpiresAt: signers.otpExpiresAt })
      .from(signers)
      .where(eq(signers.id, signerId));
    expect(issued[0].otpHash).toBeTruthy();
    expect(issued[0].otpExpiresAt && issued[0].otpExpiresAt.getTime() > Date.now()).toBe(true);

    // Set a known OTP to test the verification path deterministically.
    await db
      .update(signers)
      .set({
        otpHash: sha256Hex('654321'),
        otpExpiresAt: new Date(Date.now() + 600_000),
        otpAttempts: 0,
      })
      .where(eq(signers.id, signerId));

    expect(
      (
        await app.request(`/v1/sign/${token}/authenticate`, {
          method: 'POST',
          headers: J,
          body: JSON.stringify({ code: '000000' }),
        })
      ).status,
    ).toBe(401);

    const ok = await app.request(`/v1/sign/${token}/authenticate`, {
      method: 'POST',
      headers: J,
      body: JSON.stringify({ code: '654321' }),
    });
    expect(ok.status).toBe(204);

    const full = await app.request(`/v1/sign/${token}`, {
      headers: { accept: 'application/json' },
    });
    expect((await full.json()).authRequired).toBeUndefined();
  });

  it('does not gate the default email_link method', async () => {
    const { token } = await sendEnvelopeWith(
      key,
      { name: 'Cy', email: `c-${randomUUID()}@x.test`, authMethod: 'email_link' },
      db,
    );
    const res = await app.request(`/v1/sign/${token}`, { headers: { accept: 'application/json' } });
    const body = await res.json();
    expect(body.authRequired).toBeUndefined();
    expect(body.documents).toHaveLength(1);
  });
});
