import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

export type TpiForecastRow = Database["public"]["Views"]["tpi_forecast_rows"]["Row"];

/** Every forecast from every report — a few thousand rows at most. */
export const fetchTpiForecasts = createServerFn({ method: "GET" }).handler(
  async (): Promise<TpiForecastRow[]> => {
    const { data, error } = await supabaseAdmin
      .from("tpi_forecast_rows")
      .select("*")
      .order("period_year")
      .order("period_quarter")
      .order("forecast_year");
    if (error) {
      console.error("[fetchTpiForecasts] Supabase error:", error);
      return [];
    }
    return data ?? [];
  },
);
