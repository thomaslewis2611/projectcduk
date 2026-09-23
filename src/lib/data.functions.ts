/**
 * Server functions for report records. Forecast data lives in tpi.functions.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/admin.server";

export const ReportSchema = z.object({
  id: z.number(),
  filename: z.string(),
  title: z.string().nullable(),
  quarter: z.string().nullable(),
  year: z.number().nullable(),
  status: z.string(),
  extracted_at: z.string().nullable(),
  created_at: z.string(),
  publisher: z.string().nullable(),
  period_quarter: z.number().nullable(),
});

export type Report = z.infer<typeof ReportSchema>;

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
