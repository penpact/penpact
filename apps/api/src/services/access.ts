import { type Database, envelopes } from '@penpact/db';
import { and, eq } from 'drizzle-orm';
import { HttpProblem } from '../lib/problem.js';

type EnvelopeRow = typeof envelopes.$inferSelect;

/** Load an envelope owned by the caller, or throw 404. */
export async function requireEnvelope(
  db: Database,
  userId: string,
  envelopeId: string,
): Promise<EnvelopeRow> {
  const rows = await db
    .select()
    .from(envelopes)
    .where(and(eq(envelopes.id, envelopeId), eq(envelopes.userId, userId)))
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
