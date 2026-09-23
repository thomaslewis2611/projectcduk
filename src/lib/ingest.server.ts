/**
 * Report ingestion: PDF → text → TPI forecasts → Supabase.
 *
 * Shared by the admin upload server function and `scripts/import-reports.ts`,
 * so it uses relative imports only (no "@/" alias) and runs in plain Node.
 * Server-only: uses the service-role client.
 */
import type { PdfPageData } from "pdf-parse";
import { supabaseAdmin } from "../integrations/supabase/client.server";
import { sanitiseFilename } from "./filename";
import { GT_REGIONS, parseGtTpiReport, type GtReport } from "./tpi/gt-parser";

export type Extracted = {
  filename: string;
  report: GtReport;
  missingRegions: string[];
};

export type IngestResult = {
  reportId: number;
  status: "completed" | "no_data";
  dataPoints: number;
  /** e.g. "Gardiner & Theobald Q2 2026". */
  label: string;
  missingRegions: string[];
};

export class UnrecognisedReportError extends Error {
  constructor(filename: string) {
    super(
      `"${filename}" doesn't look like a supported report. Only Gardiner & Theobald Tender Price Indicator reports can be imported so far.`,
    );
    this.name = "UnrecognisedReportError";
  }
}

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

/** Parse a PDF without touching the database. Throws if the layout isn't supported. */
export async function extractReport(rawFilename: string, buffer: Buffer): Promise<Extracted> {
  const filename = sanitiseFilename(rawFilename);
  const report = parseGtTpiReport(await pdfToText(buffer), filename);
  if (!report) throw new UnrecognisedReportError(filename);
  const found = new Set(report.rows.map((r) => r.region));
  return { filename, report, missingRegions: GT_REGIONS.filter((r) => !found.has(r)) };
}

export function describeExtracted({ report, missingRegions }: Extracted): string {
  const missing = missingRegions.length ? `, missing: ${missingRegions.join(", ")}` : "";
  return `${report.publisher} ${report.period.label}: ${report.rows.length}/${GT_REGIONS.length} regions × ${report.forecastYears.join("/")}${missing}`;
}

/** Store an extracted report (and its source PDF). Throws on duplicates. */
export async function saveReport(extracted: Extracted, buffer: Buffer): Promise<IngestResult> {
  const { filename, report, missingRegions } = extracted;
  const label = `${report.publisher} ${report.period.label}`;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("reports")
    .select("id")
    .eq("filename", filename)
    .maybeSingle();
  if (existingError) throw dbError("look up existing report", existingError);
  if (existing) {
    throw new Error(`A report named "${filename}" already exists. Delete it first to re-import.`);
  }

  const { data: reportData, error: reportError } = await supabaseAdmin
    .from("reports")
    .insert({
      filename,
      status: "processing",
      extracted_at: new Date().toISOString(),
      title: `${report.publisher} Tender Price Indicator ${report.period.label}`,
      publisher: report.publisher,
      quarter: report.period.label,
      year: report.period.year,
      period_quarter: report.period.quarter,
    })
    .select("id")
    .single();
  if (reportError) {
    if (reportError.code === "23505") {
      throw new Error(`${label} has already been imported. Delete it first to re-import.`);
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

    const dataPoints = await insertForecasts(reportId, report);
    const status = dataPoints > 0 ? "completed" : "no_data";
    const { error: statusError } = await supabaseAdmin
      .from("reports")
      .update({ status })
      .eq("id", reportId);
    if (statusError) throw dbError("update report status", statusError);

    return { reportId, status, dataPoints, label, missingRegions };
  } catch (err) {
    await supabaseAdmin.from("reports").update({ status: "failed" }).eq("id", reportId);
    throw err;
  }
}

async function insertForecasts(reportId: number, report: GtReport): Promise<number> {
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

function dbError(action: string, error: { message: string }): Error {
  console.error(`[ingest] Failed to ${action}:`, error);
  return new Error(`Failed to ${action}: ${error.message}`);
}
