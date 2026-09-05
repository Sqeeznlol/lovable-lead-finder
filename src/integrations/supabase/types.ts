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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
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
      daily_shortlist: {
        Row: {
          assigned_phone: string | null
          created_at: string
          egrid: string | null
          id: string
          processed_at: string | null
          property_id: string | null
          rank: number
          reasons: Json | null
          reserve_gf: number | null
          score: number | null
          score_tier: string | null
          shortlist_date: string
          status: string
        }
        Insert: {
          assigned_phone?: string | null
          created_at?: string
          egrid?: string | null
          id?: string
          processed_at?: string | null
          property_id?: string | null
          rank: number
          reasons?: Json | null
          reserve_gf?: number | null
          score?: number | null
          score_tier?: string | null
          shortlist_date?: string
          status?: string
        }
        Update: {
          assigned_phone?: string | null
          created_at?: string
          egrid?: string | null
          id?: string
          processed_at?: string | null
          property_id?: string | null
          rank?: number
          reasons?: Json | null
          reserve_gf?: number | null
          score?: number | null
          score_tier?: string | null
          shortlist_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_shortlist_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_shortlist_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_lookup_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      export_logs: {
        Row: {
          created_at: string
          error_text: string | null
          export_name: string | null
          filters: Json | null
          id: string
          notes_content: string | null
          pipedrive_deal_id: string | null
          pipedrive_lead_id: string | null
          property_id: string
          row_count: number | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_text?: string | null
          export_name?: string | null
          filters?: Json | null
          id?: string
          notes_content?: string | null
          pipedrive_deal_id?: string | null
          pipedrive_lead_id?: string | null
          property_id: string
          row_count?: number | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_text?: string | null
          export_name?: string | null
          filters?: Json | null
          id?: string
          notes_content?: string | null
          pipedrive_deal_id?: string | null
          pipedrive_lead_id?: string | null
          property_id?: string
          row_count?: number | null
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
          {
            foreignKeyName: "export_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_lookup_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      import_logs: {
        Row: {
          created_at: string
          details: Json | null
          file_name: string
          id: string
          list_id: string | null
          list_name: string | null
          new_gemeinden: number
          rows_duplicates: number
          rows_inserted: number
          rows_invalid: number
          rows_total: number
          rows_updated: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          file_name: string
          id?: string
          list_id?: string | null
          list_name?: string | null
          new_gemeinden?: number
          rows_duplicates?: number
          rows_inserted?: number
          rows_invalid?: number
          rows_total?: number
          rows_updated?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          file_name?: string
          id?: string
          list_id?: string | null
          list_name?: string | null
          new_gemeinden?: number
          rows_duplicates?: number
          rows_inserted?: number
          rows_invalid?: number
          rows_total?: number
          rows_updated?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_logs_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "property_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      parcel_lookups: {
        Row: {
          bfs_nr: string | null
          egrid: string
          owner_count: number | null
          owners_json: Json | null
          queried_at: string
          queried_by_phone: string | null
          source: string | null
        }
        Insert: {
          bfs_nr?: string | null
          egrid: string
          owner_count?: number | null
          owners_json?: Json | null
          queried_at?: string
          queried_by_phone?: string | null
          source?: string | null
        }
        Update: {
          bfs_nr?: string | null
          egrid?: string
          owner_count?: number | null
          owners_json?: Json | null
          queried_at?: string
          queried_by_phone?: string | null
          source?: string | null
        }
        Relationships: []
      }
      phone_numbers: {
        Row: {
          active: boolean
          cooldown_until: string | null
          created_at: string
          daily_limit: number
          daily_queries_used: number
          id: string
          label: string | null
          last_query_date: string | null
          number: string
        }
        Insert: {
          active?: boolean
          cooldown_until?: string | null
          created_at?: string
          daily_limit?: number
          daily_queries_used?: number
          id?: string
          label?: string | null
          last_query_date?: string | null
          number: string
        }
        Update: {
          active?: boolean
          cooldown_until?: string | null
          created_at?: string
          daily_limit?: number
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
          {
            foreignKeyName: "phone_search_logs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_lookup_candidates"
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
          anrechenbare_geschosse: number | null
          ausgeschlossen: boolean
          ausschluss_grund: string | null
          az_quelle: string | null
          bebaubar_m2: number | null
          confidence: string | null
          erloes_chf: number | null
          gebaeude_anzahl: number
          gf_bestand: number | null
          gf_zulaessig: number | null
          investition_chf: number | null
          marge_chf: number | null
          marge_quote: number | null
          potenzial_score: number | null
          vollgeschosse_zulaessig: number | null
          area: number | null
          assigned_to: string | null
          ausnuetzung: number | null
          baujahr: number | null
          bezirk: string | null
          bezirksort: string | null
          bfs_nr: string | null
          contact_attempts: number
          created_at: string
          data_quality: number | null
          deal_score: number | null
          decided_at: string | null
          decided_by: string | null
          decision_source: string | null
          denkmalschutz: string | null
          denkmalschutz_titel: string | null
          duplicate_flag: boolean | null
          duplicate_group_id: string | null
          egrid: string | null
          eigentuemer_adresse: string | null
          eigentuemer_fetched_at: string | null
          eigentuemer_name: string | null
          eigentuemer_plz_ort: string | null
          export_status: string
          follow_up_at: string | null
          geb_status: string | null
          gebaeudeart: string | null
          gebaeudeflaeche: number | null
          gemeinde: string | null
          geschosse: number | null
          gis_url: string | null
          google_maps_url: string | null
          gvz_nr: string | null
          gwr_egid: string | null
          hausnummer: string | null
          hnf_bestand: number | null
          hnf_delta: number | null
          hnf_faktor: number | null
          hnf_neu: number | null
          hnf_schaetzung: number | null
          housing_stat_url: string | null
          id: string
          imported_at: string
          is_queried: boolean
          isos: string | null
          isos_titel: string | null
          kanton: string | null
          kategorie: string | null
          last_contact_at: string | null
          last_export_at: string | null
          last_phone_search_at: string | null
          list_id: string | null
          notes: string | null
          nutzflaeche: number | null
          objektadresse: string | null
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
          preselection_decided_at: string | null
          preselection_note: string | null
          preselection_status: string
          processing_error: string | null
          queried_at: string | null
          queried_by_phone: string | null
          renovationsjahr: number | null
          reserve_gf: number | null
          reserve_quote: number | null
          review_status: string
          score_input_hash: string | null
          score_killers: Json | null
          score_reasons: Json | null
          score_tier: string | null
          score_version: number | null
          scored_at: string | null
          source_file: string | null
          stage_changed_at: string | null
          status: string
          strassenname: string | null
          streetview_url: string | null
          updated_at: string
          vollgeschosse: number | null
          wohnflaeche: number | null
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
          anrechenbare_geschosse?: number | null
          ausgeschlossen?: boolean
          ausschluss_grund?: string | null
          az_quelle?: string | null
          bebaubar_m2?: number | null
          confidence?: string | null
          erloes_chf?: number | null
          gebaeude_anzahl?: number
          gf_bestand?: number | null
          gf_zulaessig?: number | null
          investition_chf?: number | null
          marge_chf?: number | null
          marge_quote?: number | null
          potenzial_score?: number | null
          vollgeschosse_zulaessig?: number | null
          area?: number | null
          assigned_to?: string | null
          ausnuetzung?: number | null
          baujahr?: number | null
          bezirk?: string | null
          bezirksort?: string | null
          bfs_nr?: string | null
          contact_attempts?: number
          created_at?: string
          data_quality?: number | null
          deal_score?: number | null
          decided_at?: string | null
          decided_by?: string | null
          decision_source?: string | null
          denkmalschutz?: string | null
          denkmalschutz_titel?: string | null
          duplicate_flag?: boolean | null
          duplicate_group_id?: string | null
          egrid?: string | null
          eigentuemer_adresse?: string | null
          eigentuemer_fetched_at?: string | null
          eigentuemer_name?: string | null
          eigentuemer_plz_ort?: string | null
          export_status?: string
          follow_up_at?: string | null
          geb_status?: string | null
          gebaeudeart?: string | null
          gebaeudeflaeche?: number | null
          gemeinde?: string | null
          geschosse?: number | null
          gis_url?: string | null
          google_maps_url?: string | null
          gvz_nr?: string | null
          gwr_egid?: string | null
          hausnummer?: string | null
          hnf_bestand?: number | null
          hnf_delta?: number | null
          hnf_faktor?: number | null
          hnf_neu?: number | null
          hnf_schaetzung?: number | null
          housing_stat_url?: string | null
          id?: string
          imported_at?: string
          is_queried?: boolean
          isos?: string | null
          isos_titel?: string | null
          kanton?: string | null
          kategorie?: string | null
          last_contact_at?: string | null
          last_export_at?: string | null
          last_phone_search_at?: string | null
          list_id?: string | null
          notes?: string | null
          nutzflaeche?: number | null
          objektadresse?: string | null
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
          preselection_decided_at?: string | null
          preselection_note?: string | null
          preselection_status?: string
          processing_error?: string | null
          queried_at?: string | null
          queried_by_phone?: string | null
          renovationsjahr?: number | null
          reserve_gf?: number | null
          reserve_quote?: number | null
          review_status?: string
          score_input_hash?: string | null
          score_killers?: Json | null
          score_reasons?: Json | null
          score_tier?: string | null
          score_version?: number | null
          scored_at?: string | null
          source_file?: string | null
          stage_changed_at?: string | null
          status?: string
          strassenname?: string | null
          streetview_url?: string | null
          updated_at?: string
          vollgeschosse?: number | null
          wohnflaeche?: number | null
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
          anrechenbare_geschosse?: number | null
          ausgeschlossen?: boolean
          ausschluss_grund?: string | null
          az_quelle?: string | null
          bebaubar_m2?: number | null
          confidence?: string | null
          erloes_chf?: number | null
          gebaeude_anzahl?: number
          gf_bestand?: number | null
          gf_zulaessig?: number | null
          investition_chf?: number | null
          marge_chf?: number | null
          marge_quote?: number | null
          potenzial_score?: number | null
          vollgeschosse_zulaessig?: number | null
          area?: number | null
          assigned_to?: string | null
          ausnuetzung?: number | null
          baujahr?: number | null
          bezirk?: string | null
          bezirksort?: string | null
          bfs_nr?: string | null
          contact_attempts?: number
          created_at?: string
          data_quality?: number | null
          deal_score?: number | null
          decided_at?: string | null
          decided_by?: string | null
          decision_source?: string | null
          denkmalschutz?: string | null
          denkmalschutz_titel?: string | null
          duplicate_flag?: boolean | null
          duplicate_group_id?: string | null
          egrid?: string | null
          eigentuemer_adresse?: string | null
          eigentuemer_fetched_at?: string | null
          eigentuemer_name?: string | null
          eigentuemer_plz_ort?: string | null
          export_status?: string
          follow_up_at?: string | null
          geb_status?: string | null
          gebaeudeart?: string | null
          gebaeudeflaeche?: number | null
          gemeinde?: string | null
          geschosse?: number | null
          gis_url?: string | null
          google_maps_url?: string | null
          gvz_nr?: string | null
          gwr_egid?: string | null
          hausnummer?: string | null
          hnf_bestand?: number | null
          hnf_delta?: number | null
          hnf_faktor?: number | null
          hnf_neu?: number | null
          hnf_schaetzung?: number | null
          housing_stat_url?: string | null
          id?: string
          imported_at?: string
          is_queried?: boolean
          isos?: string | null
          isos_titel?: string | null
          kanton?: string | null
          kategorie?: string | null
          last_contact_at?: string | null
          last_export_at?: string | null
          last_phone_search_at?: string | null
          list_id?: string | null
          notes?: string | null
          nutzflaeche?: number | null
          objektadresse?: string | null
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
          preselection_decided_at?: string | null
          preselection_note?: string | null
          preselection_status?: string
          processing_error?: string | null
          queried_at?: string | null
          queried_by_phone?: string | null
          renovationsjahr?: number | null
          reserve_gf?: number | null
          reserve_quote?: number | null
          review_status?: string
          score_input_hash?: string | null
          score_killers?: Json | null
          score_reasons?: Json | null
          score_tier?: string | null
          score_version?: number | null
          scored_at?: string | null
          source_file?: string | null
          stage_changed_at?: string | null
          status?: string
          strassenname?: string | null
          streetview_url?: string | null
          updated_at?: string
          vollgeschosse?: number | null
          wohnflaeche?: number | null
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
          anrechenbare_geschosse?: number | null
          ausgeschlossen?: boolean
          ausschluss_grund?: string | null
          az_quelle?: string | null
          bebaubar_m2?: number | null
          confidence?: string | null
          erloes_chf?: number | null
          gebaeude_anzahl?: number
          gf_bestand?: number | null
          gf_zulaessig?: number | null
          investition_chf?: number | null
          marge_chf?: number | null
          marge_quote?: number | null
          potenzial_score?: number | null
          vollgeschosse_zulaessig?: number | null
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
          anrechenbare_geschosse?: number | null
          ausgeschlossen?: boolean
          ausschluss_grund?: string | null
          az_quelle?: string | null
          bebaubar_m2?: number | null
          confidence?: string | null
          erloes_chf?: number | null
          gebaeude_anzahl?: number
          gf_bestand?: number | null
          gf_zulaessig?: number | null
          investition_chf?: number | null
          marge_chf?: number | null
          marge_quote?: number | null
          potenzial_score?: number | null
          vollgeschosse_zulaessig?: number | null
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
          {
            foreignKeyName: "property_decisions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "v_lookup_candidates"
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
      saved_filters: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          scope: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          name: string
          scope?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          scope?: string
          updated_at?: string
          user_id?: string | null
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
      gemeinde_stats_mv: {
        Row: {
          gemeinde: string | null
          geprueft: number | null
          interessant: number | null
          offen: number | null
          total: number | null
        }
        Relationships: []
      }
      v_lookup_candidates: {
        Row: {
          address: string | null
          area: number | null
          baujahr: number | null
          bfs_nr: string | null
          data_quality: number | null
          deal_score: number | null
          egrid: string | null
          gebaeudeflaeche: number | null
          gemeinde: string | null
          hnf_bestand: number | null
          hnf_delta: number | null
          hnf_faktor: number | null
          hnf_neu: number | null
          hnf_schaetzung: number | null
          id: string | null
          parzelle: string | null
          plz_ort: string | null
          reserve_gf: number | null
          reserve_quote: number | null
          score_reasons: Json | null
          score_tier: string | null
          wohnungen: number | null
          zone: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      gemeinde_stats: {
        Args: never
        Returns: {
          gemeinde: string
          geprueft: number
          interessant: number
          offen: number
          total: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      refresh_gemeinde_stats: { Args: never; Returns: undefined }
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
