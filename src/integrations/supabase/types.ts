export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      phone_numbers: {
        Row: {
          created_at: string
          daily_queries_used: number
          id: string
          label: string | null
          last_query_date: string | null
          number: string
        }
        Insert: {
          created_at?: string
          daily_queries_used?: number
          id?: string
          label?: string | null
          last_query_date?: string | null
          number: string
        }
        Update: {
          created_at?: string
          daily_queries_used?: number
          id?: string
          label?: string | null
          last_query_date?: string | null
          number?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          area: number | null
          baujahr: number | null
          bezirk: string | null
          bfs_nr: string | null
          created_at: string
          egrid: string | null
          geb_status: string | null
          gebaeudeart: string | null
          gebaeudeflaeche: number | null
          gemeinde: string | null
          geschosse: number | null
          google_maps_url: string | null
          gvz_nr: string | null
          gwr_egid: string | null
          hausnummer: string | null
          id: string
          is_queried: boolean
          kategorie: string | null
          notes: string | null
          ortschaftsname: string | null
          owner_address: string | null
          owner_address_2: string | null
          owner_name: string | null
          owner_name_2: string | null
          owner_phone: string | null
          owner_phone_2: string | null
          parzelle: string | null
          plot_number: string | null
          plz: string | null
          plz_ort: string | null
          queried_at: string | null
          queried_by_phone: string | null
          status: string
          strassenname: string | null
          streetview_url: string | null
          updated_at: string
          wohnungen: number | null
          zone: string | null
        }
        Insert: {
          address: string
          area?: number | null
          baujahr?: number | null
          bezirk?: string | null
          bfs_nr?: string | null
          created_at?: string
          egrid?: string | null
          geb_status?: string | null
          gebaeudeart?: string | null
          gebaeudeflaeche?: number | null
          gemeinde?: string | null
          geschosse?: number | null
          google_maps_url?: string | null
          gvz_nr?: string | null
          gwr_egid?: string | null
          hausnummer?: string | null
          id?: string
          is_queried?: boolean
          kategorie?: string | null
          notes?: string | null
          ortschaftsname?: string | null
          owner_address?: string | null
          owner_address_2?: string | null
          owner_name?: string | null
          owner_name_2?: string | null
          owner_phone?: string | null
          owner_phone_2?: string | null
          parzelle?: string | null
          plot_number?: string | null
          plz?: string | null
          plz_ort?: string | null
          queried_at?: string | null
          queried_by_phone?: string | null
          status?: string
          strassenname?: string | null
          streetview_url?: string | null
          updated_at?: string
          wohnungen?: number | null
          zone?: string | null
        }
        Update: {
          address?: string
          area?: number | null
          baujahr?: number | null
          bezirk?: string | null
          bfs_nr?: string | null
          created_at?: string
          egrid?: string | null
          geb_status?: string | null
          gebaeudeart?: string | null
          gebaeudeflaeche?: number | null
          gemeinde?: string | null
          geschosse?: number | null
          google_maps_url?: string | null
          gvz_nr?: string | null
          gwr_egid?: string | null
          hausnummer?: string | null
          id?: string
          is_queried?: boolean
          kategorie?: string | null
          notes?: string | null
          ortschaftsname?: string | null
          owner_address?: string | null
          owner_address_2?: string | null
          owner_name?: string | null
          owner_name_2?: string | null
          owner_phone?: string | null
          owner_phone_2?: string | null
          parzelle?: string | null
          plot_number?: string | null
          plz?: string | null
          plz_ort?: string | null
          queried_at?: string | null
          queried_by_phone?: string | null
          status?: string
          strassenname?: string | null
          streetview_url?: string | null
          updated_at?: string
          wohnungen?: number | null
          zone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
