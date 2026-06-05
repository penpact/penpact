import { randomInt } from 'node:crypto';
import {
  attachments,
  type Database,
  documents,
  envelopes,
  fields,
  organizations,
  signers,
  users,
} from '@penpact/db';
import { and, asc, desc, eq } from 'drizzle-orm';
import { CONSENT_DISCLOSURE } from '../consent.js';
import { generateSigningToken, sha256Hex } from '../lib/crypto.js';
import { planLimits } from '../lib/plans.js';
import { HttpProblem } from '../lib/problem.js';
import type { AttachmentInput, CompleteInput, DeclineInput, ReassignInput } from '../schemas.js';
import type { Storage } from '../storage/index.js';
import { buildOtpEmail, sendEmail, sendSigningInvite } from './email.js';
import {
  type FieldResponse,
  type RequestContext,
  type SignerResponse,
  toFieldResponse,
  toSignerResponse,
} from './envelopes.js';
import { recordEvent } from './events.js';
import { buildMergedFinalPdf } from './pdf.js';
import { activeOrder, isActiveSigner } from './routing.js';
import { finalizeEnvelope } from './sealing.js';
import { buildCompletedEvent, buildDeclinedEvent, enqueueEnvelopeEvent } from './webhooks.js';

type SignerRow = typeof signers.$inferSelect;
type EnvelopeRow = typeof envelopes.$inferSelect;

export interface SigningSession {
  envelopeId: string;
  documentName: string;
  signer: SignerResponse;
  /** First document's URL (back-compat); prefer `documents` for multi-document. */
  documentUrl: string;
  documents: Array<{ id: string; documentUrl: string; pageCount: number | null }>;
  fields: FieldResponse[];
  consentRequired: boolean;
  consentDisclosure: { version: string; text: string; hash: string } | null;
  /** When set, the signer must pass this challenge before the document is shown. */
  authRequired?: StepUpMethod;
  /** The sending account's white-label branding, applied to the signing UI. */
  branding: {
    name: string | null;
    color: string | null;
    logoUrl: string | null;
    /** Show the "Secured by Penpact" attribution (true on free plans). */
    attribution: boolean;
  };
  /** Signer-facing language (en, es, fr, de). */
  locale: string;
}

const CLOSED_ENVELOPE_STATUSES = new Set(['completed', 'voided', 'expired', 'declined']);

function envelopeClosed(env: EnvelopeRow): boolean {
  return CLOSED_ENVELOPE_STATUSES.has(env.status);
}

function signerDone(signer: SignerRow): boolean {
  return signer.status === 'signed' || signer.status === 'declined';
}

async function loadByToken(
  db: Database,
  token: string,
): Promise<{ signer: SignerRow; envelope: EnvelopeRow }> {
  const signerRows = await db
    .select()
    .from(signers)
    .where(eq(signers.signingToken, token))
    .limit(1);
  const signer = signerRows[0];
  if (!signer) {
    throw new HttpProblem({ status: 404, title: 'Not Found', detail: 'Signing link not found.' });
  }
  const envRows = await db
    .select()
    .from(envelopes)
    .where(eq(envelopes.id, signer.envelopeId))
    .limit(1);
  let envelope = envRows[0];
  if (!envelope) {
    throw new HttpProblem({ status: 404, title: 'Not Found', detail: 'Signing link not found.' });
  }
  // Lazily expire: no cron needed — the first access past expiry flips the state.
  if (
    envelope.expiresAt &&
    envelope.expiresAt.getTime() < Date.now() &&
    !CLOSED_ENVELOPE_STATUSES.has(envelope.status)
  ) {
    await db.update(envelopes).set({ status: 'expired' }).where(eq(envelopes.id, envelope.id));
    envelope = { ...envelope, status: 'expired' };
  }
  return { signer, envelope };
}

