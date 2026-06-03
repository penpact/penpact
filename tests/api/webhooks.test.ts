import { createHmac } from 'node:crypto';
import { buildCompletedEvent, signWebhook } from '@penpact/api/webhooks';
import { describe, expect, it } from 'vitest';

describe('webhooks', () => {
  it('signs with HMAC-SHA256 matching node crypto', () => {
    const body = '{"hello":"world"}';
    const expected = createHmac('sha256', 'secret').update(body).digest('hex');
    expect(signWebhook(body, 'secret')).toBe(expected);
  });

  it('builds a completed event payload', () => {
    const event = buildCompletedEvent('env-1', 'abc123');
    expect(event.type).toBe('envelope.completed');
    expect(event.data).toEqual({
      envelopeId: 'env-1',
      status: 'completed',
      documentHashFinal: 'abc123',
    });
    expect(event.id.startsWith('evt_')).toBe(true);
  });
});
