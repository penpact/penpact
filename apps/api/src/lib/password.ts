import { randomBytes, type ScryptOptions, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';

// Promisify the callback form ourselves so the options overload is preserved
// (util.promisify collapses to the 3-arg signature and drops the cost params).
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey as Buffer);
    });
  });
}

// scrypt is a memory-hard KDF built into Node, so no native dependency is
// needed. Parameters follow current OWASP guidance (N=2^16, r=8, p=1). The
// stored format is self-describing so the cost can be raised later without
// breaking existing hashes: scrypt$<N>$<r>$<p>$<saltB64>$<hashB64>.
const N = 1 << 16;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 128 * N * R * 2; // scrypt needs ~128*N*r bytes; give headroom.

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(plain, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM })) as Buffer;
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nStr, rStr, pStr, saltB64, hashB64] = parts;
  const n = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  const salt = Buffer.from(saltB64 as string, 'base64');
  const expected = Buffer.from(hashB64 as string, 'base64');
  let derived: Buffer;
  try {
    derived = (await scrypt(plain, salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: 128 * n * r * 2,
    })) as Buffer;
  } catch {
    return false;
  }
  // Constant-time comparison; lengths must match for timingSafeEqual.
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
