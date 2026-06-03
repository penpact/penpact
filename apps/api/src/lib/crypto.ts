import { createHash, randomBytes } from 'node:crypto';

const BASE62 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function base62(byteLength: number): string {
  const bytes = randomBytes(byteLength);
  let out = '';
  for (const b of bytes) {
    out += BASE62.charAt(b % 62);
  }
  return out;
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export interface GeneratedApiKey {
  /** The full secret — shown to the user exactly once, never stored. */
  key: string;
  /** Non-secret display prefix (e.g. "pk_live_AbC1"). */
  prefix: string;
  /** SHA-256 of `key` — this is what we persist. */
  hash: string;
}

export function generateApiKey(mode: 'live' | 'test' = 'live'): GeneratedApiKey {
  const key = `pk_${mode}_${base62(32)}`;
  return { key, prefix: key.slice(0, 12), hash: sha256Hex(key) };
}

export const hashApiKey = sha256Hex;

/** Opaque, unguessable token used to authorize a signer's signing link. */
export function generateSigningToken(): string {
  return base62(40);
}
