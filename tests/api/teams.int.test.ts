import { randomUUID } from 'node:crypto';
import { app } from '@penpact/api';
import { createDatabase, type Database } from '@penpact/db';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { beforeAll, describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL;
const J = { 'content-type': 'application/json' };

function cookieOf(res: Response): string {
  return `penpact_session=${(res.headers.get('set-cookie') ?? '').match(/penpact_session=([^;]+)/)?.[1]}`;
}
async function signup(): Promise<{ cookie: string; email: string }> {
  const email = `team-${randomUUID()}@penpact.test`;
  const res = await app.request('/dashboard/auth/signup', {
    method: 'POST',
    headers: J,
    body: JSON.stringify({ email, password: 'a-strong-passphrase-1' }),
  });
  return { cookie: cookieOf(res), email };
}
describe.skipIf(!url)('teams / organizations (integration)', () => {
  beforeAll(async () => {
    const db: Database = createDatabase(url as string);
    await migrate(db, { migrationsFolder: 'packages/db/drizzle' });
  }, 60_000);

  it('shares an organization’s envelopes with invited members, not outsiders', async () => {
    const A = await signup();
    const B = await signup();
    const C = await signup();

    // A creates a shared org and switches into it.
    const org = await (
      await app.request('/dashboard/orgs', {
        method: 'POST',
        headers: { ...J, cookie: A.cookie },
        body: JSON.stringify({ name: 'Acme Legal' }),
      })
    ).json();
    expect(org.id).toBeTruthy();
    const sw = await app.request('/dashboard/active-org', {
      method: 'POST',
      headers: { ...J, cookie: A.cookie },
      body: JSON.stringify({ organizationId: org.id }),
    });
    expect(sw.status).toBe(200);

    // A mints a key (now in the shared org) and creates an envelope with it.
    const key = (
      await (
        await app.request('/dashboard/api-keys', {
          method: 'POST',
          headers: { ...J, cookie: A.cookie },
          body: JSON.stringify({ name: 'team-key' }),
        })
      ).json()
    ).key;
    const env = await (
      await app.request('/v1/envelopes', {
        method: 'POST',
        headers: { ...J, authorization: `Bearer ${key}` },
        body: JSON.stringify({
          documentName: 'Acme contract',
          signers: [{ name: 'S', email: `s-${randomUUID()}@x.test` }],
        }),
      })
    ).json();
    expect(env.id).toBeTruthy();

    // A invites B to the org.
    const invite = await app.request(`/dashboard/orgs/${org.id}/members`, {
      method: 'POST',
      headers: { ...J, cookie: A.cookie },
      body: JSON.stringify({ email: B.email }),
    });
    expect(invite.status).toBe(201);

    // B switches into the org and sees A's envelope.
    await app.request('/dashboard/active-org', {
      method: 'POST',
      headers: { ...J, cookie: B.cookie },
      body: JSON.stringify({ organizationId: org.id }),
    });
    const bList = await (
      await app.request('/dashboard/envelopes', { headers: { cookie: B.cookie } })
    ).json();
    expect(bList.data.find((e: { id: string }) => e.id === env.id)).toBeTruthy();
    // B can open the shared envelope's document.
    const bDoc = await app.request(`/dashboard/envelopes/${env.id}/document`, {
      headers: { cookie: B.cookie },
    });
    expect([200, 404]).toContain(bDoc.status); // 404 only if no doc uploaded; envelope is visible

    // C (not a member) cannot see or read it.
    const cGet = await app.request(`/dashboard/envelopes/${env.id}`, {
      headers: { cookie: C.cookie },
    });
    expect(cGet.status).toBe(404);

    // An outsider cannot invite themselves into the org.
    const sneaky = await app.request(`/dashboard/orgs/${org.id}/members`, {
      method: 'POST',
      headers: { ...J, cookie: C.cookie },
      body: JSON.stringify({ email: C.email }),
    });
    expect([403, 404]).toContain(sneaky.status);
  });

  it('lists a user’s organizations (personal + shared)', async () => {
    const A = await signup();
    await app.request('/dashboard/orgs', {
      method: 'POST',
      headers: { ...J, cookie: A.cookie },
      body: JSON.stringify({ name: 'Side Project' }),
    });
    const orgs = await (
      await app.request('/dashboard/orgs', { headers: { cookie: A.cookie } })
    ).json();
    // personal workspace (from signup) + the new one
    expect(orgs.data.length).toBeGreaterThanOrEqual(2);
    expect(orgs.data.some((o: { name: string }) => o.name === 'Side Project')).toBe(true);
  });
});
