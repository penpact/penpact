import { PLANS, type Plan, planLimits, sendQuotaExceeded } from '@penpact/api/plans';
import { describe, expect, it } from 'vitest';

describe('planLimits', () => {
  it('returns the free tier for an unknown, null, or undefined plan', () => {
    expect(planLimits(null)).toEqual(PLANS.free);
    expect(planLimits(undefined)).toEqual(PLANS.free);
    expect(planLimits('nonsense')).toEqual(PLANS.free);
    expect(planLimits('free')).toEqual(PLANS.free);
  });

  it('free is metered (50 sends/mo, 1 seat) and shows attribution', () => {
    expect(PLANS.free.monthlySends).toBe(50);
    expect(PLANS.free.seats).toBe(1);
    expect(PLANS.free.attribution).toBe(true);
  });

  it('pro raises the cap, allows a team, and removes attribution', () => {
    expect(PLANS.pro.monthlySends).toBe(500);
    expect(PLANS.pro.seats).toBe(5);
    expect(PLANS.pro.attribution).toBe(false);
  });

  it('scale and enterprise are unlimited and without attribution', () => {
    for (const p of ['scale', 'enterprise'] as Plan[]) {
      expect(PLANS[p].monthlySends).toBe(Number.POSITIVE_INFINITY);
      expect(PLANS[p].seats).toBe(Number.POSITIVE_INFINITY);
      expect(PLANS[p].attribution).toBe(false);
    }
  });
});

describe('sendQuotaExceeded', () => {
  it('blocks free once the monthly cap is reached, not before', () => {
    expect(sendQuotaExceeded('free', 49)).toBe(false);
    expect(sendQuotaExceeded('free', 50)).toBe(true);
    expect(sendQuotaExceeded('free', 51)).toBe(true);
  });

  it('treats an unknown plan as free', () => {
    expect(sendQuotaExceeded('nonsense', 50)).toBe(true);
  });

  it('never blocks unlimited tiers', () => {
    expect(sendQuotaExceeded('scale', 1_000_000)).toBe(false);
    expect(sendQuotaExceeded('enterprise', 1_000_000)).toBe(false);
  });
});
