import { randomUUID } from 'node:crypto';
import { app } from '@penpact/api';
import { createDatabase, type Database } from '@penpact/db';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { beforeAll, describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL;

/** Pull the penpact_session cookie value out of a Set-Cookie header. */
function sessionCookie(res: Response): string {
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/penpact_session=([^;]+)/);
  if (!match) throw new Error(`no session cookie in: ${setCookie}`);
  return `penpact_session=${match[1]}`;
}

const json = { 'content-type': 'application/json' };

describe.skipIf(!url)('dashboard accounts (integration)', () => {
  let db: Database;
  const email = `dash-${randomUUID()}@penpact.test`;
  const password = 'a-strong-passphrase-1';
  let cookie = '';

  beforeAll(async () => {
    db = createDatabase(url as string);
    await migrate(db, { migrationsFolder: 'packages/db/drizzle' });
  });

  it('signs up and sets a session cookie', async () => {
    const res = await app.request('/dashboard/auth/signup', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email, password }),
    });
    expect(res.status).toBe(201);
    cookie = sessionCookie(res);

    const me = await app.request('/dashboard/me', { headers: { cookie } });
    expect(me.status).toBe(200);
    expect((await me.json()).email).toBe(email.toLowerCase());
  });

  it('rejects a duplicate signup with 409', async () => {
    const res = await app.request('/dashboard/auth/signup', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email, password }),
    });
    expect(res.status).toBe(409);
  });

  it('rejects weak passwords with 422', async () => {
    const res = await app.request('/dashboard/auth/signup', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email: `x-${randomUUID()}@penpact.test`, password: 'short' }),
    });
    expect(res.status).toBe(422);
  });

  it('requires a session for the dashboard API', async () => {
    expect((await app.request('/dashboard/me')).status).toBe(401);
    expect((await app.request('/dashboard/api-keys')).status).toBe(401);
  });

  it('mints an API key that works against /v1, then revokes it', async () => {
    const create = await app.request('/dashboard/api-keys', {
      method: 'POST',
      headers: { ...json, cookie },
      body: JSON.stringify({ name: 'ci-key' }),
    });
    expect(create.status).toBe(201);
    const minted = await create.json();
    expect(minted.key).toMatch(/^pk_live_/);
    expect(minted.prefix.startsWith('pk_live_')).toBe(true);

    // The minted key authenticates a real /v1 request.
    const used = await app.request('/v1/envelopes?limit=1', {
      headers: { authorization: `Bearer ${minted.key}` },
    });
    expect(used.status).toBe(200);

    // It shows up in the key list (without the secret).
    const list = await app.request('/dashboard/api-keys', { headers: { cookie } });
    expect(list.status).toBe(200);
    const keys = (await list.json()).data;
    const found = keys.find((k: { id: string }) => k.id === minted.id);
    expect(found).toBeTruthy();
    expect(found.key).toBeUndefined();

    // Revoke it; afterwards the key no longer authenticates.
    const revoke = await app.request(`/dashboard/api-keys/${minted.id}`, {
      method: 'DELETE',
      headers: { cookie },
    });
    expect(revoke.status).toBe(204);
    const afterRevoke = await app.request('/v1/envelopes?limit=1', {
      headers: { authorization: `Bearer ${minted.key}` },
    });
    expect(afterRevoke.status).toBe(401);
  });

  it('reports usage for the account', async () => {
    const res = await app.request('/dashboard/usage', { headers: { cookie } });
    expect(res.status).toBe(200);
    const usage = await res.json();
    expect(usage).toHaveProperty('envelopesTotal');
    expect(usage).toHaveProperty('envelopesThisMonth');
    expect(usage).toHaveProperty('activeKeys');
  });

  it('manages webhook endpoints and lists deliveries', async () => {
    const create = await app.request('/dashboard/webhook-endpoints', {
      method: 'POST',
      headers: { ...json, cookie },
      body: JSON.stringify({ url: 'https://hooks.example.test/penpact', description: 'prod' }),
    });
    expect(create.status).toBe(201);
    const ep = await create.json();
    expect(ep.secret).toMatch(/^whsec_/);
    expect(ep.url).toBe('https://hooks.example.test/penpact');

    const list = await app.request('/dashboard/webhook-endpoints', { headers: { cookie } });
    expect(list.status).toBe(200);
    const endpoints = (await list.json()).data;
    const found = endpoints.find((e: { id: string }) => e.id === ep.id);
    expect(found).toBeTruthy();
    expect(found.secret).toBeUndefined();

    const deliveries = await app.request('/dashboard/webhook-deliveries', { headers: { cookie } });
    expect(deliveries.status).toBe(200);
    expect(Array.isArray((await deliveries.json()).data)).toBe(true);

    const rejected = await app.request('/dashboard/webhook-endpoints', {
      method: 'POST',
      headers: { ...json, cookie },
      body: JSON.stringify({ url: 'not-a-url' }),
    });
    expect(rejected.status).toBe(422);

    const del = await app.request(`/dashboard/webhook-endpoints/${ep.id}`, {
      method: 'DELETE',
      headers: { cookie },
    });
    expect(del.status).toBe(204);
    const after = await app.request('/dashboard/webhook-endpoints', { headers: { cookie } });
    const remaining = (await after.json()).data;
    expect(remaining.find((e: { id: string }) => e.id === ep.id)).toBeUndefined();
  });

  it('logs in with the right password and rejects the wrong one', async () => {
    const wrong = await app.request('/dashboard/auth/login', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email, password: 'wrong-password-here' }),
    });
    expect(wrong.status).toBe(401);

    const right = await app.request('/dashboard/auth/login', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email, password }),
    });
    expect(right.status).toBe(200);
    expect(sessionCookie(right)).toMatch(/^penpact_session=/);
  });

  it('logs out and invalidates the session', async () => {
    const login = await app.request('/dashboard/auth/login', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email, password }),
    });
    const c = sessionCookie(login);
    expect((await app.request('/dashboard/me', { headers: { cookie: c } })).status).toBe(200);

    const out = await app.request('/dashboard/auth/logout', {
      method: 'POST',
      headers: { cookie: c },
    });
    expect(out.status).toBe(204);
    expect((await app.request('/dashboard/me', { headers: { cookie: c } })).status).toBe(401);
  });
});
