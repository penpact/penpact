import type { Database } from '@penpact/db';

/** Hono environment: request-scoped variables set by middleware. */
export type AppEnv = {
  Variables: {
    db: Database;
    userId: string;
    /** 'live' or 'test' — set by apiKeyAuth from the key that authenticated. */
    mode: 'live' | 'test';
    /** Correlates logs + the X-Request-Id response header. */
    requestId: string;
  };
};
