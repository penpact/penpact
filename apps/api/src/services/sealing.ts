import { certificates, type Database, documents, envelopes, fields, signers } from '@penpact/db';
import { and, desc, eq } from 'drizzle-orm';
import { sha256HexBytes } from '../lib/crypto.js';
import type { Storage } from '../storage/index.js';
import { buildCertificatePayload, loadEvents } from './certificate.js';
import { buildCertificatePdf, buildFinalPdf } from './pdf.js';

/**
 * Produce the immutable final artifacts once every signer has signed:
 *  1. flatten field values into the PDF → final document, SHA-256(final), store (isFinal)
 *  2. generate the Certificate of Completion PDF + structured payload → `certificates`
 *
 * Idempotent: re-running is a no-op once a final document exists. Runs AFTER the
 * signing DB transaction commits (storage writes are not transactional).
 *
 * v1 = integrity seal (hash + lock + immutable retention). A cryptographic PAdES
 * signature (PKI) is the next increment (PLAN §7).
 */
export async function finalizeEnvelope(
  db: Database,
  storage: Storage,
  envelopeId: string,
): Promise<{ finalHash: string }> {
  const envRows = await db.select().from(envelopes).where(eq(envelopes.id, envelopeId)).limit(1);
  const env = envRows[0];
  if (!env) {
    throw new Error(`finalizeEnvelope: envelope ${envelopeId} not found`);
  }

  const existingFinal = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.envelopeId, envelopeId), eq(documents.isFinal, true)))
    .limit(1);
  if (existingFinal[0]) {
    return { finalHash: env.documentHashFinal ?? '' };
  }

  const sourceRows = await db
    .select()
    .from(documents)
    .where(and(eq(documents.envelopeId, envelopeId), eq(documents.isFinal, false)))
    .orderBy(desc(documents.createdAt))
    .limit(1);
  const source = sourceRows[0];
  if (!source) {
    throw new Error(`finalizeEnvelope: no source document for ${envelopeId}`);
  }

  const [signerRows, fieldRows, sourceBytes] = await Promise.all([
    db.select().from(signers).where(eq(signers.envelopeId, envelopeId)),
    db.select().from(fields).where(eq(fields.envelopeId, envelopeId)),
    storage.get(source.storageKey),
  ]);

  const finalBytes = await buildFinalPdf(sourceBytes, fieldRows);
  const finalHash = sha256HexBytes(finalBytes);
  const finalKey = `envelopes/${envelopeId}/final.pdf`;
  await storage.put(finalKey, finalBytes, 'application/pdf');

  const eventRows = await loadEvents(db, envelopeId);
  const payload = buildCertificatePayload(env, signerRows, eventRows, finalHash);
  const certBytes = await buildCertificatePdf(payload);
  const certKey = `envelopes/${envelopeId}/certificate.pdf`;
  await storage.put(certKey, certBytes, 'application/pdf');

  await db.transaction(async (tx) => {
    await tx.insert(documents).values({
      envelopeId,
      storageKey: finalKey,
      contentHash: finalHash,
      mimeType: 'application/pdf',
      byteSize: finalBytes.byteLength,
      pageCount: source.pageCount,
      isFinal: true,
    });
    await tx
      .update(envelopes)
      .set({ documentHashFinal: finalHash })
      .where(eq(envelopes.id, envelopeId));
    await tx
      .insert(certificates)
      .values({ envelopeId, storageKey: certKey, payload })
      .onConflictDoNothing();
  });

  return { finalHash };
}
