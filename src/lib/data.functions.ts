/**
 * Server functions for querying price index data from Supabase.
 * This file contains ONLY server-side code (no client imports).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/admin.server";
import type { Database } from "@/integrations/supabase/types";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Row shape of the flat `price_index_rows` view (see migration 002). */
type PriceIndexRow = Database["public"]["Views"]["price_index_rows"]["Row"];

// ---------------------------------------------------------------------------
// Schema definitions
// ---------------------------------------------------------------------------

export const ReportSchema = z.object({
  id: z.number(),
  filename: z.string(),
  title: z.string().nullable(),
  report_date: z.string().nullable(),
  quarter: z.string().nullable(),
  year: z.number().nullable(),
  status: z.string(),
  extracted_at: z.string().nullable(),
  created_at: z.string(),
  publisher: z.string().nullable(),
  period_quarter: z.number().nullable(),
});

export const PriceIndexSchema = z.object({
  id: z.number(),
  report_id: z.number(),
  year: z.number().nullable(),
  quarter: z.string().nullable(),
  report_date: z.string().nullable(),
  region: z.object({ id: z.number().nullable(), name: z.string() }).nullable(),
  building_type: z
    .object({
      id: z.number().nullable(),
      name: z.string(),
      category: z.string().nullable(),
    })
    .nullable(),
  size_band: z
    .object({
      id: z.number().nullable(),
      label: z.string(),
      min_sqft: z.number().nullable(),
      max_sqft: z.number().nullable(),
    })
    .nullable(),
  index_value: z.number().nullable(),
  price_per_sqft: z.number().nullable(),
  currency: z.string().default("GBP"),
  notes: z.string().nullable(),
});

export type Report = z.infer<typeof ReportSchema>;
export type PriceIndex = z.infer<typeof PriceIndexSchema>;

// ---------------------------------------------------------------------------
// Server functions
// ---------------------------------------------------------------------------

export const fetchReports = createServerFn({ method: "GET" }).handler(
  async (): Promise<Report[]> => {
    const { data, error } = await supabaseAdmin
      .from("reports")
      .select("*")
      .order("year", { ascending: false, nullsFirst: false })
      .order("period_quarter", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[fetchReports] Supabase error:", error);
      return [];
    }
    return data ?? [];
  },
);

export const deleteReport = createServerFn({ method: "POST" })
  .validator(z.object({ accessToken: z.string().min(1), id: z.number(), filename: z.string() }))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await requireAdmin(data.accessToken);

    // Delete from storage bucket
    const { error: storageError } = await supabaseAdmin.storage
      .from("reports")
      .remove([`raw/${data.filename}`]);

    if (storageError) {
      console.warn("[deleteReport] Storage delete error (continuing):", storageError);
    }

    // Delete from database
    const { error } = await supabaseAdmin.from("reports").delete().eq("id", data.id);

    if (error) {
      console.error("[deleteReport] Supabase error:", error);
      throw new Error("Failed to delete report");
    }

    return { success: true };
  });

const indexFilterSchema = z.object({
  region: z.string().optional(),
  building_type: z.string().optional(),
  size_band: z.string().optional(),
  year: z.number().optional(),
  quarter: z.string().optional(),
});

type IndexFilter = z.infer<typeof indexFilterSchema>;

/** Filters use exact names — callers pass values from the reference-data dropdowns. */
function filteredRows(filter: IndexFilter) {
  let query = supabaseAdmin.from("price_index_rows").select("*");
  if (filter.year !== undefined) query = query.eq("year", filter.year);
  if (filter.quarter) query = query.eq("quarter", filter.quarter);
  if (filter.region) query = query.eq("region", filter.region);
  if (filter.building_type) query = query.eq("building_type", filter.building_type);
  if (filter.size_band) query = query.eq("size_band", filter.size_band);
  return query;
}

function toPriceIndex(row: PriceIndexRow): PriceIndex {
  return {
    id: row.id,
    report_id: row.report_id,
    year: row.year,
    quarter: row.quarter,
    report_date: row.report_date,
    region: row.region ? { id: row.region_id, name: row.region } : null,
    building_type: row.building_type
      ? { id: row.building_type_id, name: row.building_type, category: row.building_category }
      : null,
    size_band: row.size_band
      ? {
          id: row.size_band_id,
          label: row.size_band,
          min_sqft: row.min_sqft,
          max_sqft: row.max_sqft,
        }
      : null,
    index_value: row.index_value,
    price_per_sqft: row.price_per_sqft,
    currency: row.currency ?? "GBP",
    notes: row.notes,
  };
}