/** Throw 409 if an earlier routing-order signer has not finished yet. */
async function requireSignerTurn(db: Database, signer: SignerRow): Promise<void> {
  const all = await db
    .select({ routingOrder: signers.routingOrder, status: signers.status })
    .from(signers)
    .where(eq(signers.envelopeId, signer.envelopeId));
  if (!isActiveSigner(signer, all)) {
    throw new HttpProblem({
      status: 409,
      title: 'Conflict',
      detail: 'Waiting for an earlier signer to finish.',
    });
  }
}

function gone(): never {
  throw new HttpProblem({
    status: 410,
    title: 'Gone',
    detail: 'This signing session is no longer available.',
  });
}

// ─── step-up signer authentication (access code / email OTP) ───
const STEP_UP_METHODS = new Set<string>(['access_code', 'email_otp']);
const OTP_TTL_MS = 10 * 60_000;
const MAX_OTP_ATTEMPTS = 5;

type StepUpMethod = 'access_code' | 'email_otp';

function stepUpMethod(signer: SignerRow): StepUpMethod | null {
  return STEP_UP_METHODS.has(signer.authMethod) ? (signer.authMethod as StepUpMethod) : null;
}

/** Block document access / signing until the step-up challenge has been passed. */
function requireAuthPassed(signer: SignerRow): void {
  if (stepUpMethod(signer) && !signer.authPassedAt) {
    throw new HttpProblem({
      status: 401,
      title: 'Unauthorized',
      detail: 'Identity verification is required before continuing.',
    });
  }
}

function randomOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Issue a fresh email OTP if none is currently valid, and email it (best-effort). */
async function ensureOtpIssued(db: Database, signer: SignerRow, locale: string): Promise<void> {
  if (signer.otpHash && signer.otpExpiresAt && signer.otpExpiresAt.getTime() > Date.now()) {
    return;
  }
  const code = randomOtp();
  await db
    .update(signers)
    .set({
      otpHash: sha256Hex(code),
      otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
      otpAttempts: 0,
    })
    .where(eq(signers.id, signer.id));
  await sendEmail(buildOtpEmail({ to: signer.email, name: signer.name, code, locale }));
}

/**
 * Verify a step-up challenge for the signer. Idempotent: a no-op if the signer
 * needs no step-up or has already passed. Throws 401 on a wrong/expired code.
 */
export async function authenticateSigner(
  db: Database,
  token: string,
  code: string,
  ctx: RequestContext,
): Promise<void> {
  const { signer, envelope } = await loadByToken(db, token);
  if (envelopeClosed(envelope)) {
    gone();
  }
  const method = stepUpMethod(signer);
  if (!method || signer.authPassedAt) {
    return;
  }

  let ok = false;
  if (method === 'access_code') {
    ok = !!signer.accessCodeHash && sha256Hex(code) === signer.accessCodeHash;
  } else {
    const live =
      !!signer.otpHash && !!signer.otpExpiresAt && signer.otpExpiresAt.getTime() > Date.now();
    ok = live && signer.otpAttempts < MAX_OTP_ATTEMPTS && sha256Hex(code) === signer.otpHash;
  }

  if (!ok) {
    if (method === 'email_otp') {
      await db
        .update(signers)
        .set({ otpAttempts: signer.otpAttempts + 1 })
        .where(eq(signers.id, signer.id));
    }
    throw new HttpProblem({
      status: 401,
      title: 'Unauthorized',
      detail: 'That code is incorrect or has expired.',
    });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(signers)
      .set({ authPassedAt: new Date(), otpHash: null, otpExpiresAt: null })
      .where(eq(signers.id, signer.id));
    await recordEvent(tx, {
      envelopeId: envelope.id,
      signerId: signer.id,
      type: 'authentication_passed',
      actor: 'signer',
      actorId: signer.id,
      ipAddress: ctx.ip,
      userAgent: ctx.ua,
      metadata: { method },
    });
  });
}

