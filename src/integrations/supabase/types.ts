export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "16.8";
  };
  public: {
    Tables: {
      reports: {
        Row: {
          id: number;
          filename: string;
          title: string | null;
          quarter: string | null;
          year: number | null;
          status: string;
          extracted_at: string | null;
          created_at: string;
          publisher: string | null;
          period_quarter: number | null;
        };
        Insert: {
          id?: number;
          filename: string;
          title?: string | null;
          quarter?: string | null;
          year?: number | null;
          status?: string;
          extracted_at?: string | null;
          created_at?: string;
          publisher?: string | null;
          period_quarter?: number | null;
        };
        Update: {
          id?: number;
          filename?: string;
          title?: string | null;
          quarter?: string | null;
          year?: number | null;
          status?: string;
          extracted_at?: string | null;
          created_at?: string;
          publisher?: string | null;
          period_quarter?: number | null;
        };
        Relationships: [];
      };
      tpi_forecasts: {
        Row: {
          id: number;
          report_id: number;
          region: string;
          forecast_year: number;
          change_pct: number | null;
          previous_change_pct: number | null;
        };
        Insert: {
          id?: number;
          report_id: number;
          region: string;
          forecast_year: number;
          change_pct?: number | null;
          previous_change_pct?: number | null;
        };
        Update: {
          id?: number;
          report_id?: number;
          region?: string;
          forecast_year?: number;
          change_pct?: number | null;
          previous_change_pct?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "tpi_forecasts_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      tpi_forecast_rows: {
        Row: {
          id: number;
          report_id: number;
          publisher: string | null;
          period_label: string | null;
          period_year: number | null;
          period_quarter: number | null;
          region: string;
          forecast_year: number;
          change_pct: number | null;
          previous_change_pct: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
