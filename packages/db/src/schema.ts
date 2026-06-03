/**
 * Penpact database schema (Postgres + Drizzle).
 *
 * Encodes the data model from the build spec §8. Enum *values* are imported
 * from @penpact/core so the database, API and SDK share one source of truth.
 *
 * Integrity rules:
 *  - `events` is APPEND-ONLY — enforced at the DB level by a trigger in the
 *    migration `0001_events_append_only.sql` (UPDATE/DELETE raise an exception).
 *  - Document hashes, certificate rows and the final sealed PDF are immutable
 *    once written (enforced in application code; retention via object-lock).
 *  - API keys store only a hash of a HIGH-ENTROPY random secret (SHA-256 is
 *    appropriate + indexable here; slow KDFs are for low-entropy passwords).
 */
import {
  AUDIT_EVENT_TYPES,
  AUTH_METHODS,
  ENVELOPE_STATUSES,
  FIELD_TYPES,
  SIGNATURE_TYPES,
  SIGNER_STATUSES,
} from '@penpact/core';
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// ─── Enums (single source of truth = @penpact/core) ───
export const envelopeStatus = pgEnum('envelope_status', ENVELOPE_STATUSES);
export const signerStatus = pgEnum('signer_status', SIGNER_STATUSES);
export const authMethod = pgEnum('auth_method', AUTH_METHODS);
export const signatureType = pgEnum('signature_type', SIGNATURE_TYPES);
export const fieldType = pgEnum('field_type', FIELD_TYPES);
export const auditEventType = pgEnum('audit_event_type', AUDIT_EVENT_TYPES);
export const actorType = pgEnum('actor_type', ['sender', 'signer', 'system']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ─── users ───
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    name: text('name'),
    ...timestamps,
  },
  // Case-insensitive uniqueness — auth lookups normalize to lower-case.
  (t) => [uniqueIndex('users_email_lower_uq').on(sql`lower(${t.email})`)],
);

// ─── api_keys (store only a hash of the secret, never the raw key) ───
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Short non-secret prefix shown in the dashboard (e.g. "pk_live_a1b2"). */
    prefix: text('prefix').notNull(),
    /** SHA-256 hash of the full high-entropy secret key. */
    keyHash: text('key_hash').notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('api_keys_hash_uq').on(t.keyHash), index('api_keys_user_idx').on(t.userId)],
);

// ─── envelopes ───
export const envelopes = pgTable(
  'envelopes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    documentName: text('document_name').notNull(),
    status: envelopeStatus('status').notNull().default('draft'),
    documentHashOriginal: text('document_hash_original'),
    documentHashFinal: text('document_hash_final'),
    hashAlgorithm: text('hash_algorithm').notNull().default('SHA-256'),
    senderName: text('sender_name').notNull(),
    senderEmail: text('sender_email').notNull(),
    disclosureVersion: text('disclosure_version'),
    disclosureHash: text('disclosure_hash'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    ...timestamps,
  },
  // Primary access pattern: a sender's envelopes, often filtered by status.
  // The composite also serves user_id-only queries (leftmost prefix).
  (t) => [index('envelopes_user_status_idx').on(t.userId, t.status)],
);

// ─── documents (stored PDF objects; immutable once sealed) ───
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    envelopeId: uuid('envelope_id')
      .notNull()
      .references(() => envelopes.id, { onDelete: 'cascade' }),
    /** Object-storage key (R2/S3) with versioning / object-lock. */
    storageKey: text('storage_key').notNull(),
    contentHash: text('content_hash').notNull(),
    version: integer('version').notNull().default(1),
    mimeType: text('mime_type').notNull().default('application/pdf'),
    byteSize: integer('byte_size'),
    /** true once this is the flattened + sealed final copy. */
    isFinal: boolean('is_final').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('documents_envelope_idx').on(t.envelopeId),
    // At most one sealed final document per envelope.
    uniqueIndex('documents_final_uq').on(t.envelopeId).where(sql`${t.isFinal}`),
    check('documents_version_chk', sql`${t.version} >= 1`),
    check('documents_bytesize_chk', sql`${t.byteSize} is null or ${t.byteSize} >= 0`),
  ],
);

