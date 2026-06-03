import { createDatabase, type Database } from '@penpact/db';

let cached: Database | undefined;

/** Lazily create the Drizzle client from DATABASE_URL (so the app can boot without a DB for /health). */
export function getDb(): Database {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set');
    }
    cached = createDatabase(url);
  }
  return cached;
}