export async function getSigningSession(
  db: Database,
  token: string,
  ctx: RequestContext,
): Promise<SigningSession> {
  const { signer, envelope } = await loadByToken(db, token);
  if (envelopeClosed(envelope) || signerDone(signer)) {
    gone();
  }
  await requireSignerTurn(db, signer);

  const branding = await loadBranding(db, envelope.userId, envelope.organizationId);

  // Step-up auth gate: withhold the document until the challenge is passed.
  const method = stepUpMethod(signer);
  if (method && !signer.authPassedAt) {
    if (method === 'email_otp') {
      await ensureOtpIssued(db, signer, envelope.locale);
    }
    return {
      envelopeId: envelope.id,
      documentName: envelope.documentName,
      signer: toSignerResponse(signer),
      documentUrl: '',
      documents: [],
      fields: [],
      consentRequired: false,
      consentDisclosure: null,
      authRequired: method,
      branding,
      locale: envelope.locale,
    };
  }

  let current = signer;
  if (!signer.viewedAt) {
    const viewedAt = new Date();
    const nextStatus = signer.status === 'sent' ? ('viewed' as const) : signer.status;
    await db.transaction(async (tx) => {
      await tx
        .update(signers)
        .set({ status: nextStatus, viewedAt })
        .where(eq(signers.id, signer.id));
      if (envelope.status === 'sent') {
        await tx.update(envelopes).set({ status: 'viewed' }).where(eq(envelopes.id, envelope.id));
      }
      await recordEvent(tx, {
        envelopeId: envelope.id,
        signerId: signer.id,
        type: 'document_viewed',
        actor: 'signer',
        actorId: signer.id,
        ipAddress: ctx.ip,
        userAgent: ctx.ua,
        docHashAtEvent: envelope.documentHashOriginal,
      });
    });
    current = { ...signer, status: nextStatus, viewedAt };
  }

  const [fieldRows, docRows] = await Promise.all([
    db
      .select()
      .from(fields)
      .where(and(eq(fields.envelopeId, envelope.id), eq(fields.signerId, signer.id))),
    db
      .select({ id: documents.id, pageCount: documents.pageCount })
      .from(documents)
      .where(and(eq(documents.envelopeId, envelope.id), eq(documents.isFinal, false)))
      .orderBy(asc(documents.position)),
  ]);
  const base = process.env.PUBLIC_BASE_URL ?? '';
  const documentList = docRows.map((d) => ({
    id: d.id,
    documentUrl: `${base}/v1/sign/${token}/document?documentId=${d.id}`,
    pageCount: d.pageCount,
  }));

  return {
    envelopeId: envelope.id,
    documentName: envelope.documentName,
    signer: toSignerResponse(current),
    documentUrl: documentList[0]?.documentUrl ?? `${base}/v1/sign/${token}/document`,
    documents: documentList,
    fields: fieldRows.map(toFieldResponse),
    consentRequired: !current.consentGiven,
    consentDisclosure: current.consentGiven
      ? null
      : {
          version: CONSENT_DISCLOSURE.version,
          text: CONSENT_DISCLOSURE.text,
          hash: CONSENT_DISCLOSURE.hash,
        },
    branding,
    locale: envelope.locale,
  };
}

/**
 * The sending account's white-label branding for the signing UI. Name/color/logo
 * are free on every plan; the "Secured by Penpact" attribution is shown unless
 * the owning org is on a paid plan (resolved from the envelope's organization).
 */
async function loadBranding(
  db: Database,
  userId: string,
  organizationId: string | null,
): Promise<SigningSession['branding']> {
  const rows = await db
    .select({ name: users.brandName, color: users.brandColor, logoUrl: users.brandLogoUrl })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const brand = rows[0] ?? { name: null, color: null, logoUrl: null };

  let attribution = true;
  if (organizationId) {
    const org = await db
      .select({ plan: organizations.plan })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    attribution = planLimits(org[0]?.plan).attribution;
  }
  return { ...brand, attribution };
}

