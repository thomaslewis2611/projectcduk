/**
 * Pure text-extraction helpers for price-index PDFs: no I/O, so they can be
 * unit-tested against sample report text.
 */
export const UK_REGIONS = [
  "North East England",
  "North West England",
  "Yorkshire and the Humber",
  "East Midlands",
  "West Midlands",
  "Eastern England",
  "South East England",
  "South West England",
  "London",
  "Wales",
  "Scotland",
  "Northern Ireland",
] as const;

export const BUILDING_CATEGORIES: Record<string, string[]> = {
  "Industrial & Logistics": [
    "Industrial & Logistics Shed",
    "Industrial & Logistics Unit",
    "Warehouse",
    "Logistics Hub",
  ],
  Commercial: ["Office", "Retail", "Shopping Centre", "Hotel", "Leisure"],
  Residential: ["Private Residential", "Social Residential", "Student Accommodation", "Care Home"],
  "Infrastructure / Civil": ["Infrastructure", "Civil Engineering", "Highways"],
};

export const SIZE_BANDS: Array<{ label: string; min: number | null; max: number | null }> = [
  { label: "0-500 sqft", min: 0, max: 500 },
  { label: "500-1,000 sqft", min: 500, max: 1000 },
  { label: "1,000-2,500 sqft", min: 1000, max: 2500 },
  { label: "2,500-5,000 sqft", min: 2500, max: 5000 },
  { label: "5,000-10,000 sqft", min: 5000, max: 10000 },
  { label: "10,000-25,000 sqft", min: 10000, max: 25000 },
  { label: "25,000-50,000 sqft", min: 25000, max: 50000 },
  { label: "50,000-100,000 sqft", min: 50000, max: 100000 },
  { label: "100,000-150,000 sqft", min: 100000, max: 150000 },
  { label: "150,000-250,000 sqft", min: 150000, max: 250000 },
  { label: "250,000-500,000 sqft", min: 250000, max: 500000 },
  { label: "500,000+ sqft", min: 500000, max: null },
];

/** Keep storage keys and DB filenames to a safe, flat character set. */
export function sanitiseFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "");
  return cleaned || "report.pdf";
}

export function extractMetadata(text: string): {
  title: string | null;
  report_date: string | null;
  quarter: string | null;
  year: number | null;
} {
  const meta: {
    title: string | null;
    report_date: string | null;
    quarter: string | null;
    year: number | null;
  } = { title: null, report_date: null, quarter: null, year: null };

  // Try to find quarter: "Q3 2024", "Q1-2024", "Q2 2023"
  const qMatch = text.match(/Q([1-4])\s*[-\s]?\s*(\d{4})/i);
  if (qMatch) {
    meta.quarter = `Q${qMatch[1]} ${qMatch[2]}`;
    meta.year = parseInt(qMatch[2], 10);
  }

  // Try to find a date: "14/08/2024" or "2024-08-14"
  const dMatch = text.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/);
  if (dMatch) {
    meta.report_date = dMatch[1];
  }

  // Try to find a title (usually "BCIS" or "Construction Price Index" + quarter/year)
  const titleMatch = text.match(
    /(?:BCIS|Building Cost Information Service|Construction Price Index|Price Index|Report).*?(Q[1-4]\s*\d{4})/i,
  );
  if (titleMatch) {
    meta.title = titleMatch[0];
  }

  // If no year found from quarter, try plain year
  if (!meta.year) {
    const yMatch = text.match(/\b(20\d{2})\b/);
    if (yMatch) {
      meta.year = parseInt(yMatch[1], 10);
    }
  }

  return meta;
}

export type DataPoint = {
  region: string | null;
  building_type: string | null;
  building_category: string | null;
  size_band: string | null;
  min_sqft: number | null;
  max_sqft: number | null;
  index_value: number | null;
  price_per_sqft: number | null;
  base_period: string | null;
  notes: string | null;
};

export function parseDataPoints(text: string): DataPoint[] {
  const lines = text.split("\n");
  const points: DataPoint[] = [];

  // Split into table-like rows (lines separated by tabs or multiple spaces)
  for (const line of lines) {
    const cells = splitCells(line);
    const dp = parseRow(cells);
    if (dp && (dp.region || dp.building_type)) {
      points.push(dp);
    }
  }

  return points;
}

export function splitCells(line: string): string[] {
  // Split on 2+ spaces, tabs, or pipe characters
  return line
    .split(/\t| {2,}|\|/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

export function parseRow(cells: string[]): DataPoint | null {
  if (cells.length < 3) return null;

  const dp: DataPoint = {
    region: null,
    building_type: null,
    building_category: null,
    size_band: null,
    min_sqft: null,
    max_sqft: null,
    index_value: null,
    price_per_sqft: null,
    base_period: null,
    notes: null,
  };

  // Try to identify each cell
  for (const cell of cells) {
    const val = cell.trim();

    // Check region: exact match, allowing the "England" suffix to be dropped
    // ("North West" -> "North West England"). Prefix matching is too loose — "N"
    // would match "North East England".
    if (!dp.region) {
      const lower = val.toLowerCase();
      const regionMatch = UK_REGIONS.find(
        (r) => lower === r.toLowerCase() || `${lower} england` === r.toLowerCase(),
      );
      if (regionMatch) {
        dp.region = regionMatch;
        continue;
      }
    }

    // Check building type (and category)
    if (!dp.building_type) {
      for (const [cat, types] of Object.entries(BUILDING_CATEGORIES)) {
        for (const bt of types) {
          if (val.toLowerCase().includes(bt.toLowerCase())) {
            dp.building_type = bt;
            dp.building_category = cat;
            break;
          }
        }
        if (dp.building_type) break;
      }
      if (dp.building_type) continue;
    }

    // Check size band
    if (!dp.size_band) {
      for (const sb of SIZE_BANDS) {
        if (val.toLowerCase().includes(sb.label.toLowerCase())) {
          dp.size_band = sb.label;
          dp.min_sqft = sb.min;
          dp.max_sqft = sb.max;
          break;
        }
      }
      // A size-band cell contains digits but is never the index or price.
      if (dp.size_band) continue;
    }

    // Check for numeric values
    const num = parseNumber(val);
    if (num !== null) {
      if (dp.index_value === null) {
        dp.index_value = num;
      } else if (dp.price_per_sqft === null) {
        dp.price_per_sqft = num;
      }
    }
  }

  return dp;
}

const NUMBER = String.raw`-?\d+(?:\.\d+)?`;
const SINGLE_NUMBER = new RegExp(`^${NUMBER}$`);
const NUMBER_RANGE = new RegExp(`^(${NUMBER})-(${NUMBER})$`);

/**
 * Parse a whole cell as a number or a "low-high" range (returning the midpoint).
 * Anything else — including text that merely contains digits — is null.
 */
export function parseNumber(val: string): number | null {
  // Remove currency symbols, thousands separators and spaces
  const s = val.replace(/[£$,\s]/g, "");
  if (SINGLE_NUMBER.test(s)) return Number(s);
  const range = NUMBER_RANGE.exec(s);
  if (range) return (Number(range[1]) + Number(range[2])) / 2;
  return null;
}
