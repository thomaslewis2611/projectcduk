/**
 * Server functions for uploading and parsing PDF reports.
 * Uses pdf-parse for text extraction. Works in Node.js environments;
 * for Cloudflare Workers, pdf-parse should be replaced with pdfjs-dist
 * (pure JS).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  BUILDING_CATEGORIES,
  SIZE_BANDS,
  UK_REGIONS,
  extractMetadata,
  parseDataPoints,
  sanitiseFilename,
  type DataPoint,
} from "@/lib/pdf-extract";

// Canonical lookup tables (matching vett patterns — data is normalised to these)
// ---------------------------------------------------------------------------
// Upload function
// ---------------------------------------------------------------------------

const uploadInputSchema = z.object({
  filename: z.string().min(1).max(255),
  base64: z.string().min(1),
});

type UploadStatus = "completed" | "no_data";

export const uploadAndParseReport = createServerFn({ method: "POST" })
  .validator(uploadInputSchema)
  .handler(
    async ({ data }): Promise<{ reportId: number; status: UploadStatus; dataPoints: number }> => {
      const filename = sanitiseFilename(data.filename);

      const { data: existing, error: existingError } = await supabaseAdmin
        .from("reports")
        .select("id")
        .eq("filename", filename)
        .maybeSingle();
      if (existingError) throw dbError("look up existing report", existingError);
      if (existing) {
        throw new Error(
          `A report named "${filename}" already exists. Delete it first to re-import.`,
        );
      }

      // 1. Create a database record for the report
      const { data: reportData, error: reportError } = await supabaseAdmin
        .from("reports")
        .insert({ filename, status: "processing" })
        .select("id")
        .single();
      if (reportError) throw dbError("create report record", reportError);

      const reportId = reportData.id;

      try {
        // 2. Decode the base64 PDF and upload to Supabase Storage
        const buffer = Buffer.from(data.base64, "base64");

        const { error: uploadError } = await supabaseAdmin.storage
          .from("reports")
          .upload(`raw/${filename}`, buffer, { contentType: "application/pdf", upsert: true });
        if (uploadError) {
          // Keep going: parsing only needs the buffer, the stored copy is for reference.
          console.error("[uploadAndParseReport] Storage upload error:", uploadError);
        }

        // 3. Parse the PDF
        const pdfData = await parsePdfBuffer(buffer);

        // 4. Extract metadata
        const meta = extractMetadata(pdfData.text);
        const { error: metaError } = await supabaseAdmin
          .from("reports")
          .update({
            title: meta.title,
            report_date: meta.report_date,
            quarter: meta.quarter,
            year: meta.year,
            extracted_at: new Date().toISOString(),
          })
          .eq("id", reportId);
        if (metaError) throw dbError("save report metadata", metaError);

        // 5. Ensure lookup tables are populated
        await ensureLookupTables();

        // 6. Parse data points from the text and store them
        const dataPoints = parseDataPoints(pdfData.text);
        await insertPriceIndices(reportId, dataPoints);

        const status: UploadStatus = dataPoints.length > 0 ? "completed" : "no_data";
        const { error: statusError } = await supabaseAdmin
          .from("reports")
          .update({ status })
          .eq("id", reportId);
        if (statusError) throw dbError("update report status", statusError);

        return { reportId, status, dataPoints: dataPoints.length };
      } catch (err: unknown) {
        console.error("[uploadAndParseReport] Error:", err);
        await supabaseAdmin.from("reports").update({ status: "failed" }).eq("id", reportId);
        throw new Error(
          `Failed to process report: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  );

function dbError(action: string, error: { message: string }): Error {
  console.error(`[uploadAndParseReport] Failed to ${action}:`, error);
  return new Error(`Failed to ${action}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// PDF parsing helpers
// ---------------------------------------------------------------------------

type ParsedPdf = { text: string; numPages: number };

async function parsePdfBuffer(buffer: Buffer): Promise<ParsedPdf> {
  // Dynamic import — pdf-parse is Node-only and heavy
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);
  return { text: result.text, numPages: result.numpages };
}

// ---------------------------------------------------------------------------
// Database helpers
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
