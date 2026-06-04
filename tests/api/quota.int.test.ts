import { randomUUID } from 'node:crypto';
import { app } from '@penpact/api';
import { createDatabase, type Database, envelopes, organizations, users } from '@penpact/db';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { PDFDocument } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL;
const J = { 'content-type': 'application/json' };

function cookieOf(res: Response): string {
  return `penpact_session=${(res.headers.get('set-cookie') ?? '').match(/penpact_session=([^;]+)/)?.[1]}`;
}
async function onePagePdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  return pdf.save();
}

describe.skipIf(!url)('send quota + attribution (integration)', () => {
  let db: Database;
  beforeAll(async () => {
    db = createDatabase(url as string);
    await migrate(db, { migrationsFolder: 'packages/db/drizzle' });
  }, 60_000);

  async function signup(): Promise<{ cookie: string; email: string; userId: string; orgId: string }> {
    const email = `quota-${randomUUID()}@penpact.test`;
    const res = await app.request('/dashboard/auth/signup', {
      method: 'POST',
      headers: J,
      body: JSON.stringify({ email, password: 'a-strong-passphrase-1' }),
    });
    const cookie = cookieOf(res);
    const user = (await db.select().from(users).where(eq(users.email, email)))[0];
    const org = (
      await db.select().from(organizations).where(eq(organizations.createdBy, user?.id as string))
    )[0];
    return { cookie, email, userId: user?.id as string, orgId: org?.id as string };
  }

  async function mintKey(cookie: string): Promise<string> {
    const r = await app.request('/dashboard/api-keys', {
      method: 'POST',
      headers: { ...J, cookie },
      body: JSON.stringify({ name: 'q' }),
    });
    return (await r.json()).key;
  }

  async function sendableEnvelope(key: string): Promise<string> {
    const env = await (
      await app.request('/v1/envelopes', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, ...J },
        body: JSON.stringify({
          documentName: 'Q',
          signers: [{ name: 'S', email: `s-${randomUUID()}@penpact.test` }],
        }),
      })
    ).json();
    await app.request(`/v1/envelopes/${env.id}/document`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/pdf' },
      body: await onePagePdf(),
    });
    await app.request(`/v1/envelopes/${env.id}/fields`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, ...J },
      body: JSON.stringify({
        fields: [
          { type: 'signature', signerId: env.signers[0].id, page: 1, x: 100, y: 100, width: 120, height: 30 },
        ],
      }),
    });
    return env.id;
  }

  it('reports the free plan + quota in usage, and allows a send under the cap', async () => {
    const { cookie } = await signup();
    const key = await mintKey(cookie);

    const usage1 = await (await app.request('/dashboard/usage', { headers: { cookie } })).json();
    expect(usage1.plan).toBe('free');
    expect(usage1.sendLimit).toBe(50);
    expect(usage1.sentThisMonth).toBe(0);

    const id = await sendableEnvelope(key);
    const send = await app.request(`/v1/envelopes/${id}/send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
    });
    expect(send.status).toBe(200);

    const usage2 = await (await app.request('/dashboard/usage', { headers: { cookie } })).json();
    expect(usage2.sentThisMonth).toBe(1);
  });

  it('blocks a send past the free monthly cap with a 402', async () => {
    const { cookie, userId, orgId } = await signup();
    const key = await mintKey(cookie);

    // Seed 50 already-sent envelopes this month for the org → at the cap.
    const now = new Date();
    await db.insert(envelopes).values(
      Array.from({ length: 50 }, () => ({
        userId,
        organizationId: orgId,
        documentName: 'seed',
        status: 'sent' as const,
        senderName: 'Seed',
        senderEmail: 'seed@penpact.test',
        sentAt: now,
      })),
    );

    const id = await sendableEnvelope(key);
    const send = await app.request(`/v1/envelopes/${id}/send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
    });
    expect(send.status).toBe(402);
    const body = await send.json();
    expect(body.title).toBe('Quota exceeded');

    // Bumping the org to pro lifts the cap → the same send now succeeds.
    await db.update(organizations).set({ plan: 'pro' }).where(eq(organizations.id, orgId));
    const send2 = await app.request(`/v1/envelopes/${id}/send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}` },
    });
    expect(send2.status).toBe(200);
  });

  it('exposes attribution=true on a free org public template, false on a paid org', async () => {
    const { cookie, orgId } = await signup();
    const key = await mintKey(cookie);
    const bearer = { authorization: `Bearer ${key}` };
    const tpl = await (
      await app.request('/v1/templates', {
        method: 'POST',
        headers: { ...bearer, ...J },
        body: JSON.stringify({ name: 'Public NDA', documentName: 'NDA', roles: [{ name: 'Signer' }] }),
      })
    ).json();
    await app.request(`/v1/templates/${tpl.id}/document`, {
      method: 'PUT',
      headers: { ...bearer, 'content-type': 'application/pdf' },
      body: await onePagePdf(),
    });
    const pub = await (
      await app.request(`/v1/templates/${tpl.id}/publish`, { method: 'POST', headers: bearer })
    ).json();
    const slug = pub.publicSlug ?? pub.slug;
    expect(slug).toBeTruthy();

    const free = await (await app.request(`/v1/public/templates/${slug}`)).json();
    expect(free.attribution).toBe(true);

    await db.update(organizations).set({ plan: 'pro' }).where(eq(organizations.id, orgId));
    const paid = await (await app.request(`/v1/public/templates/${slug}`)).json();
    expect(paid.attribution).toBe(false);
  });
});
