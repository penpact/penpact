import { AUTH_METHODS, FIELD_TYPES, SIGNATURE_TYPES } from '@penpact/core';
import { z } from 'zod';

export const signerCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  routingOrder: z.number().int().min(1).optional(),
  authMethod: z.enum(AUTH_METHODS).optional(),
});

export const envelopeCreateSchema = z.object({
  documentName: z.string().min(1).max(255),
  signers: z.array(signerCreateSchema).min(1),
  expiresAt: z.string().datetime().optional(),
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
      z.object({ name: z.string().min(1).max(120), routingOrder: z.number().int().min(1).optional() }),
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
      }),
    )
    .min(1),
});

export const instantiateTemplateSchema = z.object({
  signers: z
    .array(z.object({ roleId: z.string().uuid(), name: z.string().min(1), email: z.string().email() }))
    .min(1),
  documentName: z.string().min(1).max(255).optional(),
  expiresAt: z.string().datetime().optional(),
});

export type TemplateCreateInput = z.infer<typeof templateCreateSchema>;
export type PlaceTemplateFieldsInput = z.infer<typeof placeTemplateFieldsSchema>;
export type InstantiateInput = z.infer<typeof instantiateTemplateSchema>;

export type CompleteInput = z.infer<typeof completeSchema>;
export type DeclineInput = z.infer<typeof declineSchema>;

// ─── Dashboard auth ───
export const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

export const createKeySchema = z.object({
  name: z.string().min(1).max(80).default('default'),
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
