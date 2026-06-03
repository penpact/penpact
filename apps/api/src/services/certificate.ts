import {
  type AuditEvent,
  type CertificateOfCompletion,
  type CertificateSigner,
  HASH_ALGORITHM,
} from '@penpact/core';
import { certificates, type Database, type envelopes, events, type signers } from '@penpact/db';
import { asc, eq } from 'drizzle-orm';
import { CONSENT_DISCLOSURE } from '../consent.js';
import { HttpProblem } from '../lib/problem.js';
import type { Storage } from '../storage/index.js';
import { requireEnvelope } from './access.js';

type EnvelopeRow = typeof envelopes.$inferSelect;
type SignerRow = typeof signers.$inferSelect;
type EventRow = typeof events.$inferSelect;

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

function toCertSigner(s: SignerRow): CertificateSigner {
  return {
    name: s.name,
    email: s.email,
    authMethod: s.authMethod,
    consentGiven: s.consentGiven,
    consentTimestamp: iso(s.consentTimestamp),
    consentDisclosureHash: s.consentDisclosureHash,
    signatureType: s.signatureType,
    ipAddress: s.ipAddress,
    geoApprox: s.geoApprox,
    userAgent: s.userAgent,
    device: s.device,
  };
}

function toAuditEvent(e: EventRow): AuditEvent {
  return {
    type: e.type,
    timestampUtc: e.timestampUtc.toISOString(),
    actor: e.actor,
    actorId: e.actorId,
    context: {
      ipAddress: e.ipAddress,
      userAgent: e.userAgent,
      geoApprox: e.geoApprox,
      device: e.device,
    },
    docHashAtEvent: e.docHashAtEvent,
  };
}

export function buildCertificatePayload(
  env: EnvelopeRow,
  signerRows: SignerRow[],
  eventRows: EventRow[],
  finalHash: string,
): CertificateOfCompletion {
  return {
    envelopeId: env.id,
    documentName: env.documentName,
    documentHashOriginal: env.documentHashOriginal ?? '',
    documentHashFinal: finalHash,
    hashAlgorithm: HASH_ALGORITHM,
    createdAt: env.createdAt.toISOString(),
    completedAt: (env.completedAt ?? new Date()).toISOString(),
    senderName: env.senderName,
    senderEmail: env.senderEmail,
    disclosureVersion: CONSENT_DISCLOSURE.version,
    disclosureHash: CONSENT_DISCLOSURE.hash,
    signers: signerRows.map(toCertSigner),
    events: eventRows.map(toAuditEvent),
  };
}

/** Download the stored Certificate of Completion PDF (owner only). */
export async function downloadCertificate(
  db: Database,
  storage: Storage,
  userId: string,
  envelopeId: string,
): Promise<Uint8Array> {
  await requireEnvelope(db, userId, envelopeId);
  const rows = await db
    .select({ storageKey: certificates.storageKey })
    .from(certificates)
    .where(eq(certificates.envelopeId, envelopeId))
    .limit(1);
  const cert = rows[0];
  if (!cert?.storageKey) {
    throw new HttpProblem({
      status: 404,
      title: 'Not Found',
      detail: 'No certificate yet — the envelope is not completed.',
    });
  }
  return storage.get(cert.storageKey);
}

/** Read all audit events for an envelope in chronological order. */
export async function loadEvents(db: Database, envelopeId: string): Promise<EventRow[]> {
  return db
    .select()
    .from(events)
    .where(eq(events.envelopeId, envelopeId))
    .orderBy(asc(events.timestampUtc));
}
