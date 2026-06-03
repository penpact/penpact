import { randomUUID } from 'node:crypto';
import { logIn, requestPasswordReset, resetPassword, signUp, verifyEmail } from '@penpact/api/accounts';
import { consumeAuthToken, createAuthToken } from '@penpact/api/auth-tokens';
import { createDatabase, type Database, sessions, users } from '@penpact/db';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { beforeAll, describe, expect, it } from 'vitest';

const url = process.env.DATABASE_URL;
const meta = { ip: null, ua: null };

describe.skipIf(!url)('auth tokens + verify/reset (integration)', () => {
  let db: Database;

  beforeAll(async () => {
    db = createDatabase(url as string);
    await migrate(db, { migrationsFolder: 'packages/db/drizzle' });
  });

  async function newUser(): Promise<string> {
    const rows = await db
      .insert(users)
      .values({ email: `tok-${randomUUID()}@penpact.test`, passwordHash: 'x' })
      .returning({ id: users.id });
    return rows[0]?.id as string;
  }

  it('createAuthToken / consumeAuthToken are single-use, purpose- and expiry-scoped', async () => {
    const userId = await newUser();
    const { token } = await createAuthToken(db, userId, 'verify_email', 60_000);

    // wrong purpose -> null
    expect(await consumeAuthToken(db, 'password_reset', token)).toBeNull();
    // right purpose -> userId, once
    expect(await consumeAuthToken(db, 'verify_email', token)).toBe(userId);
    // second use -> null
    expect(await consumeAuthToken(db, 'verify_email', token)).toBeNull();

    // expired -> null
    const expired = await createAuthToken(db, userId, 'verify_email', -1000);
    expect(await consumeAuthToken(db, 'verify_email', expired.token)).toBeNull();
  });

  it('verifyEmail marks the account verified', async () => {
    const session = await signUp(db, `verify-${randomUUID()}@penpact.test`, 'a-strong-pass-1', meta);
    const { token } = await createAuthToken(db, session.userId, 'verify_email', 60_000);
    expect(await verifyEmail(db, token)).toBe(true);
    const row = await db
      .select({ v: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.id, session.userId));
    expect(row[0]?.v).not.toBeNull();
    // a bad token does nothing
    expect(await verifyEmail(db, 'not-a-real-token')).toBe(false);
  });

  it('password reset issues a token only for known emails (no enumeration) and rotates the password', async () => {
    const email = `reset-${randomUUID()}@penpact.test`;
    await signUp(db, email, 'old-password-1', meta);

    expect(await requestPasswordReset(db, 'nobody@penpact.test')).toBeNull();
    const req = await requestPasswordReset(db, email);
    expect(req).not.toBeNull();

    const ok = await resetPassword(db, (req as { token: string }).token, 'new-password-2');
    expect(ok).toBe(true);

    // old password fails, new password works
    await expect(logIn(db, email, 'old-password-1', meta)).rejects.toBeTruthy();
    const session = await logIn(db, email, 'new-password-2', meta);
    expect(session.token).toBeTruthy();

    // the reset token is single-use
    expect(await resetPassword(db, (req as { token: string }).token, 'whatever-3')).toBe(false);
  });

  it('resetPassword invalidates existing sessions', async () => {
    const email = `inval-${randomUUID()}@penpact.test`;
    const session = await signUp(db, email, 'old-password-1', meta);
    const before = await db.select().from(sessions).where(eq(sessions.userId, session.userId));
    expect(before.length).toBeGreaterThanOrEqual(1);

    const req = await requestPasswordReset(db, email);
    await resetPassword(db, (req as { token: string }).token, 'new-password-2');

    const after = await db.select().from(sessions).where(eq(sessions.userId, session.userId));
    expect(after.length).toBe(0);
  });
});
