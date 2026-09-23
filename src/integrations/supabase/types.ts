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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [
          {
            foreignKeyName: "price_indices_report_id_fkey";
            columns: ["report_id"];
            isOneToOne: false;
            referencedRelation: "reports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_indices_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_indices_building_type_id_fkey";
            columns: ["building_type_id"];
            isOneToOne: false;
            referencedRelation: "building_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_indices_size_band_id_fkey";
            columns: ["size_band_id"];
            isOneToOne: false;
            referencedRelation: "size_bands";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      price_index_rows: {
        Row: {
          id: number;
          report_id: number;
          year: number | null;
          quarter: string | null;
          report_date: string | null;
          region_id: number | null;
          region: string | null;
          building_type_id: number | null;
          building_type: string | null;
          building_category: string | null;
          size_band_id: number | null;
          size_band: string | null;
          min_sqft: number | null;
          max_sqft: number | null;
          index_value: number | null;
          price_per_sqft: number | null;
          base_period: string | null;
          currency: string | null;
          notes: string | null;
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
