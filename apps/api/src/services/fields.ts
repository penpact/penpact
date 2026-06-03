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
    .where(and(eq(documents.envelopeId, envelopeId), eq(documents.isFinal, false)));
  if (docRows.length === 0) {
    throw new HttpProblem({
      status: 409,
      title: 'Conflict',
      detail: 'Upload a document before placing fields.',
    });
  }
  const docById = new Map(docRows.map((d) => [d.id, d]));
  const soleDocId = docRows.length === 1 ? docRows[0]?.id : undefined;

  const signerRows = await db
    .select({ id: signers.id })
    .from(signers)
    .where(eq(signers.envelopeId, envelopeId));
  const signerIds = new Set(signerRows.map((s) => s.id));

  // Resolve each field's target document (explicit, or the sole document).
  const resolved = input.fields.map((field) => {
    if (!signerIds.has(field.signerId)) {
      throw new HttpProblem({
        status: 422,
        title: 'Validation Error',
        detail: `signerId ${field.signerId} is not a signer on this envelope.`,
      });
    }
    const documentId = field.documentId ?? soleDocId;
    if (!documentId) {
      throw new HttpProblem({
        status: 422,
        title: 'Validation Error',
        detail: 'This envelope has multiple documents; specify documentId for each field.',
      });
    }
    const doc = docById.get(documentId);
    if (!doc) {
      throw new HttpProblem({
        status: 422,
        title: 'Validation Error',
        detail: `documentId ${documentId} is not a document on this envelope.`,
      });
    }
    if (doc.pageCount !== null && field.page > doc.pageCount) {
      throw new HttpProblem({
        status: 422,
        title: 'Validation Error',
        detail: `page ${field.page} exceeds the document's ${doc.pageCount} page(s).`,
      });
    }
    return { field, documentId };
  });

  const inserted = await db
    .insert(fields)
    .values(
      resolved.map(({ field, documentId }) => ({
        envelopeId,
        documentId,
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
