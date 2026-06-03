import { AUTH_METHODS } from '@penpact/core';
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
