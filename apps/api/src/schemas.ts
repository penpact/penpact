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
  fields: z
    .array(z.object({ fieldId: z.string().uuid(), value: z.string().max(10_000) }))
    .default([]),
});

export const declineSchema = z.object({
  reason: z.string().max(500).optional(),
});

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

export type CredentialsInput = z.infer<typeof credentialsSchema>;
