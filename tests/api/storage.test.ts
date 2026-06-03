import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorage } from '@penpact/api/storage';
import { describe, expect, it } from 'vitest';

async function tempStorage() {
  const dir = await mkdtemp(join(tmpdir(), 'penpact-'));
  return new LocalStorage(dir);
}

describe('LocalStorage', () => {
  it('round-trips bytes through nested keys', async () => {
    const storage = await tempStorage();
    const bytes = new Uint8Array([1, 2, 3, 4]);
    expect(await storage.exists('a/b/c.bin')).toBe(false);
    await storage.put('a/b/c.bin', bytes, 'application/octet-stream');
    expect(await storage.exists('a/b/c.bin')).toBe(true);
    expect(Array.from(await storage.get('a/b/c.bin'))).toEqual([1, 2, 3, 4]);
  });

  it('refuses keys that escape the storage root', async () => {
    const storage = await tempStorage();
    await expect(storage.get('../escape.bin')).rejects.toThrow();
  });
});
