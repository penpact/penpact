import type { Database } from '@penpact/db';

/** Hono environment: request-scoped variables set by middleware. */
export type AppEnv = {
  Variables: {
    db: Database;
    userId: string;
    /** 'live' or 'test' — set by apiKeyAuth from the key that authenticated. */
    mode: 'live' | 'test';
    /** The organization the request is acting in (from the API key or session). */
    organizationId: string;
    /** Correlates logs + the X-Request-Id response header. */
    requestId: string;
  };
};
