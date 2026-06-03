import { type Database, documents, envelopes, fields, signers, users } from '@penpact/db';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import { generateSigningToken, sha256Hex } from '../lib/crypto.js';
import { HttpProblem } from '../lib/problem.js';
import type { EnvelopeCreateInput } from '../schemas.js';
import { requireDraftEnvelope, requireEnvelope } from './access.js';
import { sendSigningInvite } from './email.js';
import { recordEvent } from './events.js';
import { activeOrder, isActiveSigner } from './routing.js';
import { buildVoidedEvent, enqueueEnvelopeEvent } from './webhooks.js';

const CLOSED_STATUSES = new Set(['completed', 'voided', 'expired', 'declined']);

export interface RequestContext {
  ip: string | null;
  ua: string | null;
}

type EnvelopeRow = typeof envelopes.$inferSelect;
type SignerRow = typeof signers.$inferSelect;
type FieldRow = typeof fields.$inferSelect;

export interface SignerResponse {
  id: string;
  name: string;
  email: string;
  status: SignerRow['status'];
  routingOrder: number;
  signedAt: string | null;
}

export interface FieldResponse {
  id: string;
  type: FieldRow['type'];
  signerId: string | null;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  aiDetected: boolean;
  value: string | null;
  options: string[] | null;
  condition: { fieldId: string; equals: string } | null;
}

export interface EnvelopeResponse {
  id: string;
  documentName: string;
  mode: string;
  status: EnvelopeRow['status'];
  senderName: string;
  senderEmail: string;
  documentHashOriginal: string | null;
  documentHashFinal: string | null;
  hashAlgorithm: string;
  signers: SignerResponse[];
  fields: FieldResponse[];
  createdAt: string;
  sentAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export function toSignerResponse(row: SignerRow): SignerResponse {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    status: row.status,
    routingOrder: row.routingOrder,
    signedAt: iso(row.signedAt),
  };
}

export function toFieldResponse(row: FieldRow): FieldResponse {
  return {
    id: row.id,
    type: row.type,
    signerId: row.signerId,
    page: row.page,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    required: row.required,
    aiDetected: row.aiDetected,
    value: row.value,
    options: row.options ?? null,
    condition: row.condition ?? null,
  };
}

function toEnvelope(
  env: EnvelopeRow,
  signerRows: SignerRow[],
  fieldRows: FieldRow[],
): EnvelopeResponse {
  return {
    id: env.id,
    documentName: env.documentName,
    mode: env.mode,
    status: env.status,
    senderName: env.senderName,
    senderEmail: env.senderEmail,
    documentHashOriginal: env.documentHashOriginal,
    documentHashFinal: env.documentHashFinal,
    hashAlgorithm: env.hashAlgorithm,
    signers: signerRows.sort((a, b) => a.routingOrder - b.routingOrder).map(toSignerResponse),
    fields: fieldRows.map(toFieldResponse),
    createdAt: env.createdAt.toISOString(),
    sentAt: iso(env.sentAt),
    completedAt: iso(env.completedAt),
    expiresAt: iso(env.expiresAt),
  };
}

export async function createEnvelope(
  db: Database,
  userId: string,
  input: EnvelopeCreateInput,
  mode: 'live' | 'test' = 'live',
): Promise<EnvelopeResponse> {
  const userRows = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const user = userRows[0];
  if (!user) {
    throw new Error(`Authenticated user ${userId} not found`);
  }

  return db.transaction(async (tx) => {
    const insertedEnvelopes = await tx
      .insert(envelopes)
      .values({
        userId,
        documentName: input.documentName,
        mode,
        reminderIntervalHours: input.reminderEveryHours ?? null,
        senderName: user.name ?? user.email,
        senderEmail: user.email,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      })
      .returning();
    const env = insertedEnvelopes[0];
    if (!env) {
      throw new Error('Failed to create envelope');
    }

    const signerRows = await tx
      .insert(signers)
      .values(
        input.signers.map((s, index) => ({
          envelopeId: env.id,
          name: s.name,
          email: s.email,
          routingOrder: s.routingOrder ?? index + 1,
          authMethod: s.authMethod ?? ('email_link' as const),
          accessCodeHash: s.accessCode ? sha256Hex(s.accessCode) : null,
          signingToken: generateSigningToken(),
        })),
      )
      .returning();

    await recordEvent(tx, {
      envelopeId: env.id,
      type: 'envelope_created',
      actor: 'sender',
      actorId: userId,
    });

    return toEnvelope(env, signerRows, []);
  });
}

