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
          report_date: string | null;
          quarter: string | null;
          year: number | null;
          status: string;
          extracted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          filename: string;
          title?: string | null;
          report_date?: string | null;
          quarter?: string | null;
          year?: number | null;
          status?: string;
          extracted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          filename?: string;
          title?: string | null;
          report_date?: string | null;
          quarter?: string | null;
          year?: number | null;
          status?: string;
          extracted_at?: string | null;
          created_at?: string;
        };
      };
      regions: {
        Row: {
          id: number;
          name: string;
        };
        Insert: {
          id?: number;
          name: string;
        };
        Update: {
          id?: number;
          name?: string;
        };
      };
      building_types: {
        Row: {
          id: number;
          name: string;
          category: string | null;
        };
        Insert: {
          id?: number;
          name: string;
          category?: string | null;
        };
        Update: {
          id?: number;
          name?: string | null;
          category?: string | null;
        };
      };
      size_bands: {
        Row: {
          id: number;
          label: string;
          min_sqft: number | null;
          max_sqft: number | null;
        };
        Insert: {
          id?: number;
          label: string;
          min_sqft?: number | null;
          max_sqft?: number | null;
        };
        Update: {
          id?: number;
          label?: string;
          min_sqft?: number | null;
          max_sqft?: number | null;
        };
      };
      price_indices: {
        Row: {
          id: number;
          report_id: number;
          region_id: number | null;
          building_type_id: number | null;
          size_band_id: number | null;
          index_value: number | null;
          base_period: string | null;
          price_per_sqft: number | null;
          currency: string;
          notes: string | null;
        };
        Insert: {
          id?: number;
          report_id: number;
          region_id?: number | null;
          building_type_id?: number | null;
          size_band_id?: number | null;
          index_value?: number | null;
          base_period?: string | null;
          price_per_sqft?: number | null;
          currency?: string;
          notes?: string | null;
        };
        Update: {
          id?: number;
          report_id?: number;
          region_id?: number | null;
          building_type_id?: number | null;
          size_band_id?: number | null;
          index_value?: number | null;
          base_period?: string | null;
          price_per_sqft?: number | null;
          currency?: string;
          notes?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
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
