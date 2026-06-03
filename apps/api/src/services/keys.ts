import { apiKeys, type Database, users } from '@penpact/db';
import { sql } from 'drizzle-orm';
import { generateApiKey } from '../lib/crypto.js';

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

  const generated = generateApiKey('live');
  await db.insert(apiKeys).values({
    userId,
    name,
    prefix: generated.prefix,
    keyHash: generated.hash,
  });
  return { key: generated.key, userId };
}
