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

/** SHA-256 (hex) of raw bytes — used for document integrity. */
export function sha256HexBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
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

/** Opaque, unguessable session token carried in the dashboard cookie. */
export function generateSessionToken(): string {
  return base62(48);
}

/** Per-endpoint webhook signing secret (shared HMAC key, shown once). */
export function generateWebhookSecret(): string {
  return `whsec_${base62(40)}`;
}

/** Opaque single-use token for email links (verification, password reset). */
export function generateAuthToken(): string {
  return base62(40);
}
