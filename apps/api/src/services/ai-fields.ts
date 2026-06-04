import Anthropic from '@anthropic-ai/sdk';
import { FIELD_TYPES, type FieldType } from '@penpact/core';
import { type Database, documents, signers } from '@penpact/db';
import { and, asc, eq } from 'drizzle-orm';
import { logger } from '../lib/logger.js';
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

export type AiProvider = 'anthropic' | 'gemini' | 'openai';

/**
 * Which AI provider to use for field detection. Honors an explicit `AI_PROVIDER`
 * when that provider's key is set; otherwise picks the first configured one
 * (Anthropic -> Gemini -> OpenAI). Returns null when no key is set.
 */
export function selectedAiProvider(): AiProvider | null {
  const keys: Record<AiProvider, string | undefined> = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY,
    openai: process.env.OPENAI_API_KEY,
  };
  const explicit = process.env.AI_PROVIDER?.toLowerCase() as AiProvider | undefined;
  if (explicit && keys[explicit]) return explicit;
  if (keys.anthropic) return 'anthropic';
  if (keys.gemini) return 'gemini';
  if (keys.openai) return 'openai';
  return null;
}

function pdfBase64(pdfBytes: Uint8Array): string {
  return Buffer.from(pdfBytes).toString('base64');
}

/** Claude (Anthropic) — native PDF document input. */
async function callAnthropic(pdfBytes: Uint8Array): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: process.env.PENPACT_AI_MODEL ?? 'claude-opus-4-8',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64(pdfBytes) },
          },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
  });
  let text = '';
  for (const block of response.content) {
    if (block.type === 'text') text += block.text;
  }
  return text;
}

/** Gemini (Google) — native PDF via inlineData. Raw REST, no extra SDK dependency. */
export async function callGemini(pdfBytes: Uint8Array, fetchImpl: typeof fetch): Promise<string> {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const model = process.env.PENPACT_GEMINI_MODEL ?? 'gemini-2.5-flash';
  const res = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inlineData: { mimeType: 'application/pdf', data: pdfBase64(pdfBytes) } },
              { text: PROMPT },
            ],
          },
        ],
        // thinkingBudget 0 disables 2.5-flash's internal reasoning (not needed
        // for structured extraction) so the full JSON array isn't truncated by
        // thinking tokens; a larger output budget covers many-signature contracts.
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini API error ${res.status}`);
  const j = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
}

/** OpenAI (ChatGPT) — PDF file input on chat completions. Raw REST, no extra SDK dependency. */
export async function callOpenAI(pdfBytes: Uint8Array, fetchImpl: typeof fetch): Promise<string> {
  const model = process.env.PENPACT_OPENAI_MODEL ?? 'gpt-4o';
  const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: 'document.pdf',
                file_data: `data:application/pdf;base64,${pdfBase64(pdfBytes)}`,
              },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API error ${res.status}`);
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return j.choices?.[0]?.message?.content ?? '';
}

export interface ProposeDeps {
  fetch?: typeof fetch;
}

/**
 * Propose e-signature fields for a PDF using the configured AI provider
 * (Claude, Gemini, or ChatGPT). Returns [] when no provider is configured and
 * degrades gracefully on any provider error.
 */
export async function proposeFields(
  pdfBytes: Uint8Array,
  signerIds: string[],
  deps: ProposeDeps = {},
): Promise<FieldProposal[]> {
  if (signerIds.length === 0) return [];
  const provider = selectedAiProvider();
  if (!provider) return [];
  const fetchImpl = deps.fetch ?? (globalThis.fetch as typeof fetch);
  try {
    const text =
      provider === 'anthropic'
        ? await callAnthropic(pdfBytes)
        : provider === 'gemini'
          ? await callGemini(pdfBytes, fetchImpl)
          : await callOpenAI(pdfBytes, fetchImpl);
    return extractProposals(text, signerIds);
  } catch (err) {
    logger.error('AI field detection failed', { provider, err: String(err) });
    return [];
  }
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
