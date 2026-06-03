import { type Database, documents, fields, signers } from '@penpact/db';
import { and, eq } from 'drizzle-orm';
import { HttpProblem } from '../lib/problem.js';
import type { PlaceFieldsInput } from '../schemas.js';
import { requireDraftEnvelope } from './access.js';
import { type FieldResponse, toFieldResponse } from './envelopes.js';

export async function placeFields(
  db: Database,
  userId: string,
  envelopeId: string,
  input: PlaceFieldsInput,
): Promise<FieldResponse[]> {
  await requireDraftEnvelope(db, userId, envelopeId);

  const docRows = await db
    .select({ id: documents.id, pageCount: documents.pageCount })
    .from(documents)
    .where(and(eq(documents.envelopeId, envelopeId), eq(documents.isFinal, false)))
    .limit(1);
  const doc = docRows[0];
  if (!doc) {
    throw new HttpProblem({
      status: 409,
      title: 'Conflict',
      detail: 'Upload a document before placing fields.',
    });
  }

  const signerRows = await db
    .select({ id: signers.id })
    .from(signers)
    .where(eq(signers.envelopeId, envelopeId));
  const signerIds = new Set(signerRows.map((s) => s.id));

  for (const field of input.fields) {
    if (!signerIds.has(field.signerId)) {
      throw new HttpProblem({
        status: 422,
        title: 'Validation Error',
        detail: `signerId ${field.signerId} is not a signer on this envelope.`,
      });
    }
    if (doc.pageCount !== null && field.page > doc.pageCount) {
      throw new HttpProblem({
        status: 422,
        title: 'Validation Error',
        detail: `page ${field.page} exceeds the document's ${doc.pageCount} page(s).`,
      });
    }
  }

  const inserted = await db
    .insert(fields)
    .values(
      input.fields.map((field) => ({
        envelopeId,
        documentId: doc.id,
        signerId: field.signerId,
        type: field.type,
        page: field.page,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        required: field.required ?? true,
      })),
    )
    .returning();

  return inserted.map(toFieldResponse);
}
