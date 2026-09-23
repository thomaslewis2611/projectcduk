import { describe, expect, it } from "vitest";
import { bestRatesByYear, escalate, type RateRow, type YearRate } from "./escalation";

const rates = (entries: Array<[number, number]>) =>
  new Map<number, YearRate>(
    entries.map(([year, changePct]) => [year, { year, changePct, source: "Test" }]),
  );

describe("escalate", () => {
  const r = rates([
    [2025, 2.5],
    [2026, 3.25],
    [2027, 2.75],
  ]);

  it("Q4 → Q4 applies exactly one year's rate", () => {
    const result = escalate(1_000_000, { year: 2025, quarter: 4 }, { year: 2026, quarter: 4 }, r);
    expect(result.ok && result.escalated).toBeCloseTo(1_032_500, 6);
  });

  it("compounds across years and splits part-years by quarter", () => {
    // Q2 2025 → Q3 2027: Q3–Q4 2025 (2/4), all of 2026, Q1–Q3 2027 (3/4)
    const result = escalate(2_000_000, { year: 2025, quarter: 2 }, { year: 2027, quarter: 3 }, r);
    const expected = 2_000_000 * 1.025 ** 0.5 * 1.0325 * 1.0275 ** 0.75;
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.escalated).toBeCloseTo(expected, 6);
    expect(result.steps.map((s) => [s.year, s.quarters])).toEqual([
      [2025, 2],
      [2026, 4],
      [2027, 3],
    ]);
  });

  it("four quarter steps compound to the annual rate", () => {
    const a = escalate(100, { year: 2025, quarter: 4 }, { year: 2026, quarter: 2 }, r);
    const b = escalate(100, { year: 2026, quarter: 2 }, { year: 2026, quarter: 4 }, r);
    expect(a.ok && b.ok && (a.escalated / 100) * (b.escalated / 100)).toBeCloseTo(1.0325, 10);
  });

  it("de-escalates when the target is earlier, as the exact inverse", () => {
    const forward = escalate(100, { year: 2025, quarter: 1 }, { year: 2027, quarter: 1 }, r);
    const back = escalate(100, { year: 2027, quarter: 1 }, { year: 2025, quarter: 1 }, r);
    expect(back.ok && back.backwards).toBe(true);
    expect(forward.ok && back.ok && forward.escalated * back.escalated).toBeCloseTo(10_000, 8);
    expect(back.ok && back.changePct).toBeLessThan(0);
  });

  it("returns the amount unchanged for the same quarter", () => {
    const result = escalate(500, { year: 2026, quarter: 2 }, { year: 2026, quarter: 2 }, r);
    expect(result).toMatchObject({ ok: true, escalated: 500, changePct: 0, steps: [] });
  });

  it("explains missing years and bad amounts", () => {
    const result = escalate(100, { year: 2026, quarter: 1 }, { year: 2030, quarter: 1 }, r);
    expect(result).toEqual({
      ok: false,
      error: "No forecast covers 2028 for this region. Rates are available for 2025–2027.",
    });
    expect(escalate(0, { year: 2026, quarter: 1 }, { year: 2026, quarter: 2 }, r).ok).toBe(false);
  });
});

describe("bestRatesByYear", () => {
  const row = (
    period: [number, number, string],
    forecastYear: number,
    changePct: number | null,
    region = "UK Average",
  ): RateRow => ({
    region,
    forecast_year: forecastYear,
    change_pct: changePct,
    publisher: "G&T",
    period_label: period[2],
    period_year: period[0],
    period_quarter: period[1],
  });

  it("uses the most recent report that forecast each year", () => {
    const rows = [
      row([2024, 4, "Q4 2024"], 2024, 2.5),
      row([2024, 4, "Q4 2024"], 2025, 2.75),
      row([2025, 1, "Q1 2025"], 2025, 2.25),
      row([2024, 1, "Q1 2024"], 2024, 2),
      row([2025, 1, "Q1 2025"], 2025, 9, "Wales"),
    ];
    const best = bestRatesByYear(rows, "UK Average");
    expect(best.get(2024)).toEqual({ year: 2024, changePct: 2.5, source: "G&T Q4 2024" });
    expect(best.get(2025)).toEqual({ year: 2025, changePct: 2.25, source: "G&T Q1 2025" });
  });

  it("skips N/A values", () => {
    const rows = [row([2024, 1, "Q1 2024"], 2027, 2.5), row([2024, 2, "Q2 2024"], 2027, null)];
    expect(bestRatesByYear(rows, "UK Average").get(2027)?.source).toBe("G&T Q1 2024");
  });
});