// ─── signers ───
export const signers = pgTable(
  'signers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    envelopeId: uuid('envelope_id')
      .notNull()
      .references(() => envelopes.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    status: signerStatus('status').notNull().default('pending'),
    /** 1-based routing order for sequential signing. */
    routingOrder: integer('routing_order').notNull().default(1),
    authMethod: authMethod('auth_method').notNull().default('email_link'),
    /** Hash of an optional access code (never store raw). */
    accessCodeHash: text('access_code_hash'),
    /** Opaque unguessable token used to build the signing link. */
    signingToken: text('signing_token').notNull(),
    consentGiven: boolean('consent_given').notNull().default(false),
    consentTimestamp: timestamp('consent_timestamp', { withTimezone: true }),
    consentDisclosureHash: text('consent_disclosure_hash'),
    signatureType: signatureType('signature_type'),
    ipAddress: text('ip_address'),
    geoApprox: text('geo_approx'),
    userAgent: text('user_agent'),
    device: text('device'),
    viewedAt: timestamp('viewed_at', { withTimezone: true }),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    declinedAt: timestamp('declined_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('signers_token_uq').on(t.signingToken),
    // Sequential signing resolves the next signer by (envelope, routing order).
    index('signers_envelope_order_idx').on(t.envelopeId, t.routingOrder),
    check('signers_routing_order_chk', sql`${t.routingOrder} >= 1`),
  ],
);

// ─── fields (placed on a document, manually or AI-detected) ───
export const fields = pgTable(
  'fields',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    envelopeId: uuid('envelope_id')
      .notNull()
      .references(() => envelopes.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    signerId: uuid('signer_id').references(() => signers.id, { onDelete: 'set null' }),
    type: fieldType('type').notNull(),
    /** 1-based page index. Coordinates are PDF points, origin top-left. */
    page: integer('page').notNull().default(1),
    x: doublePrecision('x').notNull(),
    y: doublePrecision('y').notNull(),
    width: doublePrecision('width').notNull(),
    height: doublePrecision('height').notNull(),
    required: boolean('required').notNull().default(true),
    value: text('value'),
    aiDetected: boolean('ai_detected').notNull().default(false),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('fields_envelope_idx').on(t.envelopeId),
    index('fields_signer_idx').on(t.signerId),
    check(
      'fields_geometry_chk',
      sql`${t.page} >= 1 and ${t.x} >= 0 and ${t.y} >= 0 and ${t.width} > 0 and ${t.height} > 0`,
    ),
  ],
);

// ─── events (APPEND-ONLY audit trail — §8) ───
export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    envelopeId: uuid('envelope_id')
      .notNull()
      .references(() => envelopes.id, { onDelete: 'cascade' }),
    signerId: uuid('signer_id').references(() => signers.id, { onDelete: 'set null' }),
    type: auditEventType('type').notNull(),
    actor: actorType('actor').notNull(),
    actorId: text('actor_id'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    geoApprox: text('geo_approx'),
    device: text('device'),
    /** Document hash at the moment of the event, when meaningful. */
    docHashAtEvent: text('doc_hash_at_event'),
    metadata: jsonb('metadata'),
    timestampUtc: timestamp('timestamp_utc', { withTimezone: true }).notNull().defaultNow(),
  },
  // The audit trail is read in chronological order per envelope (timeline +
  // Certificate of Completion), so index on (envelope, time).
  (t) => [index('events_envelope_time_idx').on(t.envelopeId, t.timestampUtc)],
);

// ─── certificates (Certificate of Completion, one per envelope) ───
export const certificates = pgTable(
  'certificates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    envelopeId: uuid('envelope_id')
      .notNull()
      .references(() => envelopes.id, { onDelete: 'cascade' }),
    /** Object-storage key of the generated certificate PDF. */
    storageKey: text('storage_key'),
    /** The full CertificateOfCompletion payload (see @penpact/core). */
    payload: jsonb('payload').notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('certificates_envelope_uq').on(t.envelopeId)],
);

// ─── relations ───
export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(apiKeys),
  envelopes: many(envelopes),
}));

export const envelopesRelations = relations(envelopes, ({ one, many }) => ({
  user: one(users, { fields: [envelopes.userId], references: [users.id] }),
  documents: many(documents),
  signers: many(signers),
  fields: many(fields),
  events: many(events),
  certificate: one(certificates),
}));

export const signersRelations = relations(signers, ({ one, many }) => ({
  envelope: one(envelopes, { fields: [signers.envelopeId], references: [envelopes.id] }),
  fields: many(fields),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  envelope: one(envelopes, { fields: [documents.envelopeId], references: [envelopes.id] }),
  fields: many(fields),
}));

export const fieldsRelations = relations(fields, ({ one }) => ({
  envelope: one(envelopes, { fields: [fields.envelopeId], references: [envelopes.id] }),
  document: one(documents, { fields: [fields.documentId], references: [documents.id] }),
  signer: one(signers, { fields: [fields.signerId], references: [signers.id] }),
}));

export const certificatesRelations = relations(certificates, ({ one }) => ({
  envelope: one(envelopes, { fields: [certificates.envelopeId], references: [envelopes.id] }),
}));
