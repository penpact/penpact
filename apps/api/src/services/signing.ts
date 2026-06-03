import { type Database, documents, envelopes, fields, signers } from '@penpact/db';
import { and, desc, eq } from 'drizzle-orm';
import { CONSENT_DISCLOSURE } from '../consent.js';
import { HttpProblem } from '../lib/problem.js';
import type { CompleteInput, DeclineInput } from '../schemas.js';
import type { Storage } from '../storage/index.js';
import { sendSigningInvite } from './email.js';
import {
  type FieldResponse,
  type RequestContext,
  type SignerResponse,
  toFieldResponse,
  toSignerResponse,
} from './envelopes.js';
import { recordEvent } from './events.js';
import { activeOrder, isActiveSigner } from './routing.js';
import { finalizeEnvelope } from './sealing.js';
import { buildCompletedEvent, buildDeclinedEvent, enqueueEnvelopeEvent } from './webhooks.js';

type SignerRow = typeof signers.$inferSelect;
type EnvelopeRow = typeof envelopes.$inferSelect;

export interface SigningSession {
  envelopeId: string;
  documentName: string;
  signer: SignerResponse;
  documentUrl: string;
  fields: FieldResponse[];
  consentRequired: boolean;
  consentDisclosure: { version: string; text: string; hash: string } | null;
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

  const fieldRows = await db
    .select()
    .from(fields)
    .where(and(eq(fields.envelopeId, envelope.id), eq(fields.signerId, signer.id)));
  const base = process.env.PUBLIC_BASE_URL ?? '';

  return {
    envelopeId: envelope.id,
    documentName: envelope.documentName,
    signer: toSignerResponse(current),
    documentUrl: `${base}/v1/sign/${token}/document`,
    fields: fieldRows.map(toFieldResponse),
    consentRequired: !current.consentGiven,
    consentDisclosure: current.consentGiven
      ? null
      : {
          version: CONSENT_DISCLOSURE.version,
          text: CONSENT_DISCLOSURE.text,
          hash: CONSENT_DISCLOSURE.hash,
        },
  };
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
    if (field.required && !provided.has(field.id)) {
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
    await enqueueEnvelopeEvent(db, envelope.userId, buildCompletedEvent(envelope.id, finalHash));
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

  await enqueueEnvelopeEvent(db, envelope.userId, buildDeclinedEvent(envelope.id));

  return reloadSigner(db, signer.id);
}

export async function getSignerDocument(
  db: Database,
  storage: Storage,
  token: string,
): Promise<Uint8Array> {
  const { envelope } = await loadByToken(db, token);
  const docRows = await db
    .select({ storageKey: documents.storageKey })
    .from(documents)
    .where(eq(documents.envelopeId, envelope.id))
    .orderBy(desc(documents.isFinal), desc(documents.createdAt))
    .limit(1);
  const doc = docRows[0];
  if (!doc) {
    throw new HttpProblem({ status: 404, title: 'Not Found', detail: 'No document available.' });
  }
  return storage.get(doc.storageKey);
}

async function reloadSigner(db: Database, signerId: string): Promise<SignerResponse> {
  const rows = await db.select().from(signers).where(eq(signers.id, signerId)).limit(1);
  const row = rows[0];
  if (!row) {
    throw new Error('Signer vanished');
  }
  return toSignerResponse(row);
}
