import Anthropic from '@anthropic-ai/sdk';
import { FIELD_TYPES, type FieldType } from '@penpact/core';
import { type Database, documents, signers } from '@penpact/db';
import { and, asc, eq } from 'drizzle-orm';
import { HttpProblem } from '../lib/problem.js';
import type { Storage } from '../storage/index.js';
import { requireDraftEnvelope } from './access.js';

export interface FieldProposal {
  type: FieldType;
  signerId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  aiDetected: true;
  value: null;
}

const FIELD_TYPE_SET = new Set<string>(FIELD_TYPES);

const PROMPT = `You are placing e-signature fields on a PDF. Identify where a signer must
sign, initial, type their name, type their email, or enter a date. Return ONLY a JSON array
(no prose, no code fences) of objects:
[{"type":"signature|initials|date|name|email|text|checkbox","page":1,"x":0,"y":0,"width":0,"height":0}]
Coordinates are in PDF points with the origin at the TOP-LEFT of the page. Use realistic box
sizes (e.g. a signature ~180x40). If you find nothing, return [].`;

/** Parse Claude's response text into validated field proposals (pure, testable). */
export function extractProposals(text: string, signerIds: string[]): FieldProposal[] {
  const primary = signerIds[0];
  if (!primary) {
    return [];
  }
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }

  const proposals: FieldProposal[] = [];
  for (const raw of parsed) {
    if (typeof raw !== 'object' || raw === null) {
      continue;
    }
    const item = raw as Record<string, unknown>;
    if (typeof item.type !== 'string' || !FIELD_TYPE_SET.has(item.type)) {
      continue;
    }
    const page = Number(item.page ?? 1);
    const x = Number(item.x);
    const y = Number(item.y);
    const width = Number(item.width);
    const height = Number(item.height);
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
      continue;
    }
    proposals.push({
      type: item.type as FieldType,
      signerId: primary,
      page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
      x: Math.max(0, x),
      y: Math.max(0, y),
      width,
      height,
      required: true,
      aiDetected: true,
      value: null,
    });
  }
  return proposals;
}

/** Call Claude to propose fields for a PDF. Returns [] when AI is not configured. */
export async function proposeFields(
  pdfBytes: Uint8Array,
  signerIds: string[],
): Promise<FieldProposal[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || signerIds.length === 0) {
    return [];
  }
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: process.env.PENPACT_AI_MODEL ?? 'claude-opus-4-8',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: Buffer.from(pdfBytes).toString('base64'),
            },
          },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
  });

  let text = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      text += block.text;
    }
  }
  return extractProposals(text, signerIds);
}

/** Load the envelope's source PDF + signers and return AI-proposed fields (not persisted). */
export async function autoDetectEnvelopeFields(
  db: Database,
  storage: Storage,
  userId: string,
  envelopeId: string,
): Promise<FieldProposal[]> {
  await requireDraftEnvelope(db, userId, envelopeId);

  const docRows = await db
    .select({ storageKey: documents.storageKey })
    .from(documents)
    .where(and(eq(documents.envelopeId, envelopeId), eq(documents.isFinal, false)))
    .limit(1);
  const doc = docRows[0];
  if (!doc) {
    throw new HttpProblem({
      status: 409,
      title: 'Conflict',
      detail: 'Upload a document before detecting fields.',
    });
  }

  const signerRows = await db
    .select({ id: signers.id })
    .from(signers)
    .where(eq(signers.envelopeId, envelopeId))
    .orderBy(asc(signers.routingOrder));

  const pdfBytes = await storage.get(doc.storageKey);
  return proposeFields(
    pdfBytes,
    signerRows.map((s) => s.id),
  );
}