/** Lock the document, transition draft → sent, and record one email_sent event per signer. */
export async function sendEnvelope(
  db: Database,
  userId: string,
  envelopeId: string,
  ctx: RequestContext,
): Promise<EnvelopeResponse> {
  const env = await requireDraftEnvelope(db, userId, envelopeId);

  const docRows = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.envelopeId, envelopeId), eq(documents.isFinal, false)))
    .limit(1);
  if (!docRows[0]) {
    throw new HttpProblem({
      status: 409,
      title: 'Conflict',
      detail: 'Upload a document before sending.',
    });
  }

  const signerRows = await db.select().from(signers).where(eq(signers.envelopeId, envelopeId));
  const fieldRows = await db
    .select({ signerId: fields.signerId })
    .from(fields)
    .where(eq(fields.envelopeId, envelopeId));
  const signersWithFields = new Set(fieldRows.map((f) => f.signerId));
  for (const signer of signerRows) {
    if (!signersWithFields.has(signer.id)) {
      throw new HttpProblem({
        status: 422,
        title: 'Validation Error',
        detail: `Signer ${signer.email} has no fields to sign.`,
      });
    }
  }

  // Only the first routing group is invited now; later groups activate as
  // earlier signers finish (see completeSigning). Equal orders sign in parallel.
  const firstOrder = activeOrder(
    signerRows.map((s) => ({ routingOrder: s.routingOrder, status: 'pending' })),
  );
  const active = signerRows.filter((s) => s.routingOrder === firstOrder);

  await db.transaction(async (tx) => {
    await tx
      .update(envelopes)
      .set({ status: 'sent', sentAt: new Date() })
      .where(eq(envelopes.id, envelopeId));
    for (const signer of active) {
      await tx.update(signers).set({ status: 'sent' }).where(eq(signers.id, signer.id));
      await recordEvent(tx, {
        envelopeId,
        signerId: signer.id,
        type: 'email_sent',
        actor: 'system',
        ipAddress: ctx.ip,
        userAgent: ctx.ua,
      });
    }
  });

  // Deliver signing invitations (best-effort; no-op unless email is configured).
  const base = process.env.PUBLIC_BASE_URL ?? '';
  await Promise.allSettled(
    active.map((signer) =>
      sendSigningInvite({
        to: signer.email,
        signerName: signer.name,
        documentName: env.documentName,
        signUrl: `${base}/sign/${signer.signingToken}`,
      }),
    ),
  );

  const result = await getEnvelope(db, userId, envelopeId);
  if (!result) {
    throw new Error('Envelope vanished after send');
  }
  return result;
}

/** Cancel an envelope that is not already in a terminal state. */
export async function voidEnvelope(
  db: Database,
  userId: string,
  envelopeId: string,
  reason: string | undefined,
  ctx: RequestContext,
): Promise<EnvelopeResponse> {
  const env = await requireEnvelope(db, userId, envelopeId);
  if (CLOSED_STATUSES.has(env.status)) {
    throw new HttpProblem({
      status: 409,
      title: 'Conflict',
      detail: `Envelope is ${env.status} and cannot be voided.`,
    });
  }
  await db.transaction(async (tx) => {
    await tx
      .update(envelopes)
      .set({ status: 'voided', voidedAt: new Date() })
      .where(eq(envelopes.id, envelopeId));
    await recordEvent(tx, {
      envelopeId,
      type: 'voided',
      actor: 'sender',
      ipAddress: ctx.ip,
      userAgent: ctx.ua,
      metadata: { reason: reason ?? null },
    });
  });
  await enqueueEnvelopeEvent(db, userId, buildVoidedEvent(envelopeId));
  const result = await getEnvelope(db, userId, envelopeId);
  if (!result) {
    throw new Error('Envelope vanished after void');
  }
  return result;
}

