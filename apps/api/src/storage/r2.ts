/**
 * Cloudflare R2 (S3-compatible) object storage for the managed cloud. Uses
 * aws4fetch to sign S3 requests — no heavyweight AWS SDK. Selected by
 * getStorage() when the STORAGE_* env vars are present; otherwise local disk.
 */
import { AwsClient } from 'aws4fetch';
import type { Storage } from './types.js';

export interface R2Config {
  /** S3 endpoint, e.g. https://<accountid>.r2.cloudflarestorage.com */
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Build the object URL: `${base}/${key}` with each segment encoded, slashes kept. */
export function r2ObjectUrl(base: string, key: string): string {
  const trimmed = base.replace(/\/+$/, '');
  const encoded = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${trimmed}/${encoded}`;
}

export class R2Storage implements Storage {
  readonly #client: AwsClient;
  readonly #base: string;

  constructor(cfg: R2Config) {
    this.#client = new AwsClient({
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
      region: 'auto',
      service: 's3',
    });
    this.#base = `${cfg.endpoint.replace(/\/+$/, '')}/${cfg.bucket}`;
  }

  async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const res = await this.#client.fetch(r2ObjectUrl(this.#base, key), {
      method: 'PUT',
      body: bytes,
      headers: { 'content-type': contentType },
    });
    if (!res.ok) {
      throw new Error(`R2 put failed for ${key}: ${res.status}`);
    }
  }

  async get(key: string): Promise<Uint8Array> {
    const res = await this.#client.fetch(r2ObjectUrl(this.#base, key), { method: 'GET' });
    if (!res.ok) {
      throw new Error(`R2 get failed for ${key}: ${res.status}`);
    }
    return new Uint8Array(await res.arrayBuffer());
  }

  async exists(key: string): Promise<boolean> {
    const res = await this.#client.fetch(r2ObjectUrl(this.#base, key), { method: 'HEAD' });
    return res.ok;
  }
}
