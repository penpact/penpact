import { LocalStorage } from './local.js';
import { R2Storage } from './r2.js';
import type { Storage } from './types.js';

let cached: Storage | undefined;

/**
 * Resolve the storage backend. The managed cloud uses R2/S3 when the STORAGE_*
 * env vars are set; otherwise local disk (`STORAGE_DIR`, default
 * `.penpact-storage`) for self-hosting and development.
 */
export function getStorage(): Storage {
  if (cached) return cached;
  const endpoint = process.env.STORAGE_ENDPOINT;
  const bucket = process.env.STORAGE_BUCKET;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
  if (endpoint && bucket && accessKeyId && secretAccessKey) {
    cached = new R2Storage({ endpoint, bucket, accessKeyId, secretAccessKey });
  } else {
    cached = new LocalStorage(process.env.STORAGE_DIR ?? '.penpact-storage');
  }
  return cached;
}

export { LocalStorage } from './local.js';
export { R2Storage, r2ObjectUrl } from './r2.js';
export type { Storage } from './types.js';