/** Re-send the signing invitation to a signer whose turn has come. */
export async function resendInvite(
  db: Database,
  userId: string,
  envelopeId: string,
  signerId: string,
  ctx: RequestContext,
): Promise<void> {
  const env = await requireEnvelope(db, userId, envelopeId);
  if (!['sent', 'viewed', 'partially_signed'].includes(env.status)) {
    throw new HttpProblem({
      status: 409,
      title: 'Conflict',
      detail: 'Envelope is not awaiting signatures.',
    });
  }
  const all = await db.select().from(signers).where(eq(signers.envelopeId, envelopeId));
  const signer = all.find((s) => s.id === signerId);
  if (!signer) {
    throw new HttpProblem({ status: 404, title: 'Not Found', detail: 'Signer not found.' });
  }
  if (signer.status === 'signed' || signer.status === 'declined') {
    throw new HttpProblem({
      status: 409,
      title: 'Conflict',
      detail: 'This signer has already responded.',
    });
  }
  if (!isActiveSigner(signer, all)) {
    throw new HttpProblem({
      status: 409,
      title: 'Conflict',
      detail: 'It is not this signer’s turn yet.',
    });
  }
  await recordEvent(db, {
    envelopeId,
    signerId: signer.id,
    type: 'email_sent',
    actor: 'system',
    ipAddress: ctx.ip,
    userAgent: ctx.ua,
  });
  const base = process.env.PUBLIC_BASE_URL ?? '';
  await sendSigningInvite({
    to: signer.email,
    signerName: signer.name,
    documentName: env.documentName,
    signUrl: `${base}/sign/${signer.signingToken}`,
  });
}

export async function getEnvelope(
  db: Database,
  userId: string,
  envelopeId: string,
): Promise<EnvelopeResponse | null> {
  const envRows = await db
    .select()
    .from(envelopes)
    .where(and(eq(envelopes.id, envelopeId), eq(envelopes.userId, userId)))
    .limit(1);
  const env = envRows[0];
  if (!env) {
    return null;
  }
  const [signerRows, fieldRows] = await Promise.all([
    db.select().from(signers).where(eq(signers.envelopeId, env.id)),
    db.select().from(fields).where(eq(fields.envelopeId, env.id)),
  ]);
  return toEnvelope(env, signerRows, fieldRows);
}

export interface ListOptions {
  status?: EnvelopeRow['status'];
  cursor?: string;
  limit: number;
}

interface Cursor {
  createdAt: string;
  id: string;
}

function decodeCursor(cursor: string): Cursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof parsed?.createdAt === 'string' && typeof parsed?.id === 'string') {
      return { createdAt: parsed.createdAt, id: parsed.id };
    }
  } catch {
    // fall through
  }
  return null;
}

function encodeCursor(row: EnvelopeRow): string {
  const payload: Cursor = { createdAt: row.createdAt.toISOString(), id: row.id };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export async function listEnvelopes(
  db: Database,
  userId: string,
  options: ListOptions,
): Promise<{ data: EnvelopeResponse[]; nextCursor: string | null; hasMore: boolean }> {
  const conditions = [eq(envelopes.userId, userId)];
  if (options.status) {
    conditions.push(eq(envelopes.status, options.status));
  }
  const cursor = options.cursor ? decodeCursor(options.cursor) : null;
  if (cursor) {
    const at = new Date(cursor.createdAt);
    // Keyset on (createdAt desc, id desc).
    const keyset = or(
      lt(envelopes.createdAt, at),
      and(eq(envelopes.createdAt, at), lt(envelopes.id, cursor.id)),
    );
    if (keyset) {
      conditions.push(keyset);
    }
  }

  const rows = await db
    .select()
    .from(envelopes)
    .where(and(...conditions))
    .orderBy(desc(envelopes.createdAt), desc(envelopes.id))
    .limit(options.limit + 1);

  const hasMore = rows.length > options.limit;
  const page = hasMore ? rows.slice(0, options.limit) : rows;
  const last = page.at(-1);

  return {
    data: page.map((env) => toEnvelope(env, [], [])),
    nextCursor: hasMore && last ? encodeCursor(last) : null,
    hasMore,
  };
}
