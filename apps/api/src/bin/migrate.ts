/**
 * Apply database migrations. Run on container start before the server.
 *
 *   DATABASE_URL=... node apps/api/dist/bin/migrate.js
 *
 * MIGRATIONS_DIR defaults to the repo-relative `packages/db/drizzle`.
 */
import { createDatabase } from '@penpact/db';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required to run migrations');
  process.exit(1);
}

const migrationsFolder = process.env.MIGRATIONS_DIR ?? 'packages/db/drizzle';
await migrate(createDatabase(url), { migrationsFolder });
console.log('Penpact: migrations applied.');
process.exit(0);
