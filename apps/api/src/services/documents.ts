import { type Database, documents, envelopes } from '@penpact/db';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';
import { sha256HexBytes } from '../lib/crypto.js';
import { HttpProblem } from '../lib/problem.js';
import type { Storage } from '../storage/index.js';
import { requireDraftEnvelope } from './access.js';

export const MAX_PDF_BYTES = 25 * 1024 * 1024;

export interface DocumentResponse {
  id: string;
  contentHash: string;
  mimeType: string;
  byteSize: number | null;
  pageCount: number | null;
  position: number;
  isFinal: boolean;
}

export async function uploadDocument(
  db: Database,
  storage: Storage,
  userId: string,
  envelopeId: string,
  bytes: Uint8Array,
): Promise<DocumentResponse> {
  await requireDraftEnvelope(db, userId, envelopeId);

  if (bytes.byteLength === 0) {
    throw new HttpProblem({
      status: 422,
      title: 'Unprocessable Entity',
      detail: 'Empty request body.',
    });
  }
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new HttpProblem({
      status: 422,
      title: 'Unprocessable Entity',
      detail: `PDF exceeds the ${Math.floor(MAX_PDF_BYTES / 1024 / 1024)} MB limit.`,
    });
  }

  let pageCount: number;
  try {
    const pdf = await PDFDocument.load(bytes);
    pageCount = pdf.getPageCount();
  } catch {
    throw new HttpProblem({
      status: 422,
      title: 'Unprocessable Entity',
      detail: 'The uploaded file is not a valid PDF.',
    });
  }
  if (pageCount < 1) {
    throw new HttpProblem({
      status: 422,
      title: 'Unprocessable Entity',
      detail: 'The PDF has no pages.',
    });
  }

  const contentHash = sha256HexBytes(bytes);

  return db.transaction(async (tx) => {
    // Append: an envelope can hold several source documents (multi-document).
    const existing = await tx
      .select({ n: count() })
      .from(documents)
      .where(and(eq(documents.envelopeId, envelopeId), eq(documents.isFinal, false)));
    const position = existing[0]?.n ?? 0;
    const storageKey = `envelopes/${envelopeId}/source-${position}.pdf`;
    await storage.put(storageKey, bytes, 'application/pdf');

    const inserted = await tx
      .insert(documents)
      .values({
        envelopeId,
        storageKey,
        contentHash,
        mimeType: 'application/pdf',
        byteSize: bytes.byteLength,
        pageCount,
        position,
        isFinal: false,
      })
      .returning();
    const doc = inserted[0];
    if (!doc) {
      throw new Error('Failed to store document');
    }
    // The "original hash" tracks the first document for the certificate/events.
    if (position === 0) {
      await tx
        .update(envelopes)
        .set({ documentHashOriginal: contentHash })
        .where(eq(envelopes.id, envelopeId));
    }
    return {
      id: doc.id,
      contentHash: doc.contentHash,
      mimeType: doc.mimeType,
      byteSize: doc.byteSize,
      pageCount: doc.pageCount,
      position: doc.position,
      isFinal: doc.isFinal,
    };
  });
}

/** Returns the sealed final PDF if present, otherwise the current source PDF. */
export async function downloadDocument(
  db: Database,
  storage: Storage,
  userId: string,
  envelopeId: string,
): Promise<Uint8Array> {
  const ownRows = await db
    .select({ id: envelopes.id })
    .from(envelopes)
    .where(and(eq(envelopes.id, envelopeId), eq(envelopes.userId, userId)))
    .limit(1);
  if (!ownRows[0]) {
    throw new HttpProblem({ status: 404, title: 'Not Found', detail: 'Envelope not found.' });
  }

  const docRows = await db
    .select({ storageKey: documents.storageKey })
    .from(documents)
    .where(eq(documents.envelopeId, envelopeId))
    .orderBy(desc(documents.isFinal), asc(documents.position), desc(documents.createdAt))
    .limit(1);
  const doc = docRows[0];
  if (!doc) {
    throw new HttpProblem({ status: 404, title: 'Not Found', detail: 'No document uploaded yet.' });
  }
  return storage.get(doc.storageKey);
}
