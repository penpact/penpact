import { apiKeys, type Database, users } from '@penpact/db';
import { sql } from 'drizzle-orm';
import { generateApiKey } from '../lib/crypto.js';
import { personalOrgId } from './organizations.js';

/**
 * Find-or-create a user by email (case-insensitive) and mint a new API key.
 * The raw key is returned once and never stored (only its SHA-256 hash).
 */
export async function createApiKeyForEmail(
  db: Database,
  email: string,
  name = 'default',
): Promise<{ key: string; userId: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes('@')) {
    throw new Error('A valid email is required');
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${normalized}`)
    .limit(1);

  let userId = existing[0]?.id;
  if (!userId) {
    const inserted = await db
      .insert(users)
      .values({ email: normalized })
      .returning({ id: users.id });
    userId = inserted[0]?.id;
    if (!userId) {
      throw new Error('Failed to create user');
    }
  }

  const organizationId = await personalOrgId(db, userId);
  const generated = generateApiKey('live');
  await db.insert(apiKeys).values({
    userId,
    organizationId,
    name,
    prefix: generated.prefix,
    keyHash: generated.hash,
  });
  return { key: generated.key, userId };
}

export interface MintedKey {
  id: string;
  name: string;
  prefix: string;
  /** The full secret — returned once, never stored. */
  key: string;
  createdAt: string;
}

/** Mint a new API key for an existing user. The raw key is returned once. */
export async function mintApiKey(
  db: Database,
  userId: string,
  name = 'default',
  mode: 'live' | 'test' = 'live',
  organizationId?: string,
): Promise<MintedKey> {
  const orgId = organizationId ?? (await personalOrgId(db, userId));
  const generated = generateApiKey(mode);
  const inserted = await db
    .insert(apiKeys)
    .values({
      userId,
      organizationId: orgId,
      name,
      prefix: generated.prefix,
      keyHash: generated.hash,
      mode,
    })
    .returning({ id: apiKeys.id, createdAt: apiKeys.createdAt });
  const row = inserted[0];
  if (!row) {
    throw new Error('Failed to create API key');
  }
  return {
    id: row.id,
    name,
    prefix: generated.prefix,
    key: generated.key,
    createdAt: row.createdAt.toISOString(),
  };
}