export async function acceptConsent(
  db: Database,
  token: string,
  disclosureHash: string,
  ctx: RequestContext,
): Promise<void> {
  const { signer, envelope } = await loadByToken(db, token);
  if (envelopeClosed(envelope)) {
    gone();
  }
  if (signerDone(signer)) {
    throw new HttpProblem({
      status: 409,
      title: 'Conflict',
      detail: 'You have already responded.',
    });
  }
  await requireSignerTurn(db, signer);
  requireAuthPassed(signer);
  if (disclosureHash !== CONSENT_DISCLOSURE.hash) {
    throw new HttpProblem({
      status: 422,
      title: 'Validation Error',
      detail: 'Stale consent disclosure — reload the session and try again.',
    });
  }

  await db.transaction(async (tx) => {
    await tx
      .update(signers)
      .set({
        consentGiven: true,
        consentTimestamp: new Date(),
        consentDisclosureHash: CONSENT_DISCLOSURE.hash,
      })
      .where(eq(signers.id, signer.id));
    await recordEvent(tx, {
      envelopeId: envelope.id,
      signerId: signer.id,
      type: 'consent_disclosure_shown',
      actor: 'signer',
      actorId: signer.id,
      ipAddress: ctx.ip,
      userAgent: ctx.ua,
      metadata: { version: CONSENT_DISCLOSURE.version, hash: CONSENT_DISCLOSURE.hash },
    });
    await recordEvent(tx, {
      envelopeId: envelope.id,
      signerId: signer.id,
      type: 'consent_accepted',
      actor: 'signer',
      actorId: signer.id,
      ipAddress: ctx.ip,
      userAgent: ctx.ua,
      metadata: { hash: CONSENT_DISCLOSURE.hash },
    });
  });
}

/**
 * Store a file a signer uploaded against one of their `attachment` fields. The
 * file is appended to the sealed packet at completion. Re-uploading the same
 * field overwrites the previous file (one attachment per field per signer).
 */
export async function uploadAttachment(
  db: Database,
  storage: Storage,
  token: string,
  input: AttachmentInput,
  ctx: RequestContext,
): Promise<{ id: string; filename: string }> {
  const { signer, envelope } = await loadByToken(db, token);
  if (envelopeClosed(envelope)) gone();
  requireAuthPassed(signer);

  const [field] = await db
    .select()
    .from(fields)
    .where(and(eq(fields.id, input.fieldId), eq(fields.envelopeId, envelope.id)))
    .limit(1);
  if (!field || field.signerId !== signer.id || field.type !== 'attachment') {
    throw new HttpProblem({
      status: 422,
      title: 'Validation Error',
      detail: 'That attachment field is not assigned to you.',
    });
  }

  const comma = input.data.indexOf(',');
  const b64 =
    input.data.startsWith('data:') && comma >= 0 ? input.data.slice(comma + 1) : input.data;
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(Buffer.from(b64, 'base64'));
  } catch {
    throw new HttpProblem({ status: 422, title: 'Validation Error', detail: 'Invalid file data.' });
  }
  const MAX_BYTES = 10 * 1024 * 1024;
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    throw new HttpProblem({
      status: 422,
      title: 'Validation Error',
      detail: 'The file is empty or larger than 10 MB.',
    });
  }

  const storageKey = `envelopes/${envelope.id}/attachments/${field.id}-${signer.id}`;
  await storage.put(storageKey, bytes, input.contentType);
  // One attachment per (field, signer): replace any prior row.
  await db
    .delete(attachments)
    .where(
      and(
        eq(attachments.envelopeId, envelope.id),
        eq(attachments.fieldId, field.id),
        eq(attachments.signerId, signer.id),
      ),
    );
  const [row] = await db
    .insert(attachments)
    .values({
      envelopeId: envelope.id,
      signerId: signer.id,
      fieldId: field.id,
      filename: input.filename,
      contentType: input.contentType,
      storageKey,
      byteSize: bytes.length,
    })
    .returning({ id: attachments.id, filename: attachments.filename });
  if (!row) {
    throw new HttpProblem({
      status: 500,
      title: 'Internal Server Error',
      detail: 'Could not store the attachment.',
    });
  }
  await recordEvent(db, {
    envelopeId: envelope.id,
    signerId: signer.id,
    type: 'field_completed',
    actor: 'signer',
    actorId: signer.id,
    ipAddress: ctx.ip,
    userAgent: ctx.ua,
    metadata: { fieldId: field.id, attachment: input.filename, byteSize: bytes.length },
  });
  return { id: row.id, filename: row.filename };
}

