import {
  convertCurrencyAmount,
  normalizeCurrency,
  type ExchangeRates,
} from "./currency";
import type { LifetimeRevenueByCurrency } from "./types";

export const REVENUE_MILESTONE_GOALS = [
  1_000_000,
  5_000_000,
  10_000_000,
  50_000_000,
  100_000_000,
  500_000_000,
  1_000_000_000,
] as const;

export type RevenueMilestone = {
  total: number;
  target: number;
  progress: number;
  maximumReached: boolean;
};

export function resolveRevenueMilestone(value: number | null | undefined): RevenueMilestone {
  const parsed = Number(value);
  const total = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  const lastGoal = REVENUE_MILESTONE_GOALS[REVENUE_MILESTONE_GOALS.length - 1];
  const target = REVENUE_MILESTONE_GOALS.find((goal) => total < goal) ?? lastGoal;
  const progress = Math.min(100, (total / target) * 100);

  return {
    total,
    target,
    progress,
    maximumReached: total >= lastGoal,
  };
}

/**
 * Converts the database's small per-currency aggregate into the workspace's
 * default currency. A missing rate returns null instead of silently showing a
 * partial lifetime total with the wrong label.
 */
export function convertLifetimeRevenue(
  rows: LifetimeRevenueByCurrency[],
  targetCurrency: string,
  rates: ExchangeRates | null | undefined,
): number | null {
  const target = normalizeCurrency(targetCurrency) || "BRL";
  let total = 0;

  for (const row of rows) {
    const converted = convertCurrencyAmount(
      row.gross_revenue,
      row.currency,
      target,
      rates,
    );
    if (converted === null) return null;
    total += converted;
  }

  return total;
}
