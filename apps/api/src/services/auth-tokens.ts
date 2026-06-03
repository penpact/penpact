/**
 * Single-use, hashed, expiring tokens for email links (verification, password
 * reset). The raw token goes in the email; only its SHA-256 hash is stored.
 */
import { authTokens, type Database } from '@penpact/db';
import { and, eq, isNull } from 'drizzle-orm';
import { generateAuthToken, sha256Hex } from '../lib/crypto.js';

export type AuthTokenPurpose = 'verify_email' | 'password_reset';

export async function createAuthToken(
  db: Database,
  userId: string,
  purpose: AuthTokenPurpose,
  ttlMs: number,
): Promise<{ token: string }> {
  const token = generateAuthToken();
  await db.insert(authTokens).values({
    userId,
    purpose,
    tokenHash: sha256Hex(token),
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return { token };
}

/**
 * Validate a token for the given purpose and, if valid and unused and unexpired,
 * mark it used and return the user id. Returns null otherwise. The update is
 * guarded on `used_at IS NULL` so concurrent consumption cannot double-spend.
 */
export async function consumeAuthToken(
  db: Database,
  purpose: AuthTokenPurpose,
  token: string,
): Promise<string | null> {
  const tokenHash = sha256Hex(token);
  const rows = await db
    .select()
    .from(authTokens)
    .where(
      and(
        eq(authTokens.tokenHash, tokenHash),
        eq(authTokens.purpose, purpose),
        isNull(authTokens.usedAt),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;

  const updated = await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(authTokens.id, row.id), isNull(authTokens.usedAt)))
    .returning({ id: authTokens.id });
  if (!updated[0]) return null;
  return row.userId;
}
