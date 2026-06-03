import { activeOrder, isActiveSigner } from '@penpact/api/routing';
import { describe, expect, it } from 'vitest';

describe('sequential routing', () => {
  it('activeOrder is the lowest order among not-yet-finished signers', () => {
    expect(activeOrder([{ routingOrder: 1, status: 'sent' }])).toBe(1);
    expect(
      activeOrder([
        { routingOrder: 1, status: 'signed' },
        { routingOrder: 2, status: 'pending' },
      ]),
    ).toBe(2);
    // all done -> null
    expect(
      activeOrder([
        { routingOrder: 1, status: 'signed' },
        { routingOrder: 2, status: 'declined' },
      ]),
    ).toBeNull();
  });

  it('parallel signers (all order 1) are all active', () => {
    const a = { routingOrder: 1, status: 'sent' };
    const b = { routingOrder: 1, status: 'sent' };
    expect(isActiveSigner(a, [a, b])).toBe(true);
    expect(isActiveSigner(b, [a, b])).toBe(true);
  });

  it('a later-order signer is not active until earlier ones finish', () => {
    const first = { routingOrder: 1, status: 'sent' };
    const second = { routingOrder: 2, status: 'pending' };
    expect(isActiveSigner(second, [first, second])).toBe(false);
    const firstSigned = { routingOrder: 1, status: 'signed' };
    expect(isActiveSigner(second, [firstSigned, second])).toBe(true);
  });

  it('a finished signer is not active', () => {
    const done = { routingOrder: 1, status: 'signed' };
    expect(isActiveSigner(done, [done])).toBe(false);
  });
});
