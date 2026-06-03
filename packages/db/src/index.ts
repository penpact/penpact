/**
 * @penpact/db — Postgres client (Drizzle + postgres.js) and schema re-export.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export * from './schema.js';

export type Database = ReturnType<typeof createDatabase>;

/** Create a Drizzle client bound to the full Penpact schema. */
export function createDatabase(connectionString: string) {
  // prepare:false is required for transaction-pooling proxies (e.g. pgBouncer/Supabase).
  const client = postgres(connectionString, { prepare: false });
  return drizzle(client, { schema });
}
