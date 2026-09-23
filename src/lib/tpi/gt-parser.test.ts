import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GT_REGIONS, extractGtPeriod, isGtTpiReport, parseGtTpiReport } from "./gt-parser";

// Excerpts of real report text (from Google Drive's PDF extraction), keeping
// the interleaving and run-together rows that make these awkward to parse.
const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}.txt`, import.meta.url), "utf8");

/** Row → [now, last] pairs, for compact assertions. */
function row(report: ReturnType<typeof parseGtTpiReport>, region: string) {
  return report?.rows
    .find((r) => r.region === region)
    ?.forecasts.map((f) => [f.changePct, f.previousChangePct]);
}

describe.each([
  ["gt-q4-2021", "Q4 2021", [2021, 2022, 2023, 2024]],
  ["gt-q1-2022", "Q1 2022", [2022, 2023, 2024, 2025]],
  ["gt-q4-2022", "Q4 2022", [2022, 2023, 2024, 2025]],
  ["gt-q2-2023", "Q2 2023", [2023, 2024, 2025, 2026]],
  ["gt-q2-2026", "Q2 2026", [2026, 2027, 2028, 2029]],
  ["gt-autumn-2026", "Autumn 2026", [2026, 2027, 2028, 2029]],
])("%s", (name, period, years) => {
  const report = parseGtTpiReport(fixture(name));

  it("is recognised as a G&T report", () => {
    expect(isGtTpiReport(fixture(name))).toBe(true);
  });

  it("reads the period and forecast years", () => {
    expect(report?.period.label).toBe(period);
    expect(report?.forecastYears).toEqual(years);
  });

  it("reads all 12 regions with 4 forecasts each", () => {
    expect(report?.rows.map((r) => r.region)).toEqual([...GT_REGIONS]);
    for (const r of report!.rows) expect(r.forecasts).toHaveLength(4);
  });
});

describe("parseGtTpiReport values", () => {
  it("Q4 2021: reads single-decimal cells and the unspaced 'UK Average(weighted)'", () => {
    const report = parseGtTpiReport(fixture("gt-q4-2021"));
    expect(row(report, "North East")).toEqual([
      [1.75, 1.75],
      [1.5, 1.5],
      [1.5, 1.5],
      [1.5, 1.5],
    ]);
    expect(row(report, "UK Average")?.[0]).toEqual([2.5, 2]);
    expect(row(report, "Northern Ireland")?.[0]).toEqual([6, 3]);
  });

  it("Q1 2022: N/A becomes null, and the stale back-page table is ignored", () => {
    const report = parseGtTpiReport(fixture("gt-q1-2022"));
    expect(report?.forecastYears).toEqual([2022, 2023, 2024, 2025]);
    expect(row(report, "Greater London")?.[3]).toEqual([2, null]);
  });

  it("Q4 2022: reads rows interleaved with other text", () => {
    const report = parseGtTpiReport(fixture("gt-q4-2022"));
    expect(row(report, "Greater London")?.[0]).toEqual([6, 5.5]);
    expect(row(report, "North East")?.[3]).toEqual([2, 2]);
    expect(row(report, "UK Average")?.[3]).toEqual([2.25, 2.25]);
  });

  it("does not read North/South East as East", () => {
    const report = parseGtTpiReport(fixture("gt-q4-2022"));
    expect(row(report, "East")?.[0]).toEqual([4.5, 4.5]);
    expect(row(report, "South East")?.[0]).toEqual([6, 5.5]);
    expect(row(report, "North East")?.[0]).toEqual([5, 4]);
  });

  it("Q2 2026: reads 'East (Anglia)' and 'UK Weighted Average'", () => {
    const report = parseGtTpiReport(fixture("gt-q2-2026"));
    expect(row(report, "East")?.[0]).toEqual([3.75, 3]);
    expect(row(report, "UK Average")).toEqual([
      [3.5, 3],
      [2.75, 2.75],
      [2.75, 2.75],
      [2.75, 2.75],
    ]);
  });

  it("Autumn 2026: reads several rows run together on one line", () => {
    const report = parseGtTpiReport(fixture("gt-autumn-2026"));
    expect(row(report, "South West")?.[1]).toEqual([2.75, 2.5]);
    expect(row(report, "Scotland")?.[0]).toEqual([3, 3]);
    expect(row(report, "UK Average")?.[3]).toEqual([3, 2.75]);
  });
});

describe("extractGtPeriod", () => {
  it("orders seasonal editions within the year", () => {
    expect(extractGtPeriod("Tender price annual percentage change AUTUMN 2026")).toEqual({
      label: "Autumn 2026",
      year: 2026,
      quarter: 3,
    });
  });

  it("falls back to the cover and then the filename", () => {
    expect(extractGtPeriod("TENDER PRICE INDICATOR 1st Quarter 2022")?.label).toBe("Q1 2022");
    expect(extractGtPeriod("no period here", "2505_Q2-2025-TPI.pdf")?.label).toBe("Q2 2025");
    expect(extractGtPeriod("no period here", "2609_TPI_Autumn.pdf")?.label).toBe("Autumn 2026");
  });
});

describe("isGtTpiReport", () => {
  it("rejects other text", () => {
    expect(isGtTpiReport("London  Office  112.4  £250")).toBe(false);
    expect(parseGtTpiReport("London  Office  112.4  £250")).toBeNull();
  });
});
