/**
 * Report ingestion: PDF → text → structured rows → Supabase.
 *
 * Shared by the admin upload server function and `scripts/import-reports.ts`,
 * so it uses relative imports only (no "@/" alias) and runs in plain Node.
 * Server-only: uses the service-role client.
 */
import type { PdfPageData } from "pdf-parse";
import { supabaseAdmin } from "../integrations/supabase/client.server";
import {
  BUILDING_CATEGORIES,
  SIZE_BANDS,
  UK_REGIONS,
  extractMetadata,
  parseDataPoints,
  sanitiseFilename,
  type DataPoint,
} from "./pdf-extract";
import { GT_REGIONS, parseGtTpiReport, type GtReport } from "./tpi/gt-parser";

export type Extracted =
  | { kind: "gt_tpi"; filename: string; report: GtReport; missingRegions: string[] }
  | { kind: "generic"; filename: string; text: string; points: DataPoint[] };

export type IngestResult = {
  reportId: number;
  status: "completed" | "no_data";
  dataPoints: number;
  kind: Extracted["kind"];
  /** e.g. "Gardiner & Theobald Q2 2026", when recognised. */
  label: string | null;
  missingRegions: string[];
};

export async function pdfToText(buffer: Buffer): Promise<string> {
  // Dynamic import — pdf-parse is Node-only and heavy
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer, { pagerender: renderPageText });
  return result.text;
}

/** Gap (PDF points) between text items on one line that counts as a word break. */
const WORD_GAP = 1;

/**
 * pdf-parse's default renderer concatenates text items on the same line with
 * no separator, so table cells run together ("3.753.253.00"). Insert a space
 * wherever there is a visible horizontal gap between items instead.
 */
async function renderPageText(page: PdfPageData): Promise<string> {
  const { items } = await page.getTextContent({
    normalizeWhitespace: false,
    disableCombineTextItems: false,
  });
  let text = "";
  let lastY: number | null = null;
  let lastEnd: number | null = null;
  for (const item of items) {
    const x = item.transform[4];
    const y = item.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 1) {
      text += "\n";
    } else if (lastEnd !== null && x - lastEnd > WORD_GAP && !text.endsWith(" ")) {
      text += " ";
    }
    text += item.str;
    lastY = y;
    lastEnd = x + item.width;
  }
  return text;
}

/** Parse a PDF without touching the database. */
export async function extractReport(rawFilename: string, buffer: Buffer): Promise<Extracted> {
  const filename = sanitiseFilename(rawFilename);
  const text = await pdfToText(buffer);

  const report = parseGtTpiReport(text, filename);
  if (report) {
    const found = new Set(report.rows.map((r) => r.region));
    return {
      kind: "gt_tpi",
      filename,
      report,
      missingRegions: GT_REGIONS.filter((r) => !found.has(r)),
    };
  }
  return { kind: "generic", filename, text, points: parseDataPoints(text) };
}

export function describeExtracted(extracted: Extracted): string {
  if (extracted.kind === "gt_tpi") {
    const { report, missingRegions } = extracted;
    const missing = missingRegions.length ? `, missing: ${missingRegions.join(", ")}` : "";
    return `${report.publisher} ${report.period.label}: ${report.rows.length}/${GT_REGIONS.length} regions × ${report.forecastYears.join("/")}${missing}`;
  }
  return `Unrecognised layout: ${extracted.points.length} generic rows`;
}

/** Store an extracted report (and its source PDF). Throws on duplicates. */
export async function saveReport(extracted: Extracted, buffer: Buffer): Promise<IngestResult> {
  const { filename } = extracted;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("reports")
    .select("id")
    .eq("filename", filename)
    .maybeSingle();
  if (existingError) throw dbError("look up existing report", existingError);
  if (existing) {
    throw new Error(`A report named "${filename}" already exists. Delete it first to re-import.`);
  }

  const meta =
    extracted.kind === "gt_tpi"
      ? {
          title: `${extracted.report.publisher} Tender Price Indicator ${extracted.report.period.label}`,
          publisher: extracted.report.publisher,
          quarter: extracted.report.period.label,
          year: extracted.report.period.year,
          period_quarter: extracted.report.period.quarter,
          report_date: null,
        }
      : { ...extractMetadata(extracted.text), publisher: null, period_quarter: null };

  const { data: reportData, error: reportError } = await supabaseAdmin
    .from("reports")
    .insert({
      filename,
      status: "processing",
      extracted_at: new Date().toISOString(),
      ...meta,
    })
    .select("id")
    .single();
  if (reportError) {
    if (reportError.code === "23505" && extracted.kind === "gt_tpi") {
      throw new Error(
        `${meta.publisher} ${meta.quarter} has already been imported. Delete it first to re-import.`,
      );
    }
    throw dbError("create report record", reportError);
  }
  const reportId = reportData.id;

  try {
    const { error: uploadError } = await supabaseAdmin.storage
      .from("reports")
      .upload(`raw/${filename}`, buffer, { contentType: "application/pdf", upsert: true });
    if (uploadError) {
      // Keep going: the stored copy is for reference; the data is already extracted.
      console.error("[saveReport] Storage upload error:", uploadError);
    }

    const dataPoints =
      extracted.kind === "gt_tpi"
        ? await insertGtForecasts(reportId, extracted.report)
        : await insertGenericRows(reportId, extracted.points);

    const status = dataPoints > 0 ? "completed" : "no_data";
    const { error: statusError } = await supabaseAdmin
      .from("reports")
      .update({ status })
      .eq("id", reportId);
    if (statusError) throw dbError("update report status", statusError);

    return {
      reportId,
      status,
      dataPoints,
      kind: extracted.kind,
      label:
        extracted.kind === "gt_tpi"
          ? `${extracted.report.publisher} ${extracted.report.period.label}`
          : null,
      missingRegions: extracted.kind === "gt_tpi" ? extracted.missingRegions : [],
    };
  } catch (err) {
    await supabaseAdmin.from("reports").update({ status: "failed" }).eq("id", reportId);
    throw err;
  }
}

