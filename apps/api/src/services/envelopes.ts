import { type Database, envelopes, fields, signers, users } from '@penpact/db';
import { and, desc, eq, lt, or } from 'drizzle-orm';
import { generateSigningToken } from '../lib/crypto.js';
import type { EnvelopeCreateInput } from '../schemas.js';

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
}

export interface EnvelopeResponse {
  id: string;
  documentName: string;
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

function toSigner(row: SignerRow): SignerResponse {
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
    status: env.status,
    senderName: env.senderName,
    senderEmail: env.senderEmail,
    documentHashOriginal: env.documentHashOriginal,
    documentHashFinal: env.documentHashFinal,
    hashAlgorithm: env.hashAlgorithm,
    signers: signerRows.sort((a, b) => a.routingOrder - b.routingOrder).map(toSigner),
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
          signingToken: generateSigningToken(),
        })),
      )
      .returning();

    return toEnvelope(env, signerRows, []);
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
