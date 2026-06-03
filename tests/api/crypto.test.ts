import { generateApiKey, hashApiKey, sha256Hex } from '@penpact/api/crypto';
import { describe, expect, it } from 'vitest';

describe('crypto', () => {
  it('generates a prefixed live key whose stored hash matches the secret', () => {
    const { key, prefix, hash } = generateApiKey('live');
    expect(key.startsWith('pk_live_')).toBe(true);
    expect(prefix).toBe(key.slice(0, 12));
    expect(hash).toBe(sha256Hex(key));
    expect(hash).toBe(hashApiKey(key));
  });

  it('uses the pk_test_ prefix in test mode', () => {
    expect(generateApiKey('test').key.startsWith('pk_test_')).toBe(true);
  });

  it('produces deterministic 64-char hex digests', () => {
    const digest = sha256Hex('penpact');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256Hex('penpact')).toBe(digest);
  });

  it('does not collide across generated keys', () => {
    expect(generateApiKey().key).not.toBe(generateApiKey().key);
  });
});
