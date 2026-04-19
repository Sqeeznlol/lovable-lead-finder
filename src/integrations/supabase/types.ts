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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          target_id: string | null
          target_table: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_table?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_id?: string | null
          target_table?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      export_logs: {
        Row: {
          created_at: string
          error_text: string | null
          id: string
          notes_content: string | null
          pipedrive_deal_id: string | null
          pipedrive_lead_id: string | null
          property_id: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_text?: string | null
          id?: string
          notes_content?: string | null
          pipedrive_deal_id?: string | null
          pipedrive_lead_id?: string | null
          property_id: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_text?: string | null
          id?: string
          notes_content?: string | null
          pipedrive_deal_id?: string | null
          pipedrive_lead_id?: string | null
          property_id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "export_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
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
      phone_search_logs: {
        Row: {
          created_at: string
          error_text: string | null
          id: string
          owner_name: string | null
          phone_number_id: string | null
          property_id: string
          result: string | null
          retry_count: number
          search_query: string | null
          status: string
        }
        Insert: {
          created_at?: string
          error_text?: string | null
          id?: string
          owner_name?: string | null
          phone_number_id?: string | null
          property_id: string
          result?: string | null
          retry_count?: number
          search_query?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          error_text?: string | null
          id?: string
          owner_name?: string | null
          phone_number_id?: string | null
          property_id?: string
          result?: string | null
          retry_count?: number
          search_query?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_search_logs_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "phone_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_search_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          acquisition_status: string
          address: string
          ai_last_analyzed_at: string | null
          ai_priority: number | null
          ai_recommendation: string | null
          ai_score: number | null
          ai_summary: string | null
          area: number | null
          baujahr: number | null
          bezirk: string | null
          bfs_nr: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_source: string | null
          denkmalschutz: string | null
          duplicate_flag: boolean | null
          duplicate_group_id: string | null
          egrid: string | null
          export_status: string
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
          isos: string | null
          kategorie: string | null
          last_export_at: string | null
          last_phone_search_at: string | null
          list_id: string | null
          notes: string | null
          ortschaftsname: string | null
          owner_address: string | null
          owner_address_2: string | null
          owner_name: string | null
          owner_name_2: string | null
          owner_phone: string | null
          owner_phone_2: string | null
          owners_json: Json | null
          parzelle: string | null
          phone_search_status: string
          pipedrive_deal_id: string | null
          plot_number: string | null
          plz: string | null
          plz_ort: string | null
          processing_error: string | null
          queried_at: string | null
          queried_by_phone: string | null
          review_status: string
          status: string
          strassenname: string | null
          streetview_url: string | null
          updated_at: string
          wohnungen: number | null
          zone: string | null
        }
        Insert: {
          acquisition_status?: string
          address: string
          ai_last_analyzed_at?: string | null
          ai_priority?: number | null
          ai_recommendation?: string | null
          ai_score?: number | null
          ai_summary?: string | null
          area?: number | null
          baujahr?: number | null
          bezirk?: string | null
          bfs_nr?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_source?: string | null
          denkmalschutz?: string | null
          duplicate_flag?: boolean | null
          duplicate_group_id?: string | null
          egrid?: string | null
          export_status?: string
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
          isos?: string | null
          kategorie?: string | null
          last_export_at?: string | null
          last_phone_search_at?: string | null
          list_id?: string | null
          notes?: string | null
          ortschaftsname?: string | null
          owner_address?: string | null
          owner_address_2?: string | null
          owner_name?: string | null
          owner_name_2?: string | null
          owner_phone?: string | null
          owner_phone_2?: string | null
          owners_json?: Json | null
          parzelle?: string | null
          phone_search_status?: string
          pipedrive_deal_id?: string | null
          plot_number?: string | null
          plz?: string | null
          plz_ort?: string | null
          processing_error?: string | null
          queried_at?: string | null
          queried_by_phone?: string | null
          review_status?: string
          status?: string
          strassenname?: string | null
          streetview_url?: string | null
          updated_at?: string
          wohnungen?: number | null
          zone?: string | null
        }
        Update: {
          acquisition_status?: string
          address?: string
          ai_last_analyzed_at?: string | null
          ai_priority?: number | null
          ai_recommendation?: string | null
          ai_score?: number | null
          ai_summary?: string | null
          area?: number | null
          baujahr?: number | null
          bezirk?: string | null
          bfs_nr?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_source?: string | null
          denkmalschutz?: string | null
          duplicate_flag?: boolean | null
          duplicate_group_id?: string | null
          egrid?: string | null
          export_status?: string
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
          isos?: string | null
          kategorie?: string | null
          last_export_at?: string | null
          last_phone_search_at?: string | null
          list_id?: string | null
          notes?: string | null
          ortschaftsname?: string | null
          owner_address?: string | null
          owner_address_2?: string | null
          owner_name?: string | null
          owner_name_2?: string | null
          owner_phone?: string | null
          owner_phone_2?: string | null
          owners_json?: Json | null
          parzelle?: string | null
          phone_search_status?: string
          pipedrive_deal_id?: string | null
          plot_number?: string | null
          plz?: string | null
          plz_ort?: string | null
          processing_error?: string | null
          queried_at?: string | null
          queried_by_phone?: string | null
          review_status?: string
          status?: string
          strassenname?: string | null
          streetview_url?: string | null
          updated_at?: string
          wohnungen?: number | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "property_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      properties_staging: {
        Row: {
          address: string | null
          area: number | null
          baujahr: number | null
          bezirk: string | null
          bfs_nr: string | null
          denkmalschutz: string | null
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
          isos: string | null
          kategorie: string | null
          ortschaftsname: string | null
          parzelle: string | null
          plot_number: string | null
          plz: string | null
          plz_ort: string | null
          strassenname: string | null
          streetview_url: string | null
          wohnungen: number | null
          zone: string | null
        }
        Insert: {
          address?: string | null
          area?: number | null
          baujahr?: number | null
          bezirk?: string | null
          bfs_nr?: string | null
          denkmalschutz?: string | null
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
          isos?: string | null
          kategorie?: string | null
          ortschaftsname?: string | null
          parzelle?: string | null
          plot_number?: string | null
          plz?: string | null
          plz_ort?: string | null
          strassenname?: string | null
          streetview_url?: string | null
          wohnungen?: number | null
          zone?: string | null
        }
        Update: {
          address?: string | null
          area?: number | null
          baujahr?: number | null
          bezirk?: string | null
          bfs_nr?: string | null
          denkmalschutz?: string | null
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
          isos?: string | null
          kategorie?: string | null
          ortschaftsname?: string | null
          parzelle?: string | null
          plot_number?: string | null
          plz?: string | null
          plz_ort?: string | null
          strassenname?: string | null
          streetview_url?: string | null
          wohnungen?: number | null
          zone?: string | null
        }
        Relationships: []
      }
      property_decisions: {
        Row: {
          ai_recommendation: string | null
          ai_score: number | null
          ai_summary: string | null
          created_at: string
          decision_matches_ai: boolean | null
          feedback_note: string | null
          id: string
          property_id: string
          user_decision: string
          user_id: string | null
        }
        Insert: {
          ai_recommendation?: string | null
          ai_score?: number | null
          ai_summary?: string | null
          created_at?: string
          decision_matches_ai?: boolean | null
          feedback_note?: string | null
          id?: string
          property_id: string
          user_decision: string
          user_id?: string | null
        }
        Update: {
          ai_recommendation?: string | null
          ai_score?: number | null
          ai_summary?: string | null
          created_at?: string
          decision_matches_ai?: boolean | null
          feedback_note?: string | null
          id?: string
          property_id?: string
          user_decision?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_decisions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_lists: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          priority: number
          property_count: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          priority?: number
          property_count?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          priority?: number
          property_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "office" | "mobile_swipe"
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
    Enums: {
      app_role: ["admin", "office", "mobile_swipe"],
    },
  },
} as const
