/**
 * @penpact/core — shared domain model for the Penpact e-signature engine.
 *
 * This package is intentionally dependency-free and runtime-light: it encodes
 * the vocabulary that the API, SDK, signing UI and database all agree on.
 *
 * The compliance model (US ESIGN/UETA + EU eIDAS SES) is an EVIDENCE-CAPTURE
 * system, not a moat. Validity = the ability to PROVE intent, consent,
 * attribution and integrity. Every constant below maps to one of those four.
 */

/** Hash algorithm used for document integrity (original + final sealed PDF). */
export const HASH_ALGORITHM = 'SHA-256' as const;
export type HashAlgorithm = typeof HASH_ALGORITHM;

/** Lifecycle of an envelope (a signing request bundling a document + signers). */
export const ENVELOPE_STATUSES = [
  'draft',
  'sent',
  'viewed',
  'partially_signed',
  'completed',
  'declined',
  'voided',
  'expired',
] as const;
export type EnvelopeStatus = (typeof ENVELOPE_STATUSES)[number];

/** Per-signer progress within an envelope. */
export const SIGNER_STATUSES = ['pending', 'sent', 'viewed', 'signed', 'declined'] as const;
export type SignerStatus = (typeof SIGNER_STATUSES)[number];

/**
 * Attribution tier — how the signer was authenticated.
 * email_link/access_code = free; sms_otp/id_verification = premium (outsourced).
 */
export const AUTH_METHODS = [
  'email_link',
  'access_code',
  'email_otp',
  'sms_otp',
  'id_verification',
] as const;
export type AuthMethod = (typeof AUTH_METHODS)[number];

/** How the signature mark itself was produced. */
export const SIGNATURE_TYPES = ['drawn', 'typed', 'adopted', 'uploaded'] as const;
export type SignatureType = (typeof SIGNATURE_TYPES)[number];

/** Field kinds that can be placed on a document (manually or AI-detected). */
export const FIELD_TYPES = [
  'signature',
  'initials',
  'date',
  'name',
  'email',
  'text',
  'checkbox',
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/**
 * Append-only audit event log (§8 of the build spec). Each event is immutable
 * and carries timestamp_utc, actor, ip, user_agent and — where relevant — the
 * document hash at the time of the event. This log IS the Certificate of
 * Completion's backing evidence.
 */
export const AUDIT_EVENT_TYPES = [
  'envelope_created',
  'email_sent',
  'document_viewed',
  'consent_disclosure_shown',
  'consent_accepted',
  'authentication_passed',
  'field_completed',
  'signed',
  'declined',
  'completed',
  'copy_delivered',
  'voided',
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

/** Actor that triggered an audit event. */
export const ACTOR_TYPES = ['sender', 'signer', 'system'] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

/** Captured request context attached to evidence-bearing events. */
export interface RequestContext {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly geoApprox?: string | null;
  readonly device?: string | null;
}

/**
 * Consent disclosure (ESIGN §7001(c)) — the one place sloppy wording voids
 * consumer validity. We store the exact text shown and its hash, versioned.
 */
export interface ConsentDisclosure {
  readonly version: string;
  readonly text: string;
  /** SHA-256 of `text`. */
  readonly hash: string;
}

/** A single immutable audit-trail entry. */
export interface AuditEvent {
  readonly type: AuditEventType;
  readonly timestampUtc: string;
  readonly actor: ActorType;
  readonly actorId?: string | null;
  readonly context?: RequestContext;
  /** Document hash at the moment of the event, when meaningful. */
  readonly docHashAtEvent?: string | null;
}

/** Shape of the Certificate of Completion (de-facto DocuSign-style schema). */
export interface CertificateOfCompletion {
  readonly envelopeId: string;
  readonly documentName: string;
  readonly documentHashOriginal: string;
  readonly documentHashFinal: string;
  readonly hashAlgorithm: HashAlgorithm;
  readonly createdAt: string;
  readonly completedAt: string;
  readonly senderName: string;
  readonly senderEmail: string;
  readonly disclosureVersion: string;
  readonly disclosureHash: string;
  readonly signers: ReadonlyArray<CertificateSigner>;
  readonly events: ReadonlyArray<AuditEvent>;
}

export interface CertificateSigner {
  readonly name: string;
  readonly email: string;
  readonly authMethod: AuthMethod;
  readonly consentGiven: boolean;
  readonly consentTimestamp: string | null;
  readonly consentDisclosureHash: string | null;
  readonly signatureType: SignatureType | null;
  readonly ipAddress: string | null;
  readonly geoApprox: string | null;
  readonly userAgent: string | null;
  readonly device: string | null;
}

/**
 * Document types to AVOID in v1 — statutorily excluded or heavily regulated.
 * Surfaced here so product code can warn/refuse rather than silently accept.
 */
export const EXCLUDED_DOCUMENT_HINTS = [
  'will',
  'codicil',
  'family law',
  'court order',
  'notarization',
  'recorded deed',
  'healthcare',
  'HIPAA',
  'I-9',
] as const;
