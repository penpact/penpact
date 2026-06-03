/**
 * Bootstrap a user + API key so you can start calling the API.
 *
 *   DATABASE_URL=... pnpm --filter @penpact/api bootstrap you@example.com
 */
import { getDb } from '../db.js';
import { createApiKeyForEmail } from '../services/keys.js';

const email = process.argv[2];
if (!email) {
  console.error('Usage: pnpm --filter @penpact/api bootstrap <email>');
  process.exit(1);
}

const { key } = await createApiKeyForEmail(getDb(), email);
console.log(`User:    ${email}`);
console.log('API key (shown once — store it securely):');
console.log(key);
process.exit(0);
