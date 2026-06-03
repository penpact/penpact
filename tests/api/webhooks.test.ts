import { createHmac } from 'node:crypto';
import {
  buildCompletedEvent,
  isExhausted,
  nextDelaySeconds,
  parseSignatureHeader,
  signPayload,
  signWebhook,
} from '@penpact/api/webhooks';
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

  describe('signPayload (timestamped, replay-resistant)', () => {
    it('returns t=<ts>,v1=<hmac of "t.body">', () => {
      const body = '{"hello":"world"}';
      const t = 1780500000;
      const expectedHmac = createHmac('sha256', 'whsec_x').update(`${t}.${body}`).digest('hex');
      expect(signPayload('whsec_x', body, t)).toBe(`t=${t},v1=${expectedHmac}`);
    });

    it('round-trips through parseSignatureHeader', () => {
      const header = signPayload('whsec_x', '{}', 1780500000);
      expect(parseSignatureHeader(header)).toEqual({
        t: 1780500000,
        v1: createHmac('sha256', 'whsec_x').update('1780500000.{}').digest('hex'),
      });
    });

    it('parseSignatureHeader returns null on malformed input', () => {
      expect(parseSignatureHeader('garbage')).toBeNull();
      expect(parseSignatureHeader('t=abc,v1=x')).toBeNull();
      expect(parseSignatureHeader('')).toBeNull();
    });
  });

  describe('retry backoff', () => {
    it('follows the exponential schedule by attempts made', () => {
      expect(nextDelaySeconds(0)).toBe(0);
      expect(nextDelaySeconds(1)).toBe(60);
      expect(nextDelaySeconds(2)).toBe(300);
      expect(nextDelaySeconds(3)).toBe(1800);
      expect(nextDelaySeconds(4)).toBe(7200);
      expect(nextDelaySeconds(5)).toBe(21600);
    });

    it('clamps to the last delay beyond the schedule', () => {
      expect(nextDelaySeconds(6)).toBe(21600);
      expect(nextDelaySeconds(99)).toBe(21600);
    });

    it('isExhausted is true once attempts reach the max', () => {
      expect(isExhausted(5, 6)).toBe(false);
      expect(isExhausted(6, 6)).toBe(true);
      expect(isExhausted(7, 6)).toBe(true);
    });
  });
});
