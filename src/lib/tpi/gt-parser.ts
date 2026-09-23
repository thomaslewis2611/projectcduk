/**
 * Parser for Gardiner & Theobald (G&T) quarterly Tender Price Indicator reports.
 *
 * Each report has a "Tender price annual percentage change" table: 12 regions ×
 * 4 forecast years, each with this report's forecast ("Now") and the previous
 * report's ("Last"). PDF text extraction interleaves this table with
 * surrounding text and sometimes runs rows together on one line, so we scan
 * for "<region> <8 values>" patterns rather than relying on line breaks.
 *
 * Pure text in, data out — no I/O — so it is unit-tested against report text.
 */

export const GT_PUBLISHER = "Gardiner & Theobald";

/** Canonical region names, in G&T's table order. */
export const GT_REGIONS = [
  "Greater London",
  "South East",
  "South West",
  "East",
  "Midlands",
  "Wales",
  "Yorkshire & Humber",
  "North West",
  "North East",
  "Scotland",
  "Northern Ireland",
  "UK Average",
] as const;

export type GtRegion = (typeof GT_REGIONS)[number];

/** How each region's label is written across report editions. */
const REGION_PATTERNS: Record<GtRegion, string> = {
  "Greater London": String.raw`Greater\s+London`,
  "South East": String.raw`South\s+East`,
  "South West": String.raw`South\s+West`,
  // Plain "East" must not match the tail of "North East" / "South East".
  East: String.raw`(?<!(?:North|South)\s{1,3})\bEast(?:\s*\(Anglia\))?`,
  Midlands: String.raw`Midlands`,
  Wales: String.raw`Wales`,
  "Yorkshire & Humber": String.raw`Yorks(?:hire)?\s*(?:&|and)\s*(?:the\s+)?Humber`,
  "North West": String.raw`North\s+West`,
  "North East": String.raw`North\s+East`,
  Scotland: String.raw`Scotland`,
  "Northern Ireland": String.raw`Northern\s+Ireland`,
  // "UK Average (weighted)", "UK Average(weighted)", "UK Average",
  // "UK Weighted Average", "UK Weighted Avg."
  "UK Average": String.raw`UK\s+(?:Weighted\s+Av(?:erage|g\.?)|Average(?:\s*\(weighted\))?)`,
};

const VALUE = String.raw`(-?\d+(?:\.\d+)?|N\/A)`;
const EIGHT_VALUES = Array.from({ length: 8 }, () => VALUE).join(String.raw`\s+`);

/** "% 2026 2027 2028 2029" — the table's header row. */
const HEADER = /%\s+(20\d\d)\s+(20\d\d)\s+(20\d\d)\s+(20\d\d)/;

export type GtForecast = {
  /** Calendar year the forecast is for (annual Jan–Dec tender price change). */
  year: number;
  /** This report's forecast, % change. */
  changePct: number | null;
  /** The previous report's forecast for the same year, % change. */
  previousChangePct: number | null;
};

export type GtRow = { region: GtRegion; forecasts: GtForecast[] };

export type GtPeriod = {
  /** As printed, normalised: "Q2 2026" or "Autumn 2026". */
  label: string;
  year: number;
  /** 1–4. Seasonal editions map Spring→1, Summer→2, Autumn→3, Winter→4 for ordering. */
  quarter: number;
};

export type GtReport = {
  publisher: typeof GT_PUBLISHER;
  period: GtPeriod;
  forecastYears: number[];
  rows: GtRow[];
};

export function isGtTpiReport(text: string): boolean {
  return (
    /gardiner/i.test(text) &&
    /tender\s+price/i.test(text) &&
    HEADER.test(text) &&
    /Regional\s+forecasts/i.test(text)
  );
}

const SEASONS: Record<string, number> = { spring: 1, summer: 2, autumn: 3, winter: 4 };

function periodFromMatch(q: string | undefined, season: string | undefined, year: string) {
  if (q) return { label: `Q${q} ${year}`, year: Number(year), quarter: Number(q) };
  const s = season!.toLowerCase();
  return {
    label: `${s[0].toUpperCase()}${s.slice(1)} ${year}`,
    year: Number(year),
    quarter: SEASONS[s],
  };
}

/**
 * The report's own period. Taken from the first "Tender price annual percentage
 * change <period>" heading — later copies of the table can carry a stale heading
 * (the Q1 2022 report's back page is labelled Q4 2021) — then the cover's
 * "2nd Quarter 2026", then the filename.
 */
export function extractGtPeriod(text: string, filename?: string): GtPeriod | null {
  const heading =
    /tender\s+price\s+annual\s+percentage\s+change[\s\S]{0,40}?\b(?:Q([1-4])\s*[-\s]?\s*(20\d\d)|(spring|summer|autumn|winter)\s+(20\d\d))/i.exec(
      text,
    );
  if (heading) return periodFromMatch(heading[1], heading[3], heading[2] ?? heading[4]);

  const cover = /\b([1-4])(?:st|nd|rd|th)\s+quarter\s+(20\d\d)/i.exec(text);
  if (cover) return periodFromMatch(cover[1], undefined, cover[2]);

  if (filename) {
    const fq = /Q([1-4])[-_\s]?(20\d\d)/i.exec(filename);
    if (fq) return periodFromMatch(fq[1], undefined, fq[2]);
    const fs = /(spring|summer|autumn|winter)/i.exec(filename);
    const fy = /^(\d\d)(\d\d)_/.exec(filename);
    if (fs && fy) return periodFromMatch(undefined, fs[1], `20${fy[1]}`);
  }
  return null;
}

function toValue(raw: string): number | null {
  if (raw.toUpperCase() === "N/A") return null;
  const n = Number(raw);
  // Annual tender price change is single-digit %; anything wild is a mis-read.
  return Number.isFinite(n) && n > -20 && n < 30 ? n : null;
}

/**
 * Extract the regional forecast table. Returns null if this isn't a G&T report
 * or the table can't be found. Rows that can't be read are omitted, so callers
 * should check `rows.length` against `GT_REGIONS.length`.
 */
export function parseGtTpiReport(text: string, filename?: string): GtReport | null {
  if (!isGtTpiReport(text)) return null;

  const header = HEADER.exec(text);
  const period = extractGtPeriod(text, filename);
  if (!header || !period) return null;

  const forecastYears = header.slice(1, 5).map(Number);
  // Only read the first table: later copies may carry a stale header.
  const body = text.slice(header.index);

  const rows: GtRow[] = [];
  for (const region of GT_REGIONS) {
    const match = new RegExp(`${REGION_PATTERNS[region]}\\s+${EIGHT_VALUES}`).exec(body);
    if (!match) continue;
    const values = match.slice(1, 9).map(toValue);
    rows.push({
      region,
      forecasts: forecastYears.map((year, i) => ({
        year,
        changePct: values[i * 2],
        previousChangePct: values[i * 2 + 1],
      })),
    });
  }

  return { publisher: GT_PUBLISHER, period, forecastYears, rows };
}
