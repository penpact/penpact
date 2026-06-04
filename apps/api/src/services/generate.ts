/**
 * Generate an envelope from a text/markdown template with {{variable}} merge.
 * Renders the merged content to a PDF and runs it through the normal
 * create + upload flow, so signing/sealing/certificate are unchanged.
 */
import type { Database } from '@penpact/db';
import { renderTemplatePdf } from '../lib/document-template.js';
import type { GenerateDocumentInput } from '../schemas.js';
import type { Storage } from '../storage/index.js';
import { uploadDocument } from './documents.js';
import { createEnvelope, type EnvelopeResponse, getEnvelope } from './envelopes.js';

export async function generateEnvelopeFromText(
  db: Database,
  storage: Storage,
  userId: string,
  mode: 'live' | 'test',
  input: GenerateDocumentInput,
  organizationId?: string,
): Promise<EnvelopeResponse> {
  const pdf = await renderTemplatePdf(input.template, input.variables ?? {});

  const createInput: Parameters<typeof createEnvelope>[2] = {
    documentName: input.documentName,
    signers: input.signers,
  };
  if (input.expiresAt) createInput.expiresAt = input.expiresAt;
  if (input.locale) createInput.locale = input.locale;
  if (input.reminderEveryHours) createInput.reminderEveryHours = input.reminderEveryHours;

  const envelope = await createEnvelope(db, userId, createInput, mode, organizationId);
  await uploadDocument(db, storage, userId, envelope.id, pdf);
  const refreshed = await getEnvelope(db, userId, envelope.id);
  if (!refreshed) throw new Error('Envelope vanished after generation');
  return refreshed;
}