async function insertGtForecasts(reportId: number, report: GtReport): Promise<number> {
  const rows = report.rows.flatMap((row) =>
    row.forecasts.map((f) => ({
      report_id: reportId,
      region: row.region,
      forecast_year: f.year,
      change_pct: f.changePct,
      previous_change_pct: f.previousChangePct,
    })),
  );
  if (rows.length === 0) return 0;
  const { error } = await supabaseAdmin.from("tpi_forecasts").insert(rows);
  if (error) throw dbError("store TPI forecasts", error);
  return rows.length;
}

async function insertGenericRows(reportId: number, points: DataPoint[]): Promise<number> {
  if (points.length === 0) return 0;
  await ensureLookupTables();
  await insertPriceIndices(reportId, points);
  return points.length;
}

function dbError(action: string, error: { message: string }): Error {
  console.error(`[ingest] Failed to ${action}:`, error);
  return new Error(`Failed to ${action}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Generic (building type × size band) rows
// ---------------------------------------------------------------------------

async function ensureLookupTables(): Promise<void> {
  const { error: regionError } = await supabaseAdmin.from("regions").upsert(
    UK_REGIONS.map((name) => ({ name })),
    { onConflict: "name" },
  );
  if (regionError) throw dbError("seed regions", regionError);

  const { error: typeError } = await supabaseAdmin.from("building_types").upsert(
    Object.entries(BUILDING_CATEGORIES).flatMap(([category, types]) =>
      types.map((name) => ({ name, category })),
    ),
    { onConflict: "name" },
  );
  if (typeError) throw dbError("seed building types", typeError);

  const { error: bandError } = await supabaseAdmin.from("size_bands").upsert(
    SIZE_BANDS.map((sb) => ({ label: sb.label, min_sqft: sb.min, max_sqft: sb.max })),
    { onConflict: "label" },
  );
  if (bandError) throw dbError("seed size bands", bandError);
}

async function loadIdMap(
  table: "regions" | "building_types",
  column: "name",
): Promise<Map<string, number>>;
async function loadIdMap(table: "size_bands", column: "label"): Promise<Map<string, number>>;
async function loadIdMap(
  table: "regions" | "building_types" | "size_bands",
  column: "name" | "label",
): Promise<Map<string, number>> {
  const { data, error } = await supabaseAdmin.from(table).select(`id, ${column}`);
  if (error) throw dbError(`load ${table}`, error);
  const rows = (data ?? []) as unknown as Array<{ id: number } & Record<string, string>>;
  return new Map(rows.map((row) => [row[column], row.id]));
}

async function insertPriceIndices(reportId: number, points: DataPoint[]): Promise<void> {
  if (points.length === 0) return;

  const [regionIds, buildingTypeIds, sizeBandIds] = await Promise.all([
    loadIdMap("regions", "name"),
    loadIdMap("building_types", "name"),
    loadIdMap("size_bands", "label"),
  ]);

  const rows = points.map((dp) => ({
    report_id: reportId,
    region_id: dp.region ? (regionIds.get(dp.region) ?? null) : null,
    building_type_id: dp.building_type ? (buildingTypeIds.get(dp.building_type) ?? null) : null,
    size_band_id: dp.size_band ? (sizeBandIds.get(dp.size_band) ?? null) : null,
    index_value: dp.index_value,
    price_per_sqft: dp.price_per_sqft,
    base_period: dp.base_period ?? "Q1 2021 = 100",
    currency: "GBP",
    notes: dp.notes,
  }));

  // The same (region, type, size) can appear more than once in a report's text;
  // keep the last occurrence so the upsert doesn't conflict with itself.
  const unique = new Map(
    rows.map((row) => [`${row.region_id}|${row.building_type_id}|${row.size_band_id}`, row]),
  );

  const { error } = await supabaseAdmin.from("price_indices").upsert([...unique.values()], {
    onConflict: "report_id,region_id,building_type_id,size_band_id",
  });
  if (error) throw dbError("store price indices", error);
}
