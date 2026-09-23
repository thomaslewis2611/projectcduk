/**
 * Server functions for querying price index data from Supabase.
 * This file contains ONLY server-side code (no client imports).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------------------------------------------------------------------------
// Internal types for Supabase join responses
// ---------------------------------------------------------------------------

/** Row shape returned by supabase when joining price_indices with related tables. */
interface PriceIndexWithJoins {
  id: number;
  index_value: number | null;
  price_per_sqft: number | null;
  currency: string | null;
  notes: string | null;
  reports?: { year: number | null; quarter: string | null; report_date: string | null } | null;
  regions?: { id: number; name: string } | null;
  building_types?: { id: number; name: string; category: string | null } | null;
  size_bands?: {
    id: number;
    label: string;
    min_sqft: number | null;
    max_sqft: number | null;
  } | null;
}

/** Lightweight row returned by supabase for simple string column selects. */
interface StringColumnRow {
  [key: string]: string | null;
}

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
      .order("year", { ascending: false })
      .order("quarter", { ascending: false });

    if (error) {
      console.error("[fetchReports] Supabase error:", error);
      return [];
    }
    return data ?? [];
  },
);

export const deleteReport = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number(), filename: z.string() }))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
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

export const fetchIndices = createServerFn({ method: "GET" })
  .validator(
    z.object({
      region: z.string().optional(),
      building_type: z.string().optional(),
      size_band: z.string().optional(),
      year: z.number().optional(),
      quarter: z.string().optional(),
      limit: z.number().default(500),
    }),
  )
  .handler(async ({ data }): Promise<PriceIndex[]> => {
    let query = supabaseAdmin.from("price_indices").select(
      `
        id,
        index_value,
        price_per_sqft,
        currency,
        notes,
        reports!inner (year, quarter, report_date),
        regions (id, name),
        building_types (id, name, category),
        size_bands (id, label, min_sqft, max_sqft)
      `,
      { count: "exact" },
    );

    if (data.year !== undefined) query = query.eq("reports.year", data.year);
    if (data.quarter) query = query.eq("reports.quarter", data.quarter);
    if (data.region) query = query.ilike("regions.name", `%${data.region}%`);
    if (data.building_type) query = query.ilike("building_types.name", `%${data.building_type}%`);
    if (data.size_band) query = query.ilike("size_bands.label", `%${data.size_band}%`);

    const { data: respData, error } = await query
      .order("reports.year", { foreignTable: "reports", ascending: false })
      .order("reports.quarter", { foreignTable: "reports", ascending: false })
      .limit(data.limit);

    if (error) {
      console.error("[fetchIndices] Supabase error:", error);
      return [];
    }

    // Transform nested results into flat objects
    return (respData ?? []).map((row: PriceIndexWithJoins) => ({
      id: row.id,
      report_id: row.reports?.id ?? 0,
      year: row.reports?.year ?? null,
      quarter: row.reports?.quarter ?? null,
      report_date: row.reports?.report_date ?? null,
      region: row.regions ? { id: row.regions.id, name: row.regions.name } : null,
      building_type: row.building_types
        ? {
            id: row.building_types.id,
            name: row.building_types.name,
            category: row.building_types.category,
          }
        : null,
      size_band: row.size_bands
        ? {
            id: row.size_bands.id,
            label: row.size_bands.label,
            min_sqft: row.size_bands.min_sqft,
            max_sqft: row.size_bands.max_sqft,
          }
        : null,
      index_value: row.index_value,
      price_per_sqft: row.price_per_sqft,
      currency: row.currency ?? "GBP",
      notes: row.notes,
    }));
  });

export const fetchComparison = createServerFn({ method: "GET" })
  .validator(
    z.object({
      region: z.string().optional(),
      building_type: z.string().optional(),
      size_band: z.string().optional(),
      limit: z.number().default(1000),
    }),
  )
  .handler(async ({ data }) => {
    let query = supabaseAdmin
      .from("price_indices")
      .select(
        `
        id,
        index_value,
        price_per_sqft,
        reports!inner (year, quarter, report_date),
        regions (name),
        building_types (name),
        size_bands (label)
      `,
      )
      .order("reports.year")
      .order("reports.quarter");

    if (data.region) query = query.ilike("regions.name", `%${data.region}%`);
    if (data.building_type) query = query.ilike("building_types.name", `%${data.building_type}%`);
    if (data.size_band) query = query.ilike("size_bands.label", `%${data.size_band}%`);

    const { data: respData, error } = await query.limit(data.limit);
    if (error) {
      console.error("[fetchComparison] Supabase error:", error);
      return [];
    }

    return (respData ?? []).map((row: PriceIndexWithJoins) => ({
      id: row.id,
      index_value: row.index_value,
      price_per_sqft: row.price_per_sqft,
      year: row.reports?.year ?? null,
      quarter: row.reports?.quarter ?? null,
      report_date: row.reports?.report_date ?? null,
      region: row.regions?.name ?? null,
      building_type: row.building_types?.name ?? null,
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
    new Set((data ?? []).map((r: { year: number | null }) => r.year).filter((y) => y !== null)),
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
    return Array.from(new Set((respData ?? []).map((r: { quarter: string | null }) => r.quarter)))
      .filter((q): q is string => !!q)
      .sort();
  });
