import { envelopeCreateSchema } from '@penpact/api/schemas';
import { describe, expect, it } from 'vitest';

describe('envelopeCreateSchema', () => {
  it('accepts a valid payload', () => {
    const result = envelopeCreateSchema.safeParse({
      documentName: 'Mutual NDA',
      signers: [{ name: 'Bob', email: 'bob@example.com' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty signers array', () => {
    const result = envelopeCreateSchema.safeParse({ documentName: 'NDA', signers: [] });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid signer email', () => {
    const result = envelopeCreateSchema.safeParse({
      documentName: 'NDA',
      signers: [{ name: 'Bob', email: 'not-an-email' }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing documentName', () => {
    const result = envelopeCreateSchema.safeParse({
      signers: [{ name: 'Bob', email: 'bob@example.com' }],
    });
    expect(result.success).toBe(false);
  });
});
