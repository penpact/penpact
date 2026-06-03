import { AUTH_METHODS, FIELD_TYPES } from '@penpact/core';
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
