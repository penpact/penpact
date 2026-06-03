import { hashPassword, verifyPassword } from '@penpact/api/password';
import { describe, expect, it } from 'vitest';

describe('password hashing (scrypt)', () => {
  it('produces a self-describing scrypt hash, not the plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(hash).not.toContain('correct horse');
    // scrypt$N$r$p$salt$hash
    expect(hash.split('$')).toHaveLength(6);
  });

  it('verifies the right password and rejects the wrong one', async () => {
    const hash = await hashPassword('s3cret-passphrase');
    expect(await verifyPassword('s3cret-passphrase', hash)).toBe(true);
    expect(await verifyPassword('s3cret-passphras', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('salts each hash (same password -> different hashes)', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same-password', a)).toBe(true);
    expect(await verifyPassword('same-password', b)).toBe(true);
  });

  it('rejects malformed stored hashes without throwing', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$bad')).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
  });
});