export const fetchIndices = createServerFn({ method: "GET" })
  .validator(indexFilterSchema.extend({ limit: z.number().int().min(1).max(10000).default(500) }))
  .handler(async ({ data }): Promise<PriceIndex[]> => {
    const { data: rows, error } = await filteredRows(data)
      .order("year", { ascending: false, nullsFirst: false })
      .order("quarter", { ascending: false, nullsFirst: false })
      .order("id")
      .limit(data.limit);

    if (error) {
      console.error("[fetchIndices] Supabase error:", error);
      return [];
    }
    return (rows ?? []).map(toPriceIndex);
  });

export const fetchDataPointCount = createServerFn({ method: "GET" }).handler(
  async (): Promise<number> => {
    const { count, error } = await supabaseAdmin
      .from("price_indices")
      .select("id", { count: "exact", head: true });
    if (error) {
      console.error("[fetchDataPointCount] Supabase error:", error);
      return 0;
    }
    return count ?? 0;
  },
);

export type ComparisonRow = {
  id: number;
  index_value: number | null;
  price_per_sqft: number | null;
  year: number | null;
  quarter: string | null;
  report_date: string | null;
  region: string | null;
  building_type: string | null;
};

export const fetchComparison = createServerFn({ method: "GET" })
  .validator(indexFilterSchema.extend({ limit: z.number().int().min(1).max(10000).default(1000) }))
  .handler(async ({ data }): Promise<ComparisonRow[]> => {
    const { data: rows, error } = await filteredRows(data)
      .order("year", { nullsFirst: false })
      .order("quarter", { nullsFirst: false })
      .order("id")
      .limit(data.limit);

    if (error) {
      console.error("[fetchComparison] Supabase error:", error);
      return [];
    }

    return (rows ?? []).map((row) => ({
      id: row.id,
      index_value: row.index_value,
      price_per_sqft: row.price_per_sqft,
      year: row.year,
      quarter: row.quarter,
      report_date: row.report_date,
      region: row.region,
      building_type: row.building_type,
    }));
  });

// ---------------------------------------------------------------------------
// Reference data (for dropdowns, filters, etc.)
// ---------------------------------------------------------------------------

export const fetchRegions = createServerFn({ method: "GET" }).handler(
  async (): Promise<string[]> => {
    const { data, error } = await supabaseAdmin.from("regions").select("name").order("name");
    if (error) {
      console.error("[fetchRegions] error:", error);
      return [];
    }
    return (data ?? []).map((r: { name: string }) => r.name);
  },
);

export const fetchBuildingTypes = createServerFn({ method: "GET" }).handler(
  async (): Promise<string[]> => {
    const { data, error } = await supabaseAdmin
      .from("building_types")
      .select("name")
      .order("category")
      .order("name");
    if (error) {
      console.error("[fetchBuildingTypes] error:", error);
      return [];
    }
    return (data ?? []).map((r: { name: string }) => r.name);
  },
);

export const fetchSizeBands = createServerFn({ method: "GET" }).handler(
  async (): Promise<string[]> => {
    const { data, error } = await supabaseAdmin
      .from("size_bands")
      .select("label")
      .order("min_sqft");
    if (error) {
      console.error("[fetchSizeBands] error:", error);
      return [];
    }
    return (data ?? []).map((r: { label: string }) => r.label);
  },
);

export const fetchYears = createServerFn({ method: "GET" }).handler(async (): Promise<number[]> => {
  const { data, error } = await supabaseAdmin
    .from("reports")
    .select("year")
    .not("year", "is", null)
    .order("year", { ascending: false });
  if (error) {
    console.error("[fetchYears] error:", error);
    return [];
  }
  return Array.from(
    new Set((data ?? []).map((r) => r.year).filter((y): y is number => y !== null)),
  ).sort((a, b) => b - a);
});

export const fetchQuarters = createServerFn({ method: "GET" })
  .validator(z.object({ year: z.number().optional() }))
  .handler(async ({ data }): Promise<string[]> => {
    let query = supabaseAdmin.from("reports").select("quarter").not("quarter", "is", null);
    if (data.year) query = query.eq("year", data.year);
    const { data: respData, error } = await query.order("quarter");
    if (error) {
      console.error("[fetchQuarters] error:", error);
      return [];
    }
    return Array.from(new Set((respData ?? []).map((r) => r.quarter)))
      .filter((q): q is string => !!q)
      .sort();
  });