/**
 * Reassign (delegate) this signing slot to a different person. The signer who
 * received the document says "this is not for me" and forwards it. The original
 * link is invalidated (a new token is minted), consent/auth state is reset, and
 * the new signer is emailed. Field placements (bound to the signer row) carry
 * over unchanged.
 */
export async function reassignSigner(
  db: Database,
  token: string,
  input: ReassignInput,
  ctx: RequestContext,
): Promise<{ name: string; email: string }> {
  const { signer, envelope } = await loadByToken(db, token);
  if (envelopeClosed(envelope)) gone();
  if (signerDone(signer)) {
    throw new HttpProblem({
      status: 409,
      title: 'Conflict',
      detail: 'You have already responded to this document.',
    });
  }

  const newToken = generateSigningToken();
  await db
    .update(signers)
    .set({
      name: input.name,
      email: input.email,
      signingToken: newToken,
      status: 'pending',
      consentGiven: false,
      authPassedAt: null,
      otpHash: null,
      otpExpiresAt: null,
      otpAttempts: 0,
    })
    .where(eq(signers.id, signer.id));

  await recordEvent(db, {
    envelopeId: envelope.id,
    signerId: signer.id,
    type: 'reassigned',
    actor: 'signer',
    actorId: signer.id,
    ipAddress: ctx.ip,
    userAgent: ctx.ua,
    metadata: {
      fromName: signer.name,
      fromEmail: signer.email,
      toName: input.name,
      toEmail: input.email,
      reason: input.reason ?? null,
    },
  });

  const base = process.env.PUBLIC_BASE_URL ?? '';
  await sendSigningInvite({
    to: input.email,
    signerName: input.name,
    documentName: envelope.documentName,
    signUrl: `${base}/sign/${newToken}`,
    locale: envelope.locale,
  });

  return { name: input.name, email: input.email };
}

