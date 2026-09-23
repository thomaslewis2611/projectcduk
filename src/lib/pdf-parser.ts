/**
 * Server functions for uploading and parsing PDF reports.
 * Uses pdf-parse for text extraction. Works in Node.js environments;
 * for Cloudflare Workers, pdf-parse should be replaced with pdfjs-dist
 * (pure JS).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Canonical lookup tables (matching vett patterns — data is normalised to these)
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

// ---------------------------------------------------------------------------
// Upload function
// ---------------------------------------------------------------------------

const uploadInputSchema = z.object({
  filename: z.string(),
  base64: z.string(),
});

export const uploadAndParseReport = createServerFn({ method: "POST" })
  .validator(uploadInputSchema)
  .handler(async ({ data }): Promise<{ reportId: number; status: string }> => {
    try {
      // 1. Create a database record for the report
      const { data: reportData, error: reportError } = await supabaseAdmin
        .from("reports")
        .insert({
          filename: data.filename,
          status: "processing",
        })
        .select("id")
        .single();

      if (reportError || !reportData) {
        console.error("[uploadAndParseReport] Failed to create report record:", reportError);
        throw new Error("Failed to create report record");
      }

      const reportId = reportData.id;

      // 2. Decode the base64 PDF and upload to Supabase Storage
      // In a browser, the file would be uploaded directly via the storage API.
      // For now, we accept base64 (works in server functions and Workers).
      const buffer = Buffer.from(data.base64, "base64");

      const { error: uploadError } = await supabaseAdmin.storage
        .from("reports")
        .upload(`raw/${data.filename}`, buffer, {
          contentType: "application/pdf",
        });

      if (uploadError) {
        console.error("[uploadAndParseReport] Storage upload error:", uploadError);
        // Continue with parsing even if storage fails — we still have the buffer
      }

      // 3. Parse the PDF
      const pdfData = await parsePdfBuffer(buffer);

      // 4. Extract metadata
      const meta = extractMetadata(pdfData.text);
      await supabaseAdmin
        .from("reports")
        .update({
          title: meta.title,
          report_date: meta.report_date,
          quarter: meta.quarter,
          year: meta.year,
          extracted_at: new Date().toISOString(),
        })
        .eq("id", reportId);

      // 5. Ensure lookup tables are populated
      await ensureLookupTables();

      // 6. Parse data points from the text
      const dataPoints = parseDataPoints(pdfData.text, reportId);

      // 7. Store data points
      for (const dp of dataPoints) {
        await upsertPriceIndex(dp);
      }

      // Update report status
      await supabaseAdmin
        .from("reports")
        .update({ status: dataPoints.length > 0 ? "completed" : "completed" })
        .eq("id", reportId);

      return { reportId, status: "completed" };
    } catch (err: unknown) {
      console.error("[uploadAndParseReport] Error:", err);
      // Update report status to failed
      if (data.filename) {
        // Find by filename in case id wasn't captured
        await supabaseAdmin
          .from("reports")
          .update({ status: "failed" })
          .eq("filename", data.filename);
      }
      throw new Error(
        `Failed to process report: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  });

// ---------------------------------------------------------------------------
// PDF parsing helpers
// ---------------------------------------------------------------------------

type ParsedPdf = { text: string; numPages: number };

async function parsePdfBuffer(buffer: Buffer): Promise<ParsedPdf> {
  // Dynamic import — pdf-parse is Node-only and heavy
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);
  return { text: result.text, numPages: result.numpdf };
}

function extractMetadata(text: string): {
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

type DataPoint = {
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

function parseDataPoints(text: string, reportId: number): DataPoint[] {
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

function splitCells(line: string): string[] {
  // Split on 2+ spaces, tabs, or pipe characters
  return line
    .split(/\t| {2,}|\|/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

function parseRow(cells: string[]): DataPoint | null {
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

    // Check region (exact match against known list)
    if (!dp.region) {
      const regionMatch = UK_REGIONS.find(
        (r) =>
          val.toLowerCase() === r.toLowerCase() || r.toLowerCase().startsWith(val.toLowerCase()),
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

function parseNumber(val: string): number | null {
  if (!val) return null;
  // Remove currency symbols, commas, spaces
  const s = val.replace(/[£$,\s]/g, "");
  // Handle ranges like "100-200"
  if (s.includes("-")) {
    const parts = s
      .split("-")
      .map(Number)
      .filter((n) => !isNaN(n));
    if (parts.length > 0) return parts.reduce((a, b) => a + b, 0) / parts.length;
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

async function ensureLookupTables(): Promise<void> {
  // Upsert regions
  for (const region of UK_REGIONS) {
    await supabaseAdmin.from("regions").upsert({ name: region }, { onConflict: "name" });
  }

  // Upsert building types
  for (const [category, types] of Object.entries(BUILDING_CATEGORIES)) {
    for (const bt of types) {
      await supabaseAdmin
        .from("building_types")
        .upsert({ name: bt, category }, { onConflict: "name" });
    }
  }

  // Upsert size bands
  for (const sb of SIZE_BANDS) {
    await supabaseAdmin
      .from("size_bands")
      .upsert({ label: sb.label, min_sqft: sb.min, max_sqft: sb.max }, { onConflict: "label" });
  }
}

async function upsertPriceIndex(dp: DataPoint & { report_id: number }): Promise<void> {
  // Resolve foreign key IDs
  let regionId: number | null = null;
  let buildingTypeId: number | null = null;
  let sizeBandId: number | null = null;

  if (dp.region) {
    const { data } = await supabaseAdmin
      .from("regions")
      .select("id")
      .eq("name", dp.region)
      .maybeSingle();
    regionId = data?.id ?? null;
  }

  if (dp.building_type) {
    const { data } = await supabaseAdmin
      .from("building_types")
      .select("id")
      .eq("name", dp.building_type)
      .maybeSingle();
    buildingTypeId = data?.id ?? null;
  }

  if (dp.size_band) {
    const { data } = await supabaseAdmin
      .from("size_bands")
      .select("id")
      .eq("label", dp.size_band)
      .maybeSingle();
    sizeBandId = data?.id ?? null;
  }

  await supabaseAdmin.from("price_indices").upsert(
    {
      report_id: dp.report_id,
      region_id: regionId,
      building_type_id: buildingTypeId,
      size_band_id: sizeBandId,
      index_value: dp.index_value,
      price_per_sqft: dp.price_per_sqft,
      base_period: dp.base_period ?? "Q1 2021 = 100",
      currency: "GBP",
      notes: dp.notes,
    },
    { onConflict: "report_id,region_id,building_type_id,size_band_id" },
  );
}
