import { type Database, envelopes } from '@penpact/db';
import { and, eq, inArray } from 'drizzle-orm';
import { HttpProblem } from '../lib/problem.js';
import { accessibleOrgIds } from './organizations.js';

type EnvelopeRow = typeof envelopes.$inferSelect;

/** Load an envelope in one of the caller's organizations, or throw 404. */
export async function requireEnvelope(
  db: Database,
  userId: string,
  envelopeId: string,
): Promise<EnvelopeRow> {
  const orgIds = await accessibleOrgIds(db, userId);
  const rows =
    orgIds.length === 0
      ? []
      : await db
          .select()
          .from(envelopes)
          .where(and(eq(envelopes.id, envelopeId), inArray(envelopes.organizationId, orgIds)))
          .limit(1);
  const env = rows[0];
  if (!env) {
    throw new HttpProblem({ status: 404, title: 'Not Found', detail: 'Envelope not found.' });
  }
  return env;
}

/** Like {@link requireEnvelope}, but also requires `draft` status (else 409). */
export async function requireDraftEnvelope(
  db: Database,
  userId: string,
  envelopeId: string,
): Promise<EnvelopeRow> {
  const env = await requireEnvelope(db, userId, envelopeId);
  if (env.status !== 'draft') {
    throw new HttpProblem({
      status: 409,
      title: 'Conflict',
      detail: `This operation requires a draft envelope (current status: ${env.status}).`,
    });
  }
  return env;
}
