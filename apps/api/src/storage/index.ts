import { LocalStorage } from './local.js';
import type { Storage } from './types.js';

let cached: Storage | undefined;

/**
 * Resolve the storage backend. Today: local disk (`STORAGE_DIR`, default
 * `.penpact-storage`). An R2/S3 backend will be selected here when
 * `STORAGE_ENDPOINT` is configured (cloud).
 */
export function getStorage(): Storage {
  if (!cached) {
    cached = new LocalStorage(process.env.STORAGE_DIR ?? '.penpact-storage');
  }
  return cached;
}

export { LocalStorage } from './local.js';
export type { Storage } from './types.js';