export async function completeSigning(
  db: Database,
  storage: Storage,
  token: string,
  input: CompleteInput,
  ctx: RequestContext,
): Promise<SignerResponse> {
  const { signer, envelope } = await loadByToken(db, token);
  if (envelopeClosed(envelope)) {
    gone();
  }
  if (signerDone(signer)) {
    throw new HttpProblem({
      status: 409,
      title: 'Conflict',
      detail: 'You have already responded to this document.',
    });
  }
  await requireSignerTurn(db, signer);
  requireAuthPassed(signer);
  if (!signer.consentGiven) {
    throw new HttpProblem({
      status: 422,
      title: 'Validation Error',
      detail: 'Consent is required before signing.',
    });
  }

  const myFields = await db
    .select()
    .from(fields)
    .where(and(eq(fields.envelopeId, envelope.id), eq(fields.signerId, signer.id)));
  const provided = new Map(input.fields.map((f) => [f.fieldId, f.value]));
  const myFieldIds = new Set(myFields.map((f) => f.id));
  for (const fieldId of provided.keys()) {
    if (!myFieldIds.has(fieldId)) {
      throw new HttpProblem({
        status: 422,
        title: 'Validation Error',
        detail: `Field ${fieldId} is not assigned to you.`,
      });
    }
  }
  for (const field of myFields) {
    // A conditional field is only required when its controlling field matches.
    const cond = field.condition as { fieldId: string; equals: string } | null;
    const applies = !cond || provided.get(cond.fieldId) === cond.equals;
    if (field.required && applies && !provided.has(field.id)) {
      throw new HttpProblem({
        status: 422,
        title: 'Validation Error',
        detail: `Required field ${field.id} is missing.`,
      });
    }
  }

  const now = new Date();
  let envelopeCompleted = false;
  const newlyActivated: Array<{ name: string; email: string; signingToken: string }> = [];
  await db.transaction(async (tx) => {
    for (const field of myFields) {
      const value = provided.get(field.id);
      if (value !== undefined) {
        await tx.update(fields).set({ value, completedAt: now }).where(eq(fields.id, field.id));
        await recordEvent(tx, {
          envelopeId: envelope.id,
          signerId: signer.id,
          type: 'field_completed',
          actor: 'signer',
          actorId: signer.id,
          ipAddress: ctx.ip,
          userAgent: ctx.ua,
          metadata: { fieldId: field.id },
        });
      }
    }
    await tx
      .update(signers)
      .set({
        status: 'signed',
        signedAt: now,
        signatureType: input.signatureType,
        ipAddress: ctx.ip,
        userAgent: ctx.ua,
      })
      .where(eq(signers.id, signer.id));
    await recordEvent(tx, {
      envelopeId: envelope.id,
      signerId: signer.id,
      type: 'authentication_passed',
      actor: 'signer',
      actorId: signer.id,
      ipAddress: ctx.ip,
      userAgent: ctx.ua,
      metadata: { method: signer.authMethod },
    });
    await recordEvent(tx, {
      envelopeId: envelope.id,
      signerId: signer.id,
      type: 'signed',
      actor: 'signer',
      actorId: signer.id,
      ipAddress: ctx.ip,
      userAgent: ctx.ua,
      docHashAtEvent: envelope.documentHashOriginal,
    });

    const all = await tx
      .select({
        id: signers.id,
        name: signers.name,
        email: signers.email,
        status: signers.status,
        routingOrder: signers.routingOrder,
        signingToken: signers.signingToken,
      })
      .from(signers)
      .where(eq(signers.envelopeId, envelope.id));
    if (all.every((s) => s.status === 'signed')) {
      await tx
        .update(envelopes)
        .set({ status: 'completed', completedAt: now })
        .where(eq(envelopes.id, envelope.id));
      await recordEvent(tx, { envelopeId: envelope.id, type: 'completed', actor: 'system' });
      envelopeCompleted = true;
    } else {
      await tx
        .update(envelopes)
        .set({ status: 'partially_signed' })
        .where(eq(envelopes.id, envelope.id));
      // Advance the chain: invite the next routing group once this one is done.
      const order = activeOrder(all);
      for (const s of all) {
        if (s.status === 'pending' && s.routingOrder === order) {
          await tx.update(signers).set({ status: 'sent' }).where(eq(signers.id, s.id));
          await recordEvent(tx, {
            envelopeId: envelope.id,
            signerId: s.id,
            type: 'email_sent',
            actor: 'system',
          });
          newlyActivated.push({ name: s.name, email: s.email, signingToken: s.signingToken });
        }
      }
    }
  });

  if (envelopeCompleted) {
    const { finalHash } = await finalizeEnvelope(db, storage, envelope.id);
    await enqueueEnvelopeEvent(
      db,
      envelope.organizationId,
      buildCompletedEvent(envelope.id, finalHash),
    );
  } else if (newlyActivated.length > 0) {
    // Invite the freshly-activated next routing group (best-effort).
    const base = process.env.PUBLIC_BASE_URL ?? '';
    await Promise.allSettled(
      newlyActivated.map((s) =>
        sendSigningInvite({
          to: s.email,
          signerName: s.name,
          documentName: envelope.documentName,
          signUrl: `${base}/sign/${s.signingToken}`,
          locale: envelope.locale,
        }),
      ),
    );
  }

  return reloadSigner(db, signer.id);
}

