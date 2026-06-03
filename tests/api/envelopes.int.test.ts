import { randomUUID } from 'node:crypto';
import { app } from '@penpact/api';
import { generateApiKey } from '@penpact/api/crypto';
import { apiKeys, createDatabase, type Database, users } from '@penpact/db';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { beforeAll, describe, expect, it } from 'vitest';

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
});
