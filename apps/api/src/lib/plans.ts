/**
 * Subscription plans and their limits. This is the single source of truth for
 * what each tier allows; billing (Stripe) flips an org's `plan` column, and the
 * rest of the app reads limits from here. `Infinity` means "no cap".
 *
 * Pricing rationale (kept generous to drive open-source adoption): embedding and
 * brand theming are free on every tier — only volume, team seats, and removing
 * the "Secured by Penpact" attribution are gated.
 */
export type Plan = 'free' | 'pro' | 'scale' | 'enterprise';

export interface PlanLimits {
  /** Envelopes that can be sent per calendar month (UTC). */
  monthlySends: number;
  /** Maximum members in the organization. */
  seats: number;
  /** Whether the signing page shows the "Secured by Penpact" attribution. */
  attribution: boolean;
}

const UNLIMITED = Number.POSITIVE_INFINITY;

export const PLANS: Record<Plan, PlanLimits> = {
  free: { monthlySends: 50, seats: 1, attribution: true },
  pro: { monthlySends: 500, seats: 5, attribution: false },
  scale: { monthlySends: UNLIMITED, seats: UNLIMITED, attribution: false },
  enterprise: { monthlySends: UNLIMITED, seats: UNLIMITED, attribution: false },
};

export const PLAN_NAMES = Object.keys(PLANS) as Plan[];

function isPlan(value: string | null | undefined): value is Plan {
  return value != null && Object.hasOwn(PLANS, value);
}

/** Normalize an org's stored plan string to a known plan (defaults to free). */
export function normalizePlan(plan: string | null | undefined): Plan {
  return isPlan(plan) ? plan : 'free';
}

/** Limits for a stored plan string; unknown/null/undefined fall back to free. */
export function planLimits(plan: string | null | undefined): PlanLimits {
  return PLANS[normalizePlan(plan)];
}

/** Whether a further send would exceed the plan's monthly cap. */
export function sendQuotaExceeded(plan: string | null | undefined, sentThisMonth: number): boolean {
  return sentThisMonth >= planLimits(plan).monthlySends;
}