export async function declineSigning(
  db: Database,
  token: string,
  input: DeclineInput,
  ctx: RequestContext,
): Promise<SignerResponse> {
  const { signer, envelope } = await loadByToken(db, token);
  if (envelopeClosed(envelope)) {
    gone();
  }
  if (signerDone(signer)) {
    throw new HttpProblem({
      status: 409,
      title: 'Conflict',
      detail: 'You have already responded.',
    });
  }
  await requireSignerTurn(db, signer);

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(signers)
      .set({ status: 'declined', declinedAt: now, ipAddress: ctx.ip, userAgent: ctx.ua })
      .where(eq(signers.id, signer.id));
    await tx.update(envelopes).set({ status: 'declined' }).where(eq(envelopes.id, envelope.id));
    await recordEvent(tx, {
      envelopeId: envelope.id,
      signerId: signer.id,
      type: 'declined',
      actor: 'signer',
      actorId: signer.id,
      ipAddress: ctx.ip,
      userAgent: ctx.ua,
      metadata: { reason: input.reason ?? null },
    });
  });

  await enqueueEnvelopeEvent(db, envelope.organizationId, buildDeclinedEvent(envelope.id));

  return reloadSigner(db, signer.id);
}

export async function getSignerDocument(
  db: Database,
  storage: Storage,
  token: string,
  documentId?: string,
): Promise<Uint8Array> {
  const { signer, envelope } = await loadByToken(db, token);
  requireAuthPassed(signer);
  // A specific source document (multi-document), else the final-or-first source.
  const whereClause = documentId
    ? and(eq(documents.envelopeId, envelope.id), eq(documents.id, documentId))
    : eq(documents.envelopeId, envelope.id);
  const docRows = await db
    .select({ storageKey: documents.storageKey })
    .from(documents)
    .where(whereClause)
    .orderBy(desc(documents.isFinal), asc(documents.position), desc(documents.createdAt))
    .limit(1);
  const doc = docRows[0];
  if (!doc) {
    throw new HttpProblem({ status: 404, title: 'Not Found', detail: 'No document available.' });
  }
  return storage.get(doc.storageKey);
}

/**
 * Render a preview of the document with this signer's proposed values flattened
 * in place, using the same renderer as the final seal (no PAdES signature). Lets
 * the signer see exactly how their signature will appear before finishing —
 * server-side, so it never depends on the browser loading a PDF library.
 */
export async function previewSigning(
  db: Database,
  storage: Storage,
  token: string,
  inputValues: Array<{ fieldId: string; value: string }>,
): Promise<Uint8Array> {
  const { signer, envelope } = await loadByToken(db, token);
  requireAuthPassed(signer);

  const sourceRows = await db
    .select({ id: documents.id, storageKey: documents.storageKey })
    .from(documents)
    .where(and(eq(documents.envelopeId, envelope.id), eq(documents.isFinal, false)))
    .orderBy(asc(documents.position), asc(documents.createdAt));
  if (sourceRows.length === 0) {
    throw new HttpProblem({ status: 409, title: 'Conflict', detail: 'No document to preview.' });
  }
  const sources = await Promise.all(
    sourceRows.map(async (s) => ({ documentId: s.id, bytes: await storage.get(s.storageKey) })),
  );

  const fieldRows = await db.select().from(fields).where(eq(fields.envelopeId, envelope.id));
  const overrides = new Map(inputValues.map((v) => [v.fieldId, v.value]));
  const mergeFields = fieldRows.map((f) => ({
    documentId: f.documentId,
    page: f.page,
    x: f.x,
    y: f.y,
    width: f.width,
    height: f.height,
    type: f.type,
    // Only the current signer may preview their own field values.
    value:
      f.signerId === signer.id && overrides.has(f.id) ? (overrides.get(f.id) ?? f.value) : f.value,
  }));

  return buildMergedFinalPdf(sources, mergeFields);
}

async function reloadSigner(db: Database, signerId: string): Promise<SignerResponse> {
  const rows = await db.select().from(signers).where(eq(signers.id, signerId)).limit(1);
  const row = rows[0];
  if (!row) {
    throw new Error('Signer vanished');
  }
  return toSignerResponse(row);
}
