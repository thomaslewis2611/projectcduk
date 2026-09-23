import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { extractReport, pdfToText } from "./ingest.server";

// A PDF printed by Chromium from HTML laid out like a G&T report page: a text
// sidebar next to the regional table. (Not a real report — those can't be
// committed to this public repo.)
const pdf = readFileSync(new URL("./tpi/__fixtures__/synthetic-q2-2026.pdf", import.meta.url));

// Loading pdf.js cold takes several seconds under vitest's transform.
beforeAll(() => pdfToText(pdf), 60_000);

describe("pdfToText", () => {
  it("keeps table cells separated", async () => {
    const text = await pdfToText(pdf);
    expect(text).toContain("% 2026 2027 2028 2029");
    expect(text).toContain("South East 3.50 3.00 3.00 3.00 2.75 2.75 2.75 2.75");
  });
});

describe("extractReport", () => {
  it("recognises a G&T report and reads every region", async () => {
    const extracted = await extractReport("2605_Q2_2026-TPI.pdf", pdf);
    expect(extracted.kind).toBe("gt_tpi");
    if (extracted.kind !== "gt_tpi") return;
    expect(extracted.report.period.label).toBe("Q2 2026");
    expect(extracted.missingRegions).toEqual([]);
    const london = extracted.report.rows.find((r) => r.region === "Greater London");
    expect(london?.forecasts[0]).toEqual({ year: 2026, changePct: 3.75, previousChangePct: 3.25 });
  });
});
