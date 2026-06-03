import { randomUUID } from 'node:crypto';
import { app } from '@penpact/api';
import { createDatabase, type Database } from '@penpact/db';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { beforeAll, describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL;
const J = { 'content-type': 'application/json' };

async function newAccount(): Promise<string> {
  const su = await app.request('/dashboard/auth/signup', {
    method: 'POST',
    headers: J,
    body: JSON.stringify({
      email: `dx-${randomUUID()}@penpact.test`,
      password: 'a-strong-passphrase-1',
    }),
  });
  return `penpact_session=${(su.headers.get('set-cookie') ?? '').match(/penpact_session=([^;]+)/)?.[1]}`;
}

async function mintKey(cookie: string, mode: 'live' | 'test'): Promise<string> {
  const mk = await app.request('/dashboard/api-keys', {
    method: 'POST',
    headers: { ...J, cookie },
    body: JSON.stringify({ name: mode, mode }),
  });
  return (await mk.json()).key as string;
}

const envBody = () =>
  JSON.stringify({
    documentName: 'DX',
    signers: [{ name: 'S', email: `s-${randomUUID()}@x.test` }],
  });

describe.skipIf(!url)('Stripe-grade DX (integration)', () => {
  let cookie = '';
  let liveKey = '';

  beforeAll(async () => {
    const db: Database = createDatabase(url as string);
    await migrate(db, { migrationsFolder: 'packages/db/drizzle' });
    cookie = await newAccount();
    liveKey = await mintKey(cookie, 'live');
  }, 60_000);

  it('echoes an X-Request-Id and rate-limit headers', async () => {
    const res = await app.request('/v1/envelopes?limit=1', {
      headers: { authorization: `Bearer ${liveKey}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });

  it('replays a POST with the same Idempotency-Key (creates once)', async () => {
    const headers = {
      ...J,
      authorization: `Bearer ${liveKey}`,
      'Idempotency-Key': `idem-${randomUUID()}`,
    };
    const body = envBody();
    const a = await app.request('/v1/envelopes', { method: 'POST', headers, body });
    const b = await app.request('/v1/envelopes', { method: 'POST', headers, body });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    const ja = await a.json();
    const jb = await b.json();
    // Same envelope id — the second call replayed, did not create a new one.
    expect(jb.id).toBe(ja.id);
    expect(b.headers.get('idempotent-replayed')).toBe('true');
  });

  it('rejects the same Idempotency-Key with a different body (422)', async () => {
    const idem = `idem-${randomUUID()}`;
    const headers = { ...J, authorization: `Bearer ${liveKey}`, 'Idempotency-Key': idem };
    const first = await app.request('/v1/envelopes', { method: 'POST', headers, body: envBody() });
    expect(first.status).toBe(201);
    const second = await app.request('/v1/envelopes', {
      method: 'POST',
      headers,
      body: envBody(),
    });
    expect(second.status).toBe(422);
  });

  it('tags envelopes with the key mode (test vs live)', async () => {
    const testKey = await mintKey(cookie, 'test');
    const liveRes = await app.request('/v1/envelopes', {
      method: 'POST',
      headers: { ...J, authorization: `Bearer ${liveKey}` },
      body: envBody(),
    });
    const testRes = await app.request('/v1/envelopes', {
      method: 'POST',
      headers: { ...J, authorization: `Bearer ${testKey}` },
      body: envBody(),
    });
    expect((await liveRes.json()).mode).toBe('live');
    expect((await testRes.json()).mode).toBe('test');
  });
});
