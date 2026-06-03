import { randomUUID } from 'node:crypto';
import { app } from '@penpact/api';
import { generateApiKey } from '@penpact/api/crypto';
import { apiKeys, createDatabase, type Database, signers, users } from '@penpact/db';
import { and, eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { PDFDocument } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL;

async function onePagePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  return pdf.save();
}

describe.skipIf(!url)(
  'envelope lifecycle: void / sequential / resend / expire (integration)',
  () => {
    let db: Database;
    let apiKey = '';

    beforeAll(async () => {
      db = createDatabase(url as string);
      await migrate(db, { migrationsFolder: 'packages/db/drizzle' });
      const user = (
        await db
          .insert(users)
          .values({ email: `lc-${randomUUID()}@penpact.test` })
          .returning()
      )[0];
      const gen = generateApiKey('test');
      apiKey = gen.key;
      await db
        .insert(apiKeys)
        .values({ userId: user?.id as string, name: 'lc', prefix: gen.prefix, keyHash: gen.hash });
    });

    const auth = () => ({ authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' });

    async function sentEnvelope(
      signerSpecs: Array<{ name: string; email: string; routingOrder?: number }>,
      opts: { expiresAt?: string } = {},
    ): Promise<{ id: string; tokenByEmail: Record<string, string> }> {
      const body: Record<string, unknown> = { documentName: 'LC', signers: signerSpecs };
      if (opts.expiresAt) body.expiresAt = opts.expiresAt;
      const env = await (
        await app.request('/v1/envelopes', {
          method: 'POST',
          headers: auth(),
          body: JSON.stringify(body),
        })
      ).json();
      await app.request(`/v1/envelopes/${env.id}/document`, {
        method: 'PUT',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/pdf' },
        body: await onePagePdf(),
      });
      for (const s of env.signers) {
        await app.request(`/v1/envelopes/${env.id}/fields`, {
          method: 'POST',
          headers: auth(),
          body: JSON.stringify({
            fields: [
              {
                type: 'signature',
                signerId: s.id,
                page: 1,
                x: 100,
                y: 100,
                width: 120,
                height: 30,
              },
            ],
          }),
        });
      }
      await app.request(`/v1/envelopes/${env.id}/send`, { method: 'POST', headers: auth() });
      const rows = await db
        .select({ email: signers.email, token: signers.signingToken })
        .from(signers)
        .where(eq(signers.envelopeId, env.id));
      const tokenByEmail: Record<string, string> = {};
      for (const r of rows) tokenByEmail[r.email] = r.token;
      return { id: env.id, tokenByEmail };
    }

    async function signThrough(token: string): Promise<number> {
      const session = await (await app.request(`/v1/sign/${token}`)).json();
      if (session.consentDisclosure) {
        await app.request(`/v1/sign/${token}/consent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ disclosureHash: session.consentDisclosure.hash, agree: true }),
        });
      }
      const fieldId = session.fields[0].id;
      const res = await app.request(`/v1/sign/${token}/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ signatureType: 'typed', fields: [{ fieldId, value: 'X' }] }),
      });
      return res.status;
    }

    it('voids a sent envelope and closes the signing link', async () => {
      const { id, tokenByEmail } = await sentEnvelope([{ name: 'A', email: 'a@x.test' }]);
      const res = await app.request(`/v1/envelopes/${id}/void`, {
        method: 'POST',
        headers: auth(),
        body: JSON.stringify({ reason: 'mistake' }),
      });
      expect(res.status).toBe(200);
      expect((await res.json()).status).toBe('voided');
      // the signer can no longer open the session
      expect((await app.request(`/v1/sign/${tokenByEmail['a@x.test']}`)).status).toBe(410);
    });

    it('refuses to void a completed envelope', async () => {
      const { id, tokenByEmail } = await sentEnvelope([{ name: 'A', email: 'a2@x.test' }]);
      await signThrough(tokenByEmail['a2@x.test'] as string);
      const res = await app.request(`/v1/envelopes/${id}/void`, {
        method: 'POST',
        headers: auth(),
        body: '{}',
      });
      expect(res.status).toBe(409);
    });

    it('enforces sequential routing order', async () => {
      const { id, tokenByEmail } = await sentEnvelope([
        { name: 'First', email: 'first@x.test', routingOrder: 1 },
        { name: 'Second', email: 'second@x.test', routingOrder: 2 },
      ]);
      // signer 2 cannot act before signer 1
      expect((await app.request(`/v1/sign/${tokenByEmail['second@x.test']}`)).status).toBe(409);
      // signer 1 signs
      expect(await signThrough(tokenByEmail['first@x.test'] as string)).toBe(200);
      // now signer 2 can sign, completing the envelope
      expect(await signThrough(tokenByEmail['second@x.test'] as string)).toBe(200);
      const env = await (await app.request(`/v1/envelopes/${id}`, { headers: auth() })).json();
      expect(env.status).toBe('completed');
    });

    it('resends an invite to the active signer, but not to one whose turn has not come', async () => {
      const { id, tokenByEmail } = await sentEnvelope([
        { name: 'First', email: 'r1@x.test', routingOrder: 1 },
        { name: 'Second', email: 'r2@x.test', routingOrder: 2 },
      ]);
      const first = await db
        .select({ id: signers.id })
        .from(signers)
        .where(and(eq(signers.envelopeId, id), eq(signers.email, 'r1@x.test')));
      const second = await db
        .select({ id: signers.id })
        .from(signers)
        .where(and(eq(signers.envelopeId, id), eq(signers.email, 'r2@x.test')));
      const ok = await app.request(`/v1/envelopes/${id}/signers/${first[0]?.id}/resend`, {
        method: 'POST',
        headers: auth(),
      });
      expect(ok.status).toBe(204);
      const tooEarly = await app.request(`/v1/envelopes/${id}/signers/${second[0]?.id}/resend`, {
        method: 'POST',
        headers: auth(),
      });
      expect(tooEarly.status).toBe(409);
      expect(tokenByEmail).toBeDefined();
    });

    it('treats an expired envelope as closed', async () => {
      const past = new Date(Date.now() - 60_000).toISOString();
      const { tokenByEmail } = await sentEnvelope([{ name: 'A', email: 'exp@x.test' }], {
        expiresAt: past,
      });
      expect((await app.request(`/v1/sign/${tokenByEmail['exp@x.test']}`)).status).toBe(410);
    });
  },
);
