import type { Database } from '@penpact/db';

/** Hono environment: request-scoped variables set by middleware. */
export type AppEnv = {
  Variables: {
    db: Database;
    userId: string;
  };
};
