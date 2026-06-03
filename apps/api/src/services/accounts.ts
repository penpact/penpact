/**
 * Self-serve dashboard accounts: sign up, sign in, sessions, and API-key
 * management. Distinct from API-key auth (middleware/auth.ts), which protects
 * the public /v1 endpoints. Security follows secure-code-guardian: scrypt
 * password hashing, parameterized queries (Drizzle), generic sign-in errors
 * (no user enumeration), and only hashes of secrets are stored.
 */
import { apiKeys, type Database, envelopes, sessions, users } from '@penpact/db';
import { and, count, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { generateSessionToken, sha256Hex } from '../lib/crypto.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { HttpProblem } from '../lib/problem.js';
import { type MintedKey, mintApiKey } from './keys.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface RequestMeta {
  ip: string | null;
  ua: string | null;
}

export interface SessionResult {
  token: string;
  expiresAt: Date;
}

function invalidCredentials(): never {
  // Generic message — never reveal whether the email exists.
  throw new HttpProblem({
    status: 401,
    title: 'Unauthorized',
    detail: 'Invalid email or password.',
  });
}

async function createSession(
  db: Database,
  userId: string,
  meta: RequestMeta,
): Promise<SessionResult> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    userId,
    tokenHash: sha256Hex(token),
    ipAddress: meta.ip,
    userAgent: meta.ua,
    expiresAt,
  });
  return { token, expiresAt };
}

export async function signUp(
  db: Database,
  email: string,
  password: string,
  meta: RequestMeta,
): Promise<SessionResult> {
  const normalized = email.trim().toLowerCase();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${normalized}`)
    .limit(1);

  if (existing[0]) {
    throw new HttpProblem({
      status: 409,
      title: 'Conflict',
      detail: 'An account with this email already exists.',
    });
  }

  const passwordHash = await hashPassword(password);
  const inserted = await db
    .insert(users)
    .values({ email: normalized, passwordHash })
    .returning({ id: users.id });
  const userId = inserted[0]?.id;
  if (!userId) {
    throw new Error('Failed to create account');
  }
  return createSession(db, userId, meta);
}

export async function logIn(
  db: Database,
  email: string,
  password: string,
  meta: RequestMeta,
): Promise<SessionResult> {
  const normalized = email.trim().toLowerCase();
  const rows = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(sql`lower(${users.email}) = ${normalized}`)
    .limit(1);
  const user = rows[0];
  if (!user?.passwordHash) {
    invalidCredentials();
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    invalidCredentials();
  }
  return createSession(db, user.id, meta);
}

export async function logOut(db: Database, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, sha256Hex(token)));
}

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

/** Resolve the user for a session token, or null if missing/expired. */
export async function getSessionUser(db: Database, token: string): Promise<SessionUser | null> {
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, sha256Hex(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    // Expired — clean it up opportunistically.
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256Hex(token)));
    return null;
  }
  return { id: row.id, email: row.email, name: row.name };
}

export interface ApiKeySummary {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export async function listApiKeys(db: Database, userId: string): Promise<ApiKeySummary[]> {
  const rows = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(desc(apiKeys.createdAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    prefix: r.prefix,
    lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
    revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function createApiKey(db: Database, userId: string, name: string): Promise<MintedKey> {
  return mintApiKey(db, userId, name);
}

/** Revoke one of the caller's own keys. Idempotent; 404 if not theirs. */
export async function revokeApiKey(db: Database, userId: string, keyId: string): Promise<void> {
  const updated = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id });
  if (!updated[0]) {
    // Either it does not exist, is not the caller's, or is already revoked.
    const exists = await db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
      .limit(1);
    if (!exists[0]) {
      throw new HttpProblem({ status: 404, title: 'Not Found', detail: 'API key not found.' });
    }
  }
}

export interface Usage {
  envelopesTotal: number;
  envelopesThisMonth: number;
  activeKeys: number;
}

export async function getUsage(db: Database, userId: string): Promise<Usage> {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const [total, month, keys] = await Promise.all([
    db.select({ n: count() }).from(envelopes).where(eq(envelopes.userId, userId)),
    db
      .select({ n: count() })
      .from(envelopes)
      .where(and(eq(envelopes.userId, userId), gte(envelopes.createdAt, startOfMonth))),
    db
      .select({ n: count() })
      .from(apiKeys)
      .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt))),
  ]);

  return {
    envelopesTotal: total[0]?.n ?? 0,
    envelopesThisMonth: month[0]?.n ?? 0,
    activeKeys: keys[0]?.n ?? 0,
  };
}
