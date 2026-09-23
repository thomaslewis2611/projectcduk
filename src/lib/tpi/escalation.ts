/**
 * Escalate a construction cost between two quarters using TPI forecasts.
 *
 * Rates are annual (January–December) % changes. Each quarter takes a quarter
 * of its calendar year's rate, compounded: factor (1 + r)^(1/4). So Q4 2025 →
 * Q4 2026 applies exactly the 2026 rate, and Q2 → Q3 of one year applies a
 * quarter of it.
 *
 * Pure functions, no I/O.
 */

export type Quarter = { year: number; quarter: number };

export type YearRate = {
  year: number;
  /** Annual % change, e.g. 3.25. */
  changePct: number;
  /** Where the rate came from, e.g. "Gardiner & Theobald Autumn 2026". */
  source: string;
};

export type EscalationStep = YearRate & {
  /** Quarters of this year the escalation passes through. */
  quarters: number;
  /** Multiplier contributed by those quarters (before direction is applied). */
  factor: number;
};

export type EscalationResult =
  | {
      ok: true;
      amount: number;
      escalated: number;
      /** Overall % change from base to target (negative when de-escalating). */
      changePct: number;
      /** true when the target is earlier than the base. */
      backwards: boolean;
      steps: EscalationStep[];
    }
  | { ok: false; error: string };

/** Minimal shape of a forecast row needed to pick rates. */
export type RateRow = {
  region: string;
  forecast_year: number;
  change_pct: number | null;
  publisher: string | null;
  period_label: string | null;
  period_year: number | null;
  period_quarter: number | null;
};

export const quarterIndex = (q: Quarter) => q.year * 4 + (q.quarter - 1);
export const formatQuarter = (q: Quarter) => `Q${q.quarter} ${q.year}`;

/**
 * For each calendar year, the rate from the most recent report that forecast
 * it. For past years this is the last forecast made (closest to out-turn);
 * for future years, the latest view.
 */
export function bestRatesByYear(rows: RateRow[], region: string): Map<number, YearRate> {
  const best = new Map<number, { rate: YearRate; reportOrder: number }>();
  for (const row of rows) {
    if (row.region !== region || row.change_pct === null) continue;
    const reportOrder = (row.period_year ?? 0) * 4 + (row.period_quarter ?? 0);
    const current = best.get(row.forecast_year);
    if (current && current.reportOrder >= reportOrder) continue;
    best.set(row.forecast_year, {
      reportOrder,
      rate: {
        year: row.forecast_year,
        changePct: row.change_pct,
        source: [row.publisher, row.period_label].filter(Boolean).join(" "),
      },
    });
  }
  return new Map([...best].map(([year, { rate }]) => [year, rate]));
}

export function escalate(
  amount: number,
  from: Quarter,
  to: Quarter,
  rates: Map<number, YearRate>,
): EscalationResult {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter an amount greater than zero." };
  }

  const backwards = quarterIndex(to) < quarterIndex(from);
  const [start, end] = backwards ? [to, from] : [from, to];

  // Quarters passed through: those after `start`, up to and including `end`.
  const quartersByYear = new Map<number, number>();
  for (let i = quarterIndex(start) + 1; i <= quarterIndex(end); i++) {
    const year = Math.floor(i / 4);
    quartersByYear.set(year, (quartersByYear.get(year) ?? 0) + 1);
  }

  const steps: EscalationStep[] = [];
  let factor = 1;
  for (const [year, quarters] of quartersByYear) {
    const rate = rates.get(year);
    if (!rate) {
      const years = [...rates.keys()].sort((a, b) => a - b);
      const range = years.length ? ` Rates are available for ${years[0]}–${years.at(-1)}.` : "";
      return { ok: false, error: `No forecast covers ${year} for this region.${range}` };
    }
    const stepFactor = Math.pow(1 + rate.changePct / 100, quarters / 4);
    factor *= stepFactor;
    steps.push({ ...rate, quarters, factor: stepFactor });
  }

  const escalated = backwards ? amount / factor : amount * factor;
  return {
    ok: true,
    amount,
    escalated,
    changePct: (escalated / amount - 1) * 100,
    backwards,
    steps,
  };
}
