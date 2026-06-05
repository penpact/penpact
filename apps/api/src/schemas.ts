import { AUTH_METHODS, FIELD_TYPES, SIGNATURE_TYPES } from '@penpact/core';
import { z } from 'zod';
import { SUPPORTED_LOCALES } from './lib/i18n.js';

export const signerCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  routingOrder: z.number().int().min(1).optional(),
  authMethod: z.enum(AUTH_METHODS).optional(),
  /** Required when authMethod is 'access_code' — the shared secret the signer must enter. */
  accessCode: z.string().min(4).max(64).optional(),
});

export const authenticateSchema = z.object({
  code: z.string().min(1).max(64),
});

export const publicStartSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
});

export const generateDocumentSchema = z.object({
  documentName: z.string().min(1).max(255),
  template: z.string().min(1).max(200_000),
  variables: z.record(z.string()).optional(),
  signers: z.array(signerCreateSchema).min(1),
  expiresAt: z.string().datetime().optional(),
  locale: z.enum(SUPPORTED_LOCALES).optional(),
  reminderEveryHours: z.number().int().min(1).max(8760).optional(),
});
export type GenerateDocumentInput = z.infer<typeof generateDocumentSchema>;

export const bulkSendSchema = z.object({
  recipients: z
    .array(z.object({ name: z.string().min(1).max(120), email: z.string().email() }))
    .min(1)
    .max(500),
});

export const createOrgSchema = z.object({ name: z.string().min(1).max(120) });
export const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']).optional(),
});
export const activeOrgSchema = z.object({ organizationId: z.string().uuid() });

export const brandingSchema = z.object({
  brandName: z.string().min(1).max(80).optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex color like #5b8cff')
    .optional(),
  brandLogoUrl: z.string().url().max(2048).optional(),
});

export const envelopeCreateSchema = z.object({
  documentName: z.string().min(1).max(255),
  signers: z.array(signerCreateSchema).min(1),
  expiresAt: z.string().datetime().optional(),
  /** Re-nudge unsigned signers every N hours (1..8760). Omit to disable. */
  reminderEveryHours: z.number().int().min(1).max(8760).optional(),
  /** Signer-facing language for the signing page + emails. */
  locale: z.enum(SUPPORTED_LOCALES).optional(),
});

export type EnvelopeCreateInput = z.infer<typeof envelopeCreateSchema>;

export const fieldCreateSchema = z.object({
  type: z.enum(FIELD_TYPES),
  signerId: z.string().uuid(),
  /** Which document the field is on. Optional when the envelope has one document. */
  documentId: z.string().uuid().optional(),
  page: z.number().int().min(1),
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().positive(),
  height: z.number().positive(),
  required: z.boolean().optional(),
  /** Choices for dropdown/radio fields. */
  options: z.array(z.string().min(1).max(200)).min(1).max(50).optional(),
  /** Show/require this field only when another field equals a value. */
  condition: z.object({ fieldId: z.string().uuid(), equals: z.string().max(200) }).optional(),
});

export const placeFieldsSchema = z.object({
  fields: z.array(fieldCreateSchema).min(1),
});

export type FieldCreateInput = z.infer<typeof fieldCreateSchema>;
export type PlaceFieldsInput = z.infer<typeof placeFieldsSchema>;

// ─── Signer-facing payloads ───
export const consentSchema = z.object({
  disclosureHash: z.string().min(1),
  agree: z.literal(true),
});

export const completeSchema = z.object({
  signatureType: z.enum(SIGNATURE_TYPES),
  // Values are typed text or a drawn-signature PNG data URL (kept generous but
  // bounded so a single field cannot be used to push megabytes of payload).
  fields: z
    .array(z.object({ fieldId: z.string().uuid(), value: z.string().max(1_000_000) }))
    .default([]),
});

export const ATTACHMENT_CONTENT_TYPES = ['application/pdf', 'image/png', 'image/jpeg'] as const;

export const attachmentSchema = z.object({
  fieldId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  contentType: z.enum(ATTACHMENT_CONTENT_TYPES),
  // base64 (optionally a data: URL); ~14 MB of binary fits in the 20 MB cap.
  data: z.string().min(1).max(20_000_000),
});

export const declineSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const voidSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const templateCreateSchema = z.object({
  name: z.string().min(1).max(255),
  documentName: z.string().min(1).max(255),
  roles: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        routingOrder: z.number().int().min(1).optional(),
      }),
    )
    .min(1),
});

export const placeTemplateFieldsSchema = z.object({
  fields: z
    .array(
      z.object({
        type: z.enum(FIELD_TYPES),
        roleId: z.string().uuid(),
        page: z.number().int().min(1),
        x: z.number().min(0),
        y: z.number().min(0),
        width: z.number().positive(),
        height: z.number().positive(),
        required: z.boolean().optional(),
        options: z.array(z.string().min(1).max(200)).min(1).max(50).optional(),
      }),
    )
    .min(1),
});

export const instantiateTemplateSchema = z.object({
  signers: z
    .array(
      z.object({ roleId: z.string().uuid(), name: z.string().min(1), email: z.string().email() }),
    )
    .min(1),
  documentName: z.string().min(1).max(255).optional(),
  expiresAt: z.string().datetime().optional(),
});

export type TemplateCreateInput = z.infer<typeof templateCreateSchema>;
export type PlaceTemplateFieldsInput = z.infer<typeof placeTemplateFieldsSchema>;
export type InstantiateInput = z.infer<typeof instantiateTemplateSchema>;

export type CompleteInput = z.infer<typeof completeSchema>;
export type DeclineInput = z.infer<typeof declineSchema>;
export type AttachmentInput = z.infer<typeof attachmentSchema>;

// ─── Dashboard auth ───
export const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

export const createKeySchema = z.object({
  name: z.string().min(1).max(80).default('default'),
  mode: z.enum(['live', 'test']).default('live'),
});

export const createWebhookEndpointSchema = z.object({
  url: z.string().url().max(2048),
  description: z.string().max(200).optional(),
});

export const tokenSchema = z.object({ token: z.string().min(1).max(200) });
export const requestResetSchema = z.object({ email: z.string().email().max(254) });
export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(200),
  password: z.string().min(8).max(128),
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;
