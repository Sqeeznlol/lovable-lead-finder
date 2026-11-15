
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "akteur": {
                  Row: {
                    "adresse": string | null,"art": string,"art_sicher": boolean,"bemerkung": string | null,"erstellt_am": string,"geaendert_am": string,"herkunft": string | null,"id": string,"land": string | null,"name": string,"name_norm": string | null,"name_umgedreht": boolean,"ort": string | null,"plz": string | null,"uid": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "adresse"?: string | null,"art": string,"art_sicher"?: boolean,"bemerkung"?: string | null,"erstellt_am"?: string,"geaendert_am"?: string,"herkunft"?: string | null,"id"?: string,"land"?: string | null,"name": string,"name_norm"?: never,"name_umgedreht"?: boolean,"ort"?: string | null,"plz"?: string | null,"uid"?: string | null
                  }
                  Update: {
                    "adresse"?: string | null,"art"?: string,"art_sicher"?: boolean,"bemerkung"?: string | null,"erstellt_am"?: string,"geaendert_am"?: string,"herkunft"?: string | null,"id"?: string,"land"?: string | null,"name"?: string,"name_norm"?: never,"name_umgedreht"?: boolean,"ort"?: string | null,"plz"?: string | null,"uid"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"aktivitaet": {
                  Row: {
                    "aktion": string,"email": string | null,"gegenstand": string | null,"id": number,"kanton": string | null,"user_id": string | null,"zeit": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aktion": string,"email"?: string | null,"gegenstand"?: string | null,"id"?: never,"kanton"?: string | null,"user_id"?: string | null,"zeit"?: string
                  }
                  Update: {
                    "aktion"?: string,"email"?: string | null,"gegenstand"?: string | null,"id"?: never,"kanton"?: string | null,"user_id"?: string | null,"zeit"?: string
                  }
                  Relationships: [
                    
                  ]
                },"anfrage": {
                  Row: {
                    "adresse": string | null,"angaben": NonNullable<Json>,"art": string,"bearbeitet": boolean,"bemerkung": string | null,"egrid": string | null,"einwilligung": boolean,"email": string | null,"erstellt_am": string,"id": string,"nachfass_am": string | null,"nachfass_stufe": number,"nachricht": string | null,"name": string,"telefon": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "adresse"?: string | null,"angaben"?: NonNullable<Json>,"art": string,"bearbeitet"?: boolean,"bemerkung"?: string | null,"egrid"?: string | null,"einwilligung": boolean,"email"?: string | null,"erstellt_am"?: string,"id"?: string,"nachfass_am"?: string | null,"nachfass_stufe"?: number,"nachricht"?: string | null,"name": string,"telefon"?: string | null
                  }
                  Update: {
                    "adresse"?: string | null,"angaben"?: NonNullable<Json>,"art"?: string,"bearbeitet"?: boolean,"bemerkung"?: string | null,"egrid"?: string | null,"einwilligung"?: boolean,"email"?: string | null,"erstellt_am"?: string,"id"?: string,"nachfass_am"?: string | null,"nachfass_stufe"?: number,"nachricht"?: string | null,"name"?: string,"telefon"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"anmeldung": {
                  Row: {
                    "email": string | null,"geraet": string | null,"geraet_id": string | null,"id": number,"ip": string | null,"ort": string | null,"ort_ip": string | null,"ort_passt": boolean | null,"user_agent": string | null,"user_id": string | null,"zeit": string
                  }
                  ComputedFields: never
                  Insert: {
                    "email"?: string | null,"geraet"?: string | null,"geraet_id"?: string | null,"id"?: never,"ip"?: string | null,"ort"?: string | null,"ort_ip"?: string | null,"ort_passt"?: boolean | null,"user_agent"?: string | null,"user_id"?: string | null,"zeit"?: string
                  }
                  Update: {
                    "email"?: string | null,"geraet"?: string | null,"geraet_id"?: string | null,"id"?: never,"ip"?: string | null,"ort"?: string | null,"ort_ip"?: string | null,"ort_passt"?: boolean | null,"user_agent"?: string | null,"user_id"?: string | null,"zeit"?: string
                  }
                  Relationships: [
                    
                  ]
                },"anruf": {
                  Row: {
                    "ablehnungsgrund": string | null,"akteur_id": string | null,"erreicht": boolean | null,"gefuehrt_am": string,"gefuehrt_von": string | null,"id": string,"kauft_selbst": boolean,"kontakt_id": string | null,"notiz": string | null,"parzelle_id": string | null,"preisvorstellung_chf": number | null,"verkaufsabsicht": string | null,"weitere_objekte": string | null,"wiedervorlage_am": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ablehnungsgrund"?: string | null,"akteur_id"?: string | null,"erreicht"?: boolean | null,"gefuehrt_am"?: string,"gefuehrt_von"?: string | null,"id"?: string,"kauft_selbst"?: boolean,"kontakt_id"?: string | null,"notiz"?: string | null,"parzelle_id"?: string | null,"preisvorstellung_chf"?: number | null,"verkaufsabsicht"?: string | null,"weitere_objekte"?: string | null,"wiedervorlage_am"?: string | null
                  }
                  Update: {
                    "ablehnungsgrund"?: string | null,"akteur_id"?: string | null,"erreicht"?: boolean | null,"gefuehrt_am"?: string,"gefuehrt_von"?: string | null,"id"?: string,"kauft_selbst"?: boolean,"kontakt_id"?: string | null,"notiz"?: string | null,"parzelle_id"?: string | null,"preisvorstellung_chf"?: number | null,"verkaufsabsicht"?: string | null,"weitere_objekte"?: string | null,"wiedervorlage_am"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "anruf_akteur_id_fkey"
      columns: ["akteur_id"]
isOneToOne: false
      referencedRelation: "akteur"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "anruf_akteur_id_fkey"
      columns: ["akteur_id"]
isOneToOne: false
      referencedRelation: "eigentuemer_zu_pruefen"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "anruf_kontakt_id_fkey"
      columns: ["kontakt_id"]
isOneToOne: false
      referencedRelation: "kontakt"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "anruf_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: false
      referencedRelation: "nachbarn"
      referencedColumns: ["nachbar_id"]
    },{
      foreignKeyName: "anruf_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"app_settings": {
                  Row: {
                    "key": string,"updated_at": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"audit_logs": {
                  Row: {
                    "action": string,"created_at": string,"details": Json | null,"id": string,"target_id": string | null,"target_table": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"created_at"?: string,"details"?: Json | null,"id"?: string,"target_id"?: string | null,"target_table"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"details"?: Json | null,"id"?: string,"target_id"?: string | null,"target_table"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"baugesuch": {
                  Row: {
                    "adresse": string | null,"bauherrschaft": string | null,"beschreibung": string | null,"bfs_nr": string | null,"egrid": string | null,"einsprache_bis": string | null,"erfasst_am": string,"fremd_id": string | null,"gemeinde": string | null,"geometrie": unknown,"id": string,"kanton": string | null,"kosten_chf": number | null,"nachbar_egrids": (string)[] | null,"parzelle_id": string | null,"parzelle_nr": string | null,"publikation_id": string | null,"publikation_nr": string | null,"publiziert_am": string,"publiziert_bis": string | null,"quelle": string,"quelle_url": string | null,"zuordnung_art": string | null,"zuordnung_sicher": boolean,"zustand": string
                  }
                  ComputedFields: never
                  Insert: {
                    "adresse"?: string | null,"bauherrschaft"?: string | null,"beschreibung"?: string | null,"bfs_nr"?: string | null,"egrid"?: string | null,"einsprache_bis"?: string | null,"erfasst_am"?: string,"fremd_id"?: string | null,"gemeinde"?: string | null,"geometrie"?: unknown,"id"?: string,"kanton"?: string | null,"kosten_chf"?: number | null,"nachbar_egrids"?: (string)[] | null,"parzelle_id"?: string | null,"parzelle_nr"?: string | null,"publikation_id"?: string | null,"publikation_nr"?: string | null,"publiziert_am": string,"publiziert_bis"?: string | null,"quelle": string,"quelle_url"?: string | null,"zuordnung_art"?: string | null,"zuordnung_sicher"?: boolean,"zustand"?: string
                  }
                  Update: {
                    "adresse"?: string | null,"bauherrschaft"?: string | null,"beschreibung"?: string | null,"bfs_nr"?: string | null,"egrid"?: string | null,"einsprache_bis"?: string | null,"erfasst_am"?: string,"fremd_id"?: string | null,"gemeinde"?: string | null,"geometrie"?: unknown,"id"?: string,"kanton"?: string | null,"kosten_chf"?: number | null,"nachbar_egrids"?: (string)[] | null,"parzelle_id"?: string | null,"parzelle_nr"?: string | null,"publikation_id"?: string | null,"publikation_nr"?: string | null,"publiziert_am"?: string,"publiziert_bis"?: string | null,"quelle"?: string,"quelle_url"?: string | null,"zuordnung_art"?: string | null,"zuordnung_sicher"?: boolean,"zustand"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "baugesuch_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: false
      referencedRelation: "nachbarn"
      referencedColumns: ["nachbar_id"]
    },{
      foreignKeyName: "baugesuch_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"check_ereignis": {
                  Row: {
                    "domain": string,"ereignis": string,"geraet": string | null,"id": number,"kampagne": string | null,"marke": string,"quelle": string | null,"sitzung": string,"zeit": string
                  }
                  ComputedFields: never
                  Insert: {
                    "domain": string,"ereignis": string,"geraet"?: string | null,"id"?: number,"kampagne"?: string | null,"marke": string,"quelle"?: string | null,"sitzung": string,"zeit"?: string
                  }
                  Update: {
                    "domain"?: string,"ereignis"?: string,"geraet"?: string | null,"id"?: number,"kampagne"?: string | null,"marke"?: string,"quelle"?: string | null,"sitzung"?: string,"zeit"?: string
                  }
                  Relationships: [
                    
                  ]
                },"eigentum": {
                  Row: {
                    "akteur_id": string,"anteil": string | null,"art": string | null,"geprueft": boolean,"geprueft_von": string | null,"id": string,"parzelle_id": string,"quelle": string,"stand": string
                  }
                  ComputedFields: never
                  Insert: {
                    "akteur_id": string,"anteil"?: string | null,"art"?: string | null,"geprueft"?: boolean,"geprueft_von"?: string | null,"id"?: string,"parzelle_id": string,"quelle": string,"stand"?: string
                  }
                  Update: {
                    "akteur_id"?: string,"anteil"?: string | null,"art"?: string | null,"geprueft"?: boolean,"geprueft_von"?: string | null,"id"?: string,"parzelle_id"?: string,"quelle"?: string,"stand"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "eigentum_akteur_id_fkey"
      columns: ["akteur_id"]
isOneToOne: false
      referencedRelation: "akteur"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eigentum_akteur_id_fkey"
      columns: ["akteur_id"]
isOneToOne: false
      referencedRelation: "eigentuemer_zu_pruefen"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eigentum_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: false
      referencedRelation: "nachbarn"
      referencedColumns: ["nachbar_id"]
    },{
      foreignKeyName: "eigentum_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"export_logs": {
                  Row: {
                    "created_at": string,"error_text": string | null,"export_name": string | null,"filters": Json | null,"id": string,"notes_content": string | null,"pipedrive_deal_id": string | null,"pipedrive_lead_id": string | null,"property_id": string,"row_count": number | null,"status": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"error_text"?: string | null,"export_name"?: string | null,"filters"?: Json | null,"id"?: string,"notes_content"?: string | null,"pipedrive_deal_id"?: string | null,"pipedrive_lead_id"?: string | null,"property_id": string,"row_count"?: number | null,"status"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"error_text"?: string | null,"export_name"?: string | null,"filters"?: Json | null,"id"?: string,"notes_content"?: string | null,"pipedrive_deal_id"?: string | null,"pipedrive_lead_id"?: string | null,"property_id"?: string,"row_count"?: number | null,"status"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "export_logs_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "nachbarn"
      referencedColumns: ["nachbar_id"]
    },{
      foreignKeyName: "export_logs_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"fonds_liegenschaft": {
                  Row: {
                    "baujahr": number | null,"berichtsdatum": string | null,"brutto_rendite": number | null,"e": number | null,"egrid": string | null,"eingelesen_am": string,"gefaess": string,"gemeinde": string | null,"gestehung": number | null,"id": number,"kanton": string | null,"n": number | null,"ort_adresse": string,"quelle": string,"sollmiete": number | null,"typ": string,"verkehrswert": number
                  }
                  ComputedFields: never
                  Insert: {
                    "baujahr"?: number | null,"berichtsdatum"?: string | null,"brutto_rendite"?: number | null,"e"?: number | null,"egrid"?: string | null,"eingelesen_am"?: string,"gefaess": string,"gemeinde"?: string | null,"gestehung"?: number | null,"id"?: number,"kanton"?: string | null,"n"?: number | null,"ort_adresse": string,"quelle": string,"sollmiete"?: number | null,"typ"?: string,"verkehrswert": number
                  }
                  Update: {
                    "baujahr"?: number | null,"berichtsdatum"?: string | null,"brutto_rendite"?: number | null,"e"?: number | null,"egrid"?: string | null,"eingelesen_am"?: string,"gefaess"?: string,"gemeinde"?: string | null,"gestehung"?: number | null,"id"?: number,"kanton"?: string | null,"n"?: number | null,"ort_adresse"?: string,"quelle"?: string,"sollmiete"?: number | null,"typ"?: string,"verkehrswert"?: number
                  }
                  Relationships: [
                    
                  ]
                },"fonds_notiz": {
                  Row: {
                    "am": string,"erledigt": boolean,"erstellt_am": string,"id": string,"mit": string | null,"parzelle_id": string | null,"position_id": string | null,"team_id": string,"text": string,"von": string | null,"wiedervorlage": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "am"?: string,"erledigt"?: boolean,"erstellt_am"?: string,"id"?: string,"mit"?: string | null,"parzelle_id"?: string | null,"position_id"?: string | null,"team_id": string,"text": string,"von"?: string | null,"wiedervorlage"?: string | null
                  }
                  Update: {
                    "am"?: string,"erledigt"?: boolean,"erstellt_am"?: string,"id"?: string,"mit"?: string | null,"parzelle_id"?: string | null,"position_id"?: string | null,"team_id"?: string,"text"?: string,"von"?: string | null,"wiedervorlage"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "fonds_notiz_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: false
      referencedRelation: "nachbarn"
      referencedColumns: ["nachbar_id"]
    },{
      foreignKeyName: "fonds_notiz_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fonds_notiz_position_id_fkey"
      columns: ["position_id"]
isOneToOne: false
      referencedRelation: "portfolio_position"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fonds_notiz_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team"
      referencedColumns: ["id"]
    }
                  ]
                },"fonds_potenzial_stand": {
                  Row: {
                    "geaendert_am": string,"notiz": string | null,"schluessel": string,"stand": string,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "geaendert_am"?: string,"notiz"?: string | null,"schluessel": string,"stand"?: string,"team_id": string
                  }
                  Update: {
                    "geaendert_am"?: string,"notiz"?: string | null,"schluessel"?: string,"stand"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fonds_potenzial_stand_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team"
      referencedColumns: ["id"]
    }
                  ]
                },"fonds_suchprofil": {
                  Row: {
                    "aktiv": boolean,"bemerkung": string | null,"erstellt_am": string,"flaeche_min": number | null,"id": string,"lagen": (string)[],"marge_min": number | null,"name": string,"nur_wohnzone": boolean,"reserve_min": number | null,"team_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aktiv"?: boolean,"bemerkung"?: string | null,"erstellt_am"?: string,"flaeche_min"?: number | null,"id"?: string,"lagen"?: (string)[],"marge_min"?: number | null,"name": string,"nur_wohnzone"?: boolean,"reserve_min"?: number | null,"team_id": string
                  }
                  Update: {
                    "aktiv"?: boolean,"bemerkung"?: string | null,"erstellt_am"?: string,"flaeche_min"?: number | null,"id"?: string,"lagen"?: (string)[],"marge_min"?: number | null,"name"?: string,"nur_wohnzone"?: boolean,"reserve_min"?: number | null,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "fonds_suchprofil_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team"
      referencedColumns: ["id"]
    }
                  ]
                },"gebaeude": {
                  Row: {
                    "baujahr": number | null,"e": number | null,"egid": number,"egrid": string | null,"energieflaeche": number | null,"geladen_am": string,"geschosse": number | null,"grundflaeche": number | null,"heizung": number | null,"heizung_energie": number | null,"heizung_seit": string | null,"kategorie": number | null,"klasse": number | null,"n": number | null,"volumen": number | null,"warmwasser_energie": number | null,"wohnflaeche": number | null,"wohnungen": number | null,"zimmer": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "baujahr"?: number | null,"e"?: number | null,"egid": number,"egrid"?: string | null,"energieflaeche"?: number | null,"geladen_am"?: string,"geschosse"?: number | null,"grundflaeche"?: number | null,"heizung"?: number | null,"heizung_energie"?: number | null,"heizung_seit"?: string | null,"kategorie"?: number | null,"klasse"?: number | null,"n"?: number | null,"volumen"?: number | null,"warmwasser_energie"?: number | null,"wohnflaeche"?: number | null,"wohnungen"?: number | null,"zimmer"?: number | null
                  }
                  Update: {
                    "baujahr"?: number | null,"e"?: number | null,"egid"?: number,"egrid"?: string | null,"energieflaeche"?: number | null,"geladen_am"?: string,"geschosse"?: number | null,"grundflaeche"?: number | null,"heizung"?: number | null,"heizung_energie"?: number | null,"heizung_seit"?: string | null,"kategorie"?: number | null,"klasse"?: number | null,"n"?: number | null,"volumen"?: number | null,"warmwasser_energie"?: number | null,"wohnflaeche"?: number | null,"wohnungen"?: number | null,"zimmer"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"gelegenheit": {
                  Row: {
                    "abgeschlossen_am": string | null,"anlass": string,"baugesuch_id": string | null,"begruendung": string | null,"ergebnis": string | null,"erkannt_am": string,"fremde_nachbarn": Json | null,"gemeldet_am": string | null,"id": string,"mandant_id": string | null,"prioritaet": number | null,"titel": string,"zustaendig": string | null,"zustand": string
                  }
                  ComputedFields: never
                  Insert: {
                    "abgeschlossen_am"?: string | null,"anlass": string,"baugesuch_id"?: string | null,"begruendung"?: string | null,"ergebnis"?: string | null,"erkannt_am"?: string,"fremde_nachbarn"?: Json | null,"gemeldet_am"?: string | null,"id"?: string,"mandant_id"?: string | null,"prioritaet"?: number | null,"titel": string,"zustaendig"?: string | null,"zustand"?: string
                  }
                  Update: {
                    "abgeschlossen_am"?: string | null,"anlass"?: string,"baugesuch_id"?: string | null,"begruendung"?: string | null,"ergebnis"?: string | null,"erkannt_am"?: string,"fremde_nachbarn"?: Json | null,"gemeldet_am"?: string | null,"id"?: string,"mandant_id"?: string | null,"prioritaet"?: number | null,"titel"?: string,"zustaendig"?: string | null,"zustand"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "gelegenheit_baugesuch_id_fkey"
      columns: ["baugesuch_id"]
isOneToOne: false
      referencedRelation: "baugesuch"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gelegenheit_mandant_id_fkey"
      columns: ["mandant_id"]
isOneToOne: false
      referencedRelation: "mandant"
      referencedColumns: ["id"]
    }
                  ]
                },"gelegenheit_parzelle": {
                  Row: {
                    "gelegenheit_id": string,"parzelle_id": string,"rolle": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "gelegenheit_id": string,"parzelle_id": string,"rolle"?: string | null
                  }
                  Update: {
                    "gelegenheit_id"?: string,"parzelle_id"?: string,"rolle"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "gelegenheit_parzelle_gelegenheit_id_fkey"
      columns: ["gelegenheit_id"]
isOneToOne: false
      referencedRelation: "gelegenheit"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "gelegenheit_parzelle_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: false
      referencedRelation: "nachbarn"
      referencedColumns: ["nachbar_id"]
    },{
      foreignKeyName: "gelegenheit_parzelle_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"geraet_benennung": {
                  Row: {
                    "geraet_id": string,"gesetzt_am": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "geraet_id": string,"gesetzt_am"?: string,"name": string
                  }
                  Update: {
                    "geraet_id"?: string,"gesetzt_am"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"gwr_eingang": {
                  Row: {
                    "deinr": string | null,"dexpdat": string | null,"dkode": string | null,"dkodn": string | null,"doffadr": string | null,"dplz4": string | null,"dplzname": string | null,"dplzz": string | null,"edid": string | null,"egaid": string | null,"egid": string | null,"esid": string | null,"strindx": string | null,"strname": string | null,"strnamk": string | null,"stroffiziel": string | null,"strsp": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "deinr"?: string | null,"dexpdat"?: string | null,"dkode"?: string | null,"dkodn"?: string | null,"doffadr"?: string | null,"dplz4"?: string | null,"dplzname"?: string | null,"dplzz"?: string | null,"edid"?: string | null,"egaid"?: string | null,"egid"?: string | null,"esid"?: string | null,"strindx"?: string | null,"strname"?: string | null,"strnamk"?: string | null,"stroffiziel"?: string | null,"strsp"?: string | null
                  }
                  Update: {
                    "deinr"?: string | null,"dexpdat"?: string | null,"dkode"?: string | null,"dkodn"?: string | null,"doffadr"?: string | null,"dplz4"?: string | null,"dplzname"?: string | null,"dplzz"?: string | null,"edid"?: string | null,"egaid"?: string | null,"egid"?: string | null,"esid"?: string | null,"strindx"?: string | null,"strname"?: string | null,"strnamk"?: string | null,"stroffiziel"?: string | null,"strsp"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"gwr_gebaeude": {
                  Row: {
                    "egid": string | null,"egrid": string | null,"gabbj": string | null,"ganzwhg": string | null,"garea": string | null,"gastw": string | null,"gazzi": string | null,"gbauj": string | null,"gbaum": string | null,"gbaup": string | null,"gbez": string | null,"gdekt": string | null,"gebf": string | null,"gebnr": string | null,"genh1": string | null,"genh2": string | null,"genw1": string | null,"genw2": string | null,"gexpdat": string | null,"ggdename": string | null,"ggdenr": string | null,"gkat": string | null,"gklas": string | null,"gkode": string | null,"gkodn": string | null,"gksce": string | null,"gschutzr": string | null,"gstat": string | null,"gvol": string | null,"gvolnorm": string | null,"gvolsce": string | null,"gwaerdath1": string | null,"gwaerdath2": string | null,"gwaerdatw1": string | null,"gwaerdatw2": string | null,"gwaersceh1": string | null,"gwaersceh2": string | null,"gwaerscew1": string | null,"gwaerscew2": string | null,"gwaerzh1": string | null,"gwaerzh2": string | null,"gwaerzw1": string | null,"gwaerzw2": string | null,"lgbkr": string | null,"lparz": string | null,"lparzsx": string | null,"ltyp": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "egid"?: string | null,"egrid"?: string | null,"gabbj"?: string | null,"ganzwhg"?: string | null,"garea"?: string | null,"gastw"?: string | null,"gazzi"?: string | null,"gbauj"?: string | null,"gbaum"?: string | null,"gbaup"?: string | null,"gbez"?: string | null,"gdekt"?: string | null,"gebf"?: string | null,"gebnr"?: string | null,"genh1"?: string | null,"genh2"?: string | null,"genw1"?: string | null,"genw2"?: string | null,"gexpdat"?: string | null,"ggdename"?: string | null,"ggdenr"?: string | null,"gkat"?: string | null,"gklas"?: string | null,"gkode"?: string | null,"gkodn"?: string | null,"gksce"?: string | null,"gschutzr"?: string | null,"gstat"?: string | null,"gvol"?: string | null,"gvolnorm"?: string | null,"gvolsce"?: string | null,"gwaerdath1"?: string | null,"gwaerdath2"?: string | null,"gwaerdatw1"?: string | null,"gwaerdatw2"?: string | null,"gwaersceh1"?: string | null,"gwaersceh2"?: string | null,"gwaerscew1"?: string | null,"gwaerscew2"?: string | null,"gwaerzh1"?: string | null,"gwaerzh2"?: string | null,"gwaerzw1"?: string | null,"gwaerzw2"?: string | null,"lgbkr"?: string | null,"lparz"?: string | null,"lparzsx"?: string | null,"ltyp"?: string | null
                  }
                  Update: {
                    "egid"?: string | null,"egrid"?: string | null,"gabbj"?: string | null,"ganzwhg"?: string | null,"garea"?: string | null,"gastw"?: string | null,"gazzi"?: string | null,"gbauj"?: string | null,"gbaum"?: string | null,"gbaup"?: string | null,"gbez"?: string | null,"gdekt"?: string | null,"gebf"?: string | null,"gebnr"?: string | null,"genh1"?: string | null,"genh2"?: string | null,"genw1"?: string | null,"genw2"?: string | null,"gexpdat"?: string | null,"ggdename"?: string | null,"ggdenr"?: string | null,"gkat"?: string | null,"gklas"?: string | null,"gkode"?: string | null,"gkodn"?: string | null,"gksce"?: string | null,"gschutzr"?: string | null,"gstat"?: string | null,"gvol"?: string | null,"gvolnorm"?: string | null,"gvolsce"?: string | null,"gwaerdath1"?: string | null,"gwaerdath2"?: string | null,"gwaerdatw1"?: string | null,"gwaerdatw2"?: string | null,"gwaersceh1"?: string | null,"gwaersceh2"?: string | null,"gwaerscew1"?: string | null,"gwaerscew2"?: string | null,"gwaerzh1"?: string | null,"gwaerzh2"?: string | null,"gwaerzw1"?: string | null,"gwaerzw2"?: string | null,"lgbkr"?: string | null,"lparz"?: string | null,"lparzsx"?: string | null,"ltyp"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"gwr_kode": {
                  Row: {
                    "code": number,"merkmal": string,"text": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": number,"merkmal": string,"text": string
                  }
                  Update: {
                    "code"?: number,"merkmal"?: string,"text"?: string
                  }
                  Relationships: [
                    
                  ]
                },"gwr_kodes": {
                  Row: {
                    "cecodid": string | null,"cexpdat": string | null,"cmerkm": string | null,"codtxtkd": string | null,"codtxtkf": string | null,"codtxtki": string | null,"codtxtld": string | null,"codtxtlf": string | null,"codtxtli": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cecodid"?: string | null,"cexpdat"?: string | null,"cmerkm"?: string | null,"codtxtkd"?: string | null,"codtxtkf"?: string | null,"codtxtki"?: string | null,"codtxtld"?: string | null,"codtxtlf"?: string | null,"codtxtli"?: string | null
                  }
                  Update: {
                    "cecodid"?: string | null,"cexpdat"?: string | null,"cmerkm"?: string | null,"codtxtkd"?: string | null,"codtxtkf"?: string | null,"codtxtki"?: string | null,"codtxtld"?: string | null,"codtxtlf"?: string | null,"codtxtli"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"import_logs": {
                  Row: {
                    "created_at": string,"details": Json | null,"file_name": string,"id": string,"list_id": string | null,"list_name": string | null,"new_gemeinden": number,"rows_duplicates": number,"rows_inserted": number,"rows_invalid": number,"rows_total": number,"rows_updated": number,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"details"?: Json | null,"file_name": string,"id"?: string,"list_id"?: string | null,"list_name"?: string | null,"new_gemeinden"?: number,"rows_duplicates"?: number,"rows_inserted"?: number,"rows_invalid"?: number,"rows_total"?: number,"rows_updated"?: number,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"details"?: Json | null,"file_name"?: string,"id"?: string,"list_id"?: string | null,"list_name"?: string | null,"new_gemeinden"?: number,"rows_duplicates"?: number,"rows_inserted"?: number,"rows_invalid"?: number,"rows_total"?: number,"rows_updated"?: number,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "import_logs_list_id_fkey"
      columns: ["list_id"]
isOneToOne: false
      referencedRelation: "property_lists"
      referencedColumns: ["id"]
    }
                  ]
                },"investor_treffer": {
                  Row: {
                    "gefunden_am": string,"gesehen_am": string | null,"parzelle_id": string,"profil_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "gefunden_am"?: string,"gesehen_am"?: string | null,"parzelle_id": string,"profil_id": string
                  }
                  Update: {
                    "gefunden_am"?: string,"gesehen_am"?: string | null,"parzelle_id"?: string,"profil_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "investor_treffer_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: false
      referencedRelation: "nachbarn"
      referencedColumns: ["nachbar_id"]
    },{
      foreignKeyName: "investor_treffer_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "investor_treffer_profil_id_fkey"
      columns: ["profil_id"]
isOneToOne: false
      referencedRelation: "investorprofil"
      referencedColumns: ["id"]
    }
                  ]
                },"investorprofil": {
                  Row: {
                    "akteur_id": string,"aktiv": boolean,"budget_max_chf": number | null,"budget_min_chf": number | null,"erfasst_am": string,"erfasst_von": string | null,"horizont": string | null,"id": string,"kriterien": string | null,"lagen": (string)[] | null,"objekttypen": (string)[] | null,"rendite_min_pct": number | null,"strategie": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "akteur_id": string,"aktiv"?: boolean,"budget_max_chf"?: number | null,"budget_min_chf"?: number | null,"erfasst_am"?: string,"erfasst_von"?: string | null,"horizont"?: string | null,"id"?: string,"kriterien"?: string | null,"lagen"?: (string)[] | null,"objekttypen"?: (string)[] | null,"rendite_min_pct"?: number | null,"strategie"?: string | null
                  }
                  Update: {
                    "akteur_id"?: string,"aktiv"?: boolean,"budget_max_chf"?: number | null,"budget_min_chf"?: number | null,"erfasst_am"?: string,"erfasst_von"?: string | null,"horizont"?: string | null,"id"?: string,"kriterien"?: string | null,"lagen"?: (string)[] | null,"objekttypen"?: (string)[] | null,"rendite_min_pct"?: number | null,"strategie"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "investorprofil_akteur_id_fkey"
      columns: ["akteur_id"]
isOneToOne: false
      referencedRelation: "akteur"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "investorprofil_akteur_id_fkey"
      columns: ["akteur_id"]
isOneToOne: false
      referencedRelation: "eigentuemer_zu_pruefen"
      referencedColumns: ["id"]
    }
                  ]
                },"kennzahl_ziel": {
                  Row: {
                    "ausgangs_am": string | null,"ausgangswert": number | null,"bemerkung": string | null,"geaendert_am": string,"kennzahl": string,"ziel": number | null,"ziel_bis": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ausgangs_am"?: string | null,"ausgangswert"?: number | null,"bemerkung"?: string | null,"geaendert_am"?: string,"kennzahl": string,"ziel"?: number | null,"ziel_bis"?: string | null
                  }
                  Update: {
                    "ausgangs_am"?: string | null,"ausgangswert"?: number | null,"bemerkung"?: string | null,"geaendert_am"?: string,"kennzahl"?: string,"ziel"?: number | null,"ziel_bis"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"kontakt": {
                  Row: {
                    "akteur_id": string,"bemerkung": string | null,"email": string | null,"entscheider": boolean,"erstellt_am": string,"funktion": string | null,"id": string,"name": string,"telefon": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "akteur_id": string,"bemerkung"?: string | null,"email"?: string | null,"entscheider"?: boolean,"erstellt_am"?: string,"funktion"?: string | null,"id"?: string,"name": string,"telefon"?: string | null
                  }
                  Update: {
                    "akteur_id"?: string,"bemerkung"?: string | null,"email"?: string | null,"entscheider"?: boolean,"erstellt_am"?: string,"funktion"?: string | null,"id"?: string,"name"?: string,"telefon"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "kontakt_akteur_id_fkey"
      columns: ["akteur_id"]
isOneToOne: false
      referencedRelation: "akteur"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "kontakt_akteur_id_fkey"
      columns: ["akteur_id"]
isOneToOne: false
      referencedRelation: "eigentuemer_zu_pruefen"
      referencedColumns: ["id"]
    }
                  ]
                },"lead_gebaeude": {
                  Row: {
                    "baujahr": number | null,"bfs": number,"e": number | null,"egid": number,"egrid": string | null,"erzeuger": number | null,"gemeinde": string,"heizung": number | null,"heizung_seit": string | null,"kanton": string,"klasse": number | null,"n": number | null,"ort": string | null,"periode": number | null,"plz": number | null,"strasse": string | null,"wohnungen": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "baujahr"?: number | null,"bfs": number,"e"?: number | null,"egid": number,"egrid"?: string | null,"erzeuger"?: number | null,"gemeinde": string,"heizung"?: number | null,"heizung_seit"?: string | null,"kanton": string,"klasse"?: number | null,"n"?: number | null,"ort"?: string | null,"periode"?: number | null,"plz"?: number | null,"strasse"?: string | null,"wohnungen"?: number | null
                  }
                  Update: {
                    "baujahr"?: number | null,"bfs"?: number,"e"?: number | null,"egid"?: number,"egrid"?: string | null,"erzeuger"?: number | null,"gemeinde"?: string,"heizung"?: number | null,"heizung_seit"?: string | null,"kanton"?: string,"klasse"?: number | null,"n"?: number | null,"ort"?: string | null,"periode"?: number | null,"plz"?: number | null,"strasse"?: string | null,"wohnungen"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"mandant": {
                  Row: {
                    "akteur_id": string,"aktiv": boolean,"anweisung": string | null,"bemerkung": string | null,"id": string,"produkt": string | null,"seit": string,"team_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "akteur_id": string,"aktiv"?: boolean,"anweisung"?: string | null,"bemerkung"?: string | null,"id"?: string,"produkt"?: string | null,"seit"?: string,"team_id"?: string | null
                  }
                  Update: {
                    "akteur_id"?: string,"aktiv"?: boolean,"anweisung"?: string | null,"bemerkung"?: string | null,"id"?: string,"produkt"?: string | null,"seit"?: string,"team_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "mandant_akteur_id_fkey"
      columns: ["akteur_id"]
isOneToOne: false
      referencedRelation: "akteur"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mandant_akteur_id_fkey"
      columns: ["akteur_id"]
isOneToOne: false
      referencedRelation: "eigentuemer_zu_pruefen"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mandant_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team"
      referencedColumns: ["id"]
    }
                  ]
                },"merkliste": {
                  Row: {
                    "erstellt_am": string,"erstellt_von": string,"filter": NonNullable<Json>,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "erstellt_am"?: string,"erstellt_von"?: string,"filter"?: NonNullable<Json>,"id"?: string,"name": string
                  }
                  Update: {
                    "erstellt_am"?: string,"erstellt_von"?: string,"filter"?: NonNullable<Json>,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"merkliste_eintrag": {
                  Row: {
                    "egid": number,"erstellt_am": string,"liste_id": string,"notiz": string | null,"parzelle_id": string | null,"stand": string,"stand_am": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "egid": number,"erstellt_am"?: string,"liste_id": string,"notiz"?: string | null,"parzelle_id"?: string | null,"stand"?: string,"stand_am"?: string | null
                  }
                  Update: {
                    "egid"?: number,"erstellt_am"?: string,"liste_id"?: string,"notiz"?: string | null,"parzelle_id"?: string | null,"stand"?: string,"stand_am"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "merkliste_eintrag_liste_id_fkey"
      columns: ["liste_id"]
isOneToOne: false
      referencedRelation: "merkliste"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "merkliste_eintrag_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: false
      referencedRelation: "nachbarn"
      referencedColumns: ["nachbar_id"]
    },{
      foreignKeyName: "merkliste_eintrag_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"nachbar_auswahl": {
                  Row: {
                    "geaendert_am": string,"geaendert_von": string | null,"nachbar_egrid": string,"notiz": string | null,"portfolio": string,"stand": string
                  }
                  ComputedFields: never
                  Insert: {
                    "geaendert_am"?: string,"geaendert_von"?: string | null,"nachbar_egrid": string,"notiz"?: string | null,"portfolio": string,"stand"?: string
                  }
                  Update: {
                    "geaendert_am"?: string,"geaendert_von"?: string | null,"nachbar_egrid"?: string,"notiz"?: string | null,"portfolio"?: string,"stand"?: string
                  }
                  Relationships: [
                    
                  ]
                },"nachbar_potenzial": {
                  Row: {
                    "az_heute": number | null,"baujahr": number | null,"e": number | null,"flaeche": number | null,"geb_liste": Json | null,"gebaeude": number | null,"gefaess": string | null,"gemeinde": string | null,"gerechnet_am": string,"geschosse": number | null,"gf_heute": number | null,"gruende": string | null,"haupt_adresse": string,"haupt_baujahr": number | null,"haupt_egrid": string,"haupt_flaeche": number | null,"haupt_geb_liste": Json | null,"haupt_gebaeude": number | null,"haupt_gf_heute": number | null,"haupt_nummer": string | null,"haupt_umriss": Json | null,"haupt_wohnungen": number | null,"haupt_zone": string | null,"id": number,"kanton": string | null,"n": number | null,"nachbar_egrid": string,"nummer": string | null,"portfolio": string,"position": number,"punkte": number,"umriss": Json | null,"wohnungen": number | null,"zone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "az_heute"?: number | null,"baujahr"?: number | null,"e"?: number | null,"flaeche"?: number | null,"geb_liste"?: Json | null,"gebaeude"?: number | null,"gefaess"?: string | null,"gemeinde"?: string | null,"gerechnet_am"?: string,"geschosse"?: number | null,"gf_heute"?: number | null,"gruende"?: string | null,"haupt_adresse": string,"haupt_baujahr"?: number | null,"haupt_egrid": string,"haupt_flaeche"?: number | null,"haupt_geb_liste"?: Json | null,"haupt_gebaeude"?: number | null,"haupt_gf_heute"?: number | null,"haupt_nummer"?: string | null,"haupt_umriss"?: Json | null,"haupt_wohnungen"?: number | null,"haupt_zone"?: string | null,"id"?: number,"kanton"?: string | null,"n"?: number | null,"nachbar_egrid": string,"nummer"?: string | null,"portfolio": string,"position": number,"punkte"?: number,"umriss"?: Json | null,"wohnungen"?: number | null,"zone"?: string | null
                  }
                  Update: {
                    "az_heute"?: number | null,"baujahr"?: number | null,"e"?: number | null,"flaeche"?: number | null,"geb_liste"?: Json | null,"gebaeude"?: number | null,"gefaess"?: string | null,"gemeinde"?: string | null,"gerechnet_am"?: string,"geschosse"?: number | null,"gf_heute"?: number | null,"gruende"?: string | null,"haupt_adresse"?: string,"haupt_baujahr"?: number | null,"haupt_egrid"?: string,"haupt_flaeche"?: number | null,"haupt_geb_liste"?: Json | null,"haupt_gebaeude"?: number | null,"haupt_gf_heute"?: number | null,"haupt_nummer"?: string | null,"haupt_umriss"?: Json | null,"haupt_wohnungen"?: number | null,"haupt_zone"?: string | null,"id"?: number,"kanton"?: string | null,"n"?: number | null,"nachbar_egrid"?: string,"nummer"?: string | null,"portfolio"?: string,"position"?: number,"punkte"?: number,"umriss"?: Json | null,"wohnungen"?: number | null,"zone"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"nachbarschaft": {
                  Row: {
                    "berechnet_am": string,"distanz_m": number,"grenzlaenge_m": number | null,"nachbar_id": string,"parzelle_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "berechnet_am"?: string,"distanz_m"?: number,"grenzlaenge_m"?: number | null,"nachbar_id": string,"parzelle_id": string
                  }
                  Update: {
                    "berechnet_am"?: string,"distanz_m"?: number,"grenzlaenge_m"?: number | null,"nachbar_id"?: string,"parzelle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "nachbarschaft_nachbar_id_fkey"
      columns: ["nachbar_id"]
isOneToOne: false
      referencedRelation: "nachbarn"
      referencedColumns: ["nachbar_id"]
    },{
      foreignKeyName: "nachbarschaft_nachbar_id_fkey"
      columns: ["nachbar_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "nachbarschaft_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: false
      referencedRelation: "nachbarn"
      referencedColumns: ["nachbar_id"]
    },{
      foreignKeyName: "nachbarschaft_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"parzelle_punkt": {
                  Row: {
                    "e": number,"erfasst_am": string,"n": number,"parzelle_id": string,"quelle": string
                  }
                  ComputedFields: never
                  Insert: {
                    "e": number,"erfasst_am"?: string,"n": number,"parzelle_id": string,"quelle"?: string
                  }
                  Update: {
                    "e"?: number,"erfasst_am"?: string,"n"?: number,"parzelle_id"?: string,"quelle"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "parzelle_punkt_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: true
      referencedRelation: "nachbarn"
      referencedColumns: ["nachbar_id"]
    },{
      foreignKeyName: "parzelle_punkt_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: true
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"phone_numbers": {
                  Row: {
                    "created_at": string,"daily_queries_used": number,"id": string,"label": string | null,"last_query_date": string | null,"number": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"daily_queries_used"?: number,"id"?: string,"label"?: string | null,"last_query_date"?: string | null,"number": string
                  }
                  Update: {
                    "created_at"?: string,"daily_queries_used"?: number,"id"?: string,"label"?: string | null,"last_query_date"?: string | null,"number"?: string
                  }
                  Relationships: [
                    
                  ]
                },"phone_search_logs": {
                  Row: {
                    "created_at": string,"error_text": string | null,"id": string,"owner_name": string | null,"phone_number_id": string | null,"property_id": string,"result": string | null,"retry_count": number,"search_query": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"error_text"?: string | null,"id"?: string,"owner_name"?: string | null,"phone_number_id"?: string | null,"property_id": string,"result"?: string | null,"retry_count"?: number,"search_query"?: string | null,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"error_text"?: string | null,"id"?: string,"owner_name"?: string | null,"phone_number_id"?: string | null,"property_id"?: string,"result"?: string | null,"retry_count"?: number,"search_query"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "phone_search_logs_phone_number_id_fkey"
      columns: ["phone_number_id"]
isOneToOne: false
      referencedRelation: "phone_numbers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "phone_search_logs_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "nachbarn"
      referencedColumns: ["nachbar_id"]
    },{
      foreignKeyName: "phone_search_logs_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"portfolio": {
                  Row: {
                    "erstellt_am": string,"id": string,"mandant_id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "erstellt_am"?: string,"id"?: string,"mandant_id": string,"name": string
                  }
                  Update: {
                    "erstellt_am"?: string,"id"?: string,"mandant_id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "portfolio_mandant_id_fkey"
      columns: ["mandant_id"]
isOneToOne: false
      referencedRelation: "mandant"
      referencedColumns: ["id"]
    }
                  ]
                },"portfolio_position": {
                  Row: {
                    "e": number | null,"egrid": string | null,"erstellt_am": string,"flaeche": number | null,"gemeinde": string | null,"id": string,"kanton": string | null,"n": number | null,"nachbar_egrids": (string)[],"parzelle_id": string | null,"portfolio_id": string,"roh_adresse": string | null,"zuordnung": string
                  }
                  ComputedFields: never
                  Insert: {
                    "e"?: number | null,"egrid"?: string | null,"erstellt_am"?: string,"flaeche"?: number | null,"gemeinde"?: string | null,"id"?: string,"kanton"?: string | null,"n"?: number | null,"nachbar_egrids"?: (string)[],"parzelle_id"?: string | null,"portfolio_id": string,"roh_adresse"?: string | null,"zuordnung"?: string
                  }
                  Update: {
                    "e"?: number | null,"egrid"?: string | null,"erstellt_am"?: string,"flaeche"?: number | null,"gemeinde"?: string | null,"id"?: string,"kanton"?: string | null,"n"?: number | null,"nachbar_egrids"?: (string)[],"parzelle_id"?: string | null,"portfolio_id"?: string,"roh_adresse"?: string | null,"zuordnung"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "portfolio_position_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: false
      referencedRelation: "nachbarn"
      referencedColumns: ["nachbar_id"]
    },{
      foreignKeyName: "portfolio_position_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "portfolio_position_portfolio_id_fkey"
      columns: ["portfolio_id"]
isOneToOne: false
      referencedRelation: "portfolio"
      referencedColumns: ["id"]
    }
                  ]
                },"potenzial_config": {
                  Row: {
                    "attika_faktor": number,"az_by_zone": NonNullable<Json>,"baukosten_pro_m2": number,"erloes_pro_m2_hnf": number,"geschosshoehe": number,"hnf_faktor": number,"id": boolean,"min_reserve_m2": number,"mit_attika": boolean,"updated_at": string,"ziel_reserve_quote": number,"ziffer_als_bmz": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "attika_faktor"?: number,"az_by_zone"?: NonNullable<Json>,"baukosten_pro_m2"?: number,"erloes_pro_m2_hnf"?: number,"geschosshoehe"?: number,"hnf_faktor"?: number,"id"?: boolean,"min_reserve_m2"?: number,"mit_attika"?: boolean,"updated_at"?: string,"ziel_reserve_quote"?: number,"ziffer_als_bmz"?: boolean
                  }
                  Update: {
                    "attika_faktor"?: number,"az_by_zone"?: NonNullable<Json>,"baukosten_pro_m2"?: number,"erloes_pro_m2_hnf"?: number,"geschosshoehe"?: number,"hnf_faktor"?: number,"id"?: boolean,"min_reserve_m2"?: number,"mit_attika"?: boolean,"updated_at"?: string,"ziel_reserve_quote"?: number,"ziffer_als_bmz"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"email": string | null,"id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"email"?: string | null,"id"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"email"?: string | null,"id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"properties": {
                  Row: {
                    "acquisition_status": string,"address": string,"ai_last_analyzed_at": string | null,"ai_priority": number | null,"ai_recommendation": string | null,"ai_score": number | null,"ai_summary": string | null,"anrechenbare_geschosse": number | null,"area": number | null,"assigned_to": string | null,"ausgeschlossen": boolean,"ausnuetzung": number | null,"ausschluss_grund": string | null,"az_quelle": string | null,"baujahr": number | null,"bebaubar_m2": number | null,"bezirk": string | null,"bezirksort": string | null,"bfs_nr": string | null,"confidence": string | null,"contact_attempts": number,"created_at": string,"deal_score": number | null,"decided_at": string | null,"decided_by": string | null,"decision_source": string | null,"denkmalschutz": string | null,"denkmalschutz_titel": string | null,"duplicate_flag": boolean | null,"duplicate_group_id": string | null,"egrid": string | null,"eigentuemer_adresse": string | null,"eigentuemer_fetched_at": string | null,"eigentuemer_name": string | null,"eigentuemer_plz_ort": string | null,"erloes_chf": number | null,"export_status": string,"follow_up_at": string | null,"geb_status": string | null,"gebaeude_anzahl": number,"gebaeudeart": string | null,"gebaeudeflaeche": number | null,"gemeinde": string | null,"geometrie": unknown,"geometrie_quelle": string | null,"geometrie_stand": string | null,"geschosse": number | null,"gf_bestand": number | null,"gf_zulaessig": number | null,"gis_url": string | null,"google_maps_url": string | null,"gvz_nr": string | null,"gwr_egid": string | null,"hausnummer": string | null,"hnf_bestand": number | null,"hnf_delta": number | null,"hnf_faktor": number | null,"hnf_neu": number | null,"hnf_schaetzung": number | null,"housing_stat_url": string | null,"id": string,"imported_at": string,"investition_chf": number | null,"is_queried": boolean,"isos": string | null,"isos_titel": string | null,"kanton": string | null,"kategorie": string | null,"last_contact_at": string | null,"last_export_at": string | null,"last_phone_search_at": string | null,"list_id": string | null,"marge_chf": number | null,"marge_quote": number | null,"nachbarn_stand": string | null,"notes": string | null,"nutzflaeche": number | null,"objektadresse": string | null,"ortschaftsname": string | null,"owner_address": string | null,"owner_address_2": string | null,"owner_name": string | null,"owner_name_2": string | null,"owner_phone": string | null,"owner_phone_2": string | null,"owners_json": Json | null,"parzelle": string | null,"phone_search_status": string,"pipedrive_deal_id": string | null,"plot_number": string | null,"plz": string | null,"plz_ort": string | null,"potenzial_score": number | null,"preselection_decided_at": string | null,"preselection_note": string | null,"preselection_status": string,"processing_error": string | null,"queried_at": string | null,"queried_by_phone": string | null,"renovationsjahr": number | null,"reserve_gf": number | null,"reserve_quote": number | null,"review_status": string,"score_killers": Json | null,"score_reasons": Json | null,"score_tier": string | null,"scored_at": string | null,"source_file": string | null,"stage_changed_at": string | null,"status": string,"strassenname": string | null,"streetview_url": string | null,"updated_at": string,"vollgeschosse": number | null,"vollgeschosse_zulaessig": number | null,"wohnflaeche": number | null,"wohnungen": number | null,"zone": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "acquisition_status"?: string,"address": string,"ai_last_analyzed_at"?: string | null,"ai_priority"?: number | null,"ai_recommendation"?: string | null,"ai_score"?: number | null,"ai_summary"?: string | null,"anrechenbare_geschosse"?: number | null,"area"?: number | null,"assigned_to"?: string | null,"ausgeschlossen"?: boolean,"ausnuetzung"?: number | null,"ausschluss_grund"?: string | null,"az_quelle"?: string | null,"baujahr"?: number | null,"bebaubar_m2"?: number | null,"bezirk"?: string | null,"bezirksort"?: string | null,"bfs_nr"?: string | null,"confidence"?: string | null,"contact_attempts"?: number,"created_at"?: string,"deal_score"?: number | null,"decided_at"?: string | null,"decided_by"?: string | null,"decision_source"?: string | null,"denkmalschutz"?: string | null,"denkmalschutz_titel"?: string | null,"duplicate_flag"?: boolean | null,"duplicate_group_id"?: string | null,"egrid"?: string | null,"eigentuemer_adresse"?: string | null,"eigentuemer_fetched_at"?: string | null,"eigentuemer_name"?: string | null,"eigentuemer_plz_ort"?: string | null,"erloes_chf"?: number | null,"export_status"?: string,"follow_up_at"?: string | null,"geb_status"?: string | null,"gebaeude_anzahl"?: number,"gebaeudeart"?: string | null,"gebaeudeflaeche"?: number | null,"gemeinde"?: string | null,"geometrie"?: unknown,"geometrie_quelle"?: string | null,"geometrie_stand"?: string | null,"geschosse"?: number | null,"gf_bestand"?: number | null,"gf_zulaessig"?: number | null,"gis_url"?: string | null,"google_maps_url"?: string | null,"gvz_nr"?: string | null,"gwr_egid"?: string | null,"hausnummer"?: string | null,"hnf_bestand"?: number | null,"hnf_delta"?: number | null,"hnf_faktor"?: number | null,"hnf_neu"?: number | null,"hnf_schaetzung"?: number | null,"housing_stat_url"?: string | null,"id"?: string,"imported_at"?: string,"investition_chf"?: number | null,"is_queried"?: boolean,"isos"?: string | null,"isos_titel"?: string | null,"kanton"?: string | null,"kategorie"?: string | null,"last_contact_at"?: string | null,"last_export_at"?: string | null,"last_phone_search_at"?: string | null,"list_id"?: string | null,"marge_chf"?: number | null,"marge_quote"?: number | null,"nachbarn_stand"?: string | null,"notes"?: string | null,"nutzflaeche"?: number | null,"objektadresse"?: string | null,"ortschaftsname"?: string | null,"owner_address"?: string | null,"owner_address_2"?: string | null,"owner_name"?: string | null,"owner_name_2"?: string | null,"owner_phone"?: string | null,"owner_phone_2"?: string | null,"owners_json"?: Json | null,"parzelle"?: string | null,"phone_search_status"?: string,"pipedrive_deal_id"?: string | null,"plot_number"?: string | null,"plz"?: string | null,"plz_ort"?: string | null,"potenzial_score"?: number | null,"preselection_decided_at"?: string | null,"preselection_note"?: string | null,"preselection_status"?: string,"processing_error"?: string | null,"queried_at"?: string | null,"queried_by_phone"?: string | null,"renovationsjahr"?: number | null,"reserve_gf"?: number | null,"reserve_quote"?: number | null,"review_status"?: string,"score_killers"?: Json | null,"score_reasons"?: Json | null,"score_tier"?: string | null,"scored_at"?: string | null,"source_file"?: string | null,"stage_changed_at"?: string | null,"status"?: string,"strassenname"?: string | null,"streetview_url"?: string | null,"updated_at"?: string,"vollgeschosse"?: number | null,"vollgeschosse_zulaessig"?: number | null,"wohnflaeche"?: number | null,"wohnungen"?: number | null,"zone"?: string | null
                  }
                  Update: {
                    "acquisition_status"?: string,"address"?: string,"ai_last_analyzed_at"?: string | null,"ai_priority"?: number | null,"ai_recommendation"?: string | null,"ai_score"?: number | null,"ai_summary"?: string | null,"anrechenbare_geschosse"?: number | null,"area"?: number | null,"assigned_to"?: string | null,"ausgeschlossen"?: boolean,"ausnuetzung"?: number | null,"ausschluss_grund"?: string | null,"az_quelle"?: string | null,"baujahr"?: number | null,"bebaubar_m2"?: number | null,"bezirk"?: string | null,"bezirksort"?: string | null,"bfs_nr"?: string | null,"confidence"?: string | null,"contact_attempts"?: number,"created_at"?: string,"deal_score"?: number | null,"decided_at"?: string | null,"decided_by"?: string | null,"decision_source"?: string | null,"denkmalschutz"?: string | null,"denkmalschutz_titel"?: string | null,"duplicate_flag"?: boolean | null,"duplicate_group_id"?: string | null,"egrid"?: string | null,"eigentuemer_adresse"?: string | null,"eigentuemer_fetched_at"?: string | null,"eigentuemer_name"?: string | null,"eigentuemer_plz_ort"?: string | null,"erloes_chf"?: number | null,"export_status"?: string,"follow_up_at"?: string | null,"geb_status"?: string | null,"gebaeude_anzahl"?: number,"gebaeudeart"?: string | null,"gebaeudeflaeche"?: number | null,"gemeinde"?: string | null,"geometrie"?: unknown,"geometrie_quelle"?: string | null,"geometrie_stand"?: string | null,"geschosse"?: number | null,"gf_bestand"?: number | null,"gf_zulaessig"?: number | null,"gis_url"?: string | null,"google_maps_url"?: string | null,"gvz_nr"?: string | null,"gwr_egid"?: string | null,"hausnummer"?: string | null,"hnf_bestand"?: number | null,"hnf_delta"?: number | null,"hnf_faktor"?: number | null,"hnf_neu"?: number | null,"hnf_schaetzung"?: number | null,"housing_stat_url"?: string | null,"id"?: string,"imported_at"?: string,"investition_chf"?: number | null,"is_queried"?: boolean,"isos"?: string | null,"isos_titel"?: string | null,"kanton"?: string | null,"kategorie"?: string | null,"last_contact_at"?: string | null,"last_export_at"?: string | null,"last_phone_search_at"?: string | null,"list_id"?: string | null,"marge_chf"?: number | null,"marge_quote"?: number | null,"nachbarn_stand"?: string | null,"notes"?: string | null,"nutzflaeche"?: number | null,"objektadresse"?: string | null,"ortschaftsname"?: string | null,"owner_address"?: string | null,"owner_address_2"?: string | null,"owner_name"?: string | null,"owner_name_2"?: string | null,"owner_phone"?: string | null,"owner_phone_2"?: string | null,"owners_json"?: Json | null,"parzelle"?: string | null,"phone_search_status"?: string,"pipedrive_deal_id"?: string | null,"plot_number"?: string | null,"plz"?: string | null,"plz_ort"?: string | null,"potenzial_score"?: number | null,"preselection_decided_at"?: string | null,"preselection_note"?: string | null,"preselection_status"?: string,"processing_error"?: string | null,"queried_at"?: string | null,"queried_by_phone"?: string | null,"renovationsjahr"?: number | null,"reserve_gf"?: number | null,"reserve_quote"?: number | null,"review_status"?: string,"score_killers"?: Json | null,"score_reasons"?: Json | null,"score_tier"?: string | null,"scored_at"?: string | null,"source_file"?: string | null,"stage_changed_at"?: string | null,"status"?: string,"strassenname"?: string | null,"streetview_url"?: string | null,"updated_at"?: string,"vollgeschosse"?: number | null,"vollgeschosse_zulaessig"?: number | null,"wohnflaeche"?: number | null,"wohnungen"?: number | null,"zone"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "properties_list_id_fkey"
      columns: ["list_id"]
isOneToOne: false
      referencedRelation: "property_lists"
      referencedColumns: ["id"]
    }
                  ]
                },"property_decisions": {
                  Row: {
                    "ai_recommendation": string | null,"ai_score": number | null,"ai_summary": string | null,"created_at": string,"decision_matches_ai": boolean | null,"feedback_note": string | null,"id": string,"property_id": string,"user_decision": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_recommendation"?: string | null,"ai_score"?: number | null,"ai_summary"?: string | null,"created_at"?: string,"decision_matches_ai"?: boolean | null,"feedback_note"?: string | null,"id"?: string,"property_id": string,"user_decision": string,"user_id"?: string | null
                  }
                  Update: {
                    "ai_recommendation"?: string | null,"ai_score"?: number | null,"ai_summary"?: string | null,"created_at"?: string,"decision_matches_ai"?: boolean | null,"feedback_note"?: string | null,"id"?: string,"property_id"?: string,"user_decision"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "property_decisions_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "nachbarn"
      referencedColumns: ["nachbar_id"]
    },{
      foreignKeyName: "property_decisions_property_id_fkey"
      columns: ["property_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"property_lists": {
                  Row: {
                    "color": string | null,"created_at": string,"id": string,"name": string,"priority": number,"property_count": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string | null,"created_at"?: string,"id"?: string,"name": string,"priority"?: number,"property_count"?: number,"updated_at"?: string
                  }
                  Update: {
                    "color"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"priority"?: number,"property_count"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"saved_filters": {
                  Row: {
                    "created_at": string,"filters": NonNullable<Json>,"id": string,"name": string,"scope": string,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"filters"?: NonNullable<Json>,"id"?: string,"name": string,"scope"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"filters"?: NonNullable<Json>,"id"?: string,"name"?: string,"scope"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"schema_migrationen": {
                  Row: {
                    "angewendet": string,"datei": string
                  }
                  ComputedFields: never
                  Insert: {
                    "angewendet"?: string,"datei": string
                  }
                  Update: {
                    "angewendet"?: string,"datei"?: string
                  }
                  Relationships: [
                    
                  ]
                },"team": {
                  Row: {
                    "art": string,"erstellt_am": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "art"?: string,"erstellt_am"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "art"?: string,"erstellt_am"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"team_mitglied": {
                  Row: {
                    "seit": string,"team_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "seit"?: string,"team_id": string,"user_id": string
                  }
                  Update: {
                    "seit"?: string,"team_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_mitglied_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team"
      referencedColumns: ["id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "created_at": string,"id": string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"verschnitt_tg": {
                  Row: {
                    "anteil_prozent": number | null,"art": string | null,"egrid": string | null,"flaeche_m2": number | null,"parzelle": string | null,"vermessungskreis": string | null,"zone_kurz": string | null,"zone_m2": number | null,"zone_name": string | null,"zone_typ": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anteil_prozent"?: number | null,"art"?: string | null,"egrid"?: string | null,"flaeche_m2"?: number | null,"parzelle"?: string | null,"vermessungskreis"?: string | null,"zone_kurz"?: string | null,"zone_m2"?: number | null,"zone_name"?: string | null,"zone_typ"?: string | null
                  }
                  Update: {
                    "anteil_prozent"?: number | null,"art"?: string | null,"egrid"?: string | null,"flaeche_m2"?: number | null,"parzelle"?: string | null,"vermessungskreis"?: string | null,"zone_kurz"?: string | null,"zone_m2"?: number | null,"zone_name"?: string | null,"zone_typ"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"verwaltung": {
                  Row: {
                    "akteur_id": string,"id": string,"parzelle_id": string,"rolle": string | null,"seit": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "akteur_id": string,"id"?: string,"parzelle_id": string,"rolle"?: string | null,"seit"?: string | null
                  }
                  Update: {
                    "akteur_id"?: string,"id"?: string,"parzelle_id"?: string,"rolle"?: string | null,"seit"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "verwaltung_akteur_id_fkey"
      columns: ["akteur_id"]
isOneToOne: false
      referencedRelation: "akteur"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verwaltung_akteur_id_fkey"
      columns: ["akteur_id"]
isOneToOne: false
      referencedRelation: "eigentuemer_zu_pruefen"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "verwaltung_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: false
      referencedRelation: "nachbarn"
      referencedColumns: ["nachbar_id"]
    },{
      foreignKeyName: "verwaltung_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"vorhaben": {
                  Row: {
                    "art": string,"beschreibung": string | null,"erstellt_am": string,"geaendert_am": string,"id": string,"lagen": (string)[] | null,"mandant_id": string,"objekttypen": (string)[] | null,"portfolio_id": string | null,"titel": string,"vollmacht_am": string | null,"vollmacht_von": string | null,"zeitraum_bis": string | null,"zustaendig": string | null,"zustand": string
                  }
                  ComputedFields: never
                  Insert: {
                    "art": string,"beschreibung"?: string | null,"erstellt_am"?: string,"geaendert_am"?: string,"id"?: string,"lagen"?: (string)[] | null,"mandant_id": string,"objekttypen"?: (string)[] | null,"portfolio_id"?: string | null,"titel": string,"vollmacht_am"?: string | null,"vollmacht_von"?: string | null,"zeitraum_bis"?: string | null,"zustaendig"?: string | null,"zustand"?: string
                  }
                  Update: {
                    "art"?: string,"beschreibung"?: string | null,"erstellt_am"?: string,"geaendert_am"?: string,"id"?: string,"lagen"?: (string)[] | null,"mandant_id"?: string,"objekttypen"?: (string)[] | null,"portfolio_id"?: string | null,"titel"?: string,"vollmacht_am"?: string | null,"vollmacht_von"?: string | null,"zeitraum_bis"?: string | null,"zustaendig"?: string | null,"zustand"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vorhaben_mandant_id_fkey"
      columns: ["mandant_id"]
isOneToOne: false
      referencedRelation: "mandant"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vorhaben_portfolio_id_fkey"
      columns: ["portfolio_id"]
isOneToOne: false
      referencedRelation: "portfolio"
      referencedColumns: ["id"]
    }
                  ]
                },"vorhaben_eintrag": {
                  Row: {
                    "am": string,"art": string,"id": string,"text": string,"von": string | null,"vorhaben_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "am"?: string,"art"?: string,"id"?: string,"text": string,"von"?: string | null,"vorhaben_id": string
                  }
                  Update: {
                    "am"?: string,"art"?: string,"id"?: string,"text"?: string,"von"?: string | null,"vorhaben_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vorhaben_eintrag_vorhaben_id_fkey"
      columns: ["vorhaben_id"]
isOneToOne: false
      referencedRelation: "vorhaben"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vorhaben_eintrag_vorhaben_id_fkey"
      columns: ["vorhaben_id"]
isOneToOne: false
      referencedRelation: "vorhaben_liste"
      referencedColumns: ["id"]
    }
                  ]
                },"zone_ziffer": {
                  Row: {
                    "abkuerzung": string | null,"art": string | null,"art_kurz": string | null,"bezeichnung": string | null,"code": string | null,"geom": unknown,"id": number,"kanton": string,"ziffer": number
                  }
                  ComputedFields: never
                  Insert: {
                    "abkuerzung"?: string | null,"art"?: string | null,"art_kurz"?: string | null,"bezeichnung"?: string | null,"code"?: string | null,"geom": unknown,"id"?: number,"kanton": string,"ziffer": number
                  }
                  Update: {
                    "abkuerzung"?: string | null,"art"?: string | null,"art_kurz"?: string | null,"bezeichnung"?: string | null,"code"?: string | null,"geom"?: unknown,"id"?: number,"kanton"?: string,"ziffer"?: number
                  }
                  Relationships: [
                    
                  ]
                },"zonentypen": {
                  Row: {
                    "abkuerzung": string | null,"bezeichnung": string | null,"code": string | null,"typ_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "abkuerzung"?: string | null,"bezeichnung"?: string | null,"code"?: string | null,"typ_id"?: string | null
                  }
                  Update: {
                    "abkuerzung"?: string | null,"bezeichnung"?: string | null,"code"?: string | null,"typ_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "eigentuemer_zu_pruefen": {
                  Row: {
                    "art": string,"grund": string | null,"id": string,"name": string,"ort": string | null,"parzellen": number | null,"plz": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "art"?: string | null,"grund"?: never,"id"?: string | null,"name"?: string | null,"ort"?: string | null,"parzellen"?: never,"plz"?: string | null
                         }
                        Update: {
                           "art"?: string | null,"grund"?: never,"id"?: string | null,"name"?: string | null,"ort"?: string | null,"parzellen"?: never,"plz"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"gemeinde_stats_mv": {
                  Row: {
                    "gemeinde": string | null,"geprueft": number | null,"interessant": number | null,"kanton": string | null,"offen": number | null,"total": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"lead_gebaeude_gemeinden": {
                  Row: {
                    "bfs": number,"gebaeude": number | null,"gemeinde": string,"kanton": string
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"nachbarn": {
                  Row: {
                    "grenzlaenge_m": number | null,"nachbar_adresse": string,"nachbar_egrid": string | null,"nachbar_flaeche": number | null,"nachbar_gemeinde": string | null,"nachbar_id": string,"nachbar_kanton": string | null,"nachbar_parzelle": string | null,"nachbar_zone": string | null,"parzelle_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "nachbarschaft_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: false
      referencedRelation: "nachbarn"
      referencedColumns: ["nachbar_id"]
    },{
      foreignKeyName: "nachbarschaft_parzelle_id_fkey"
      columns: ["parzelle_id"]
isOneToOne: false
      referencedRelation: "properties"
      referencedColumns: ["id"]
    }
                  ]
                },"parzelle_gebaeude": {
                  Row: {
                    "baujahr_aeltestes": number | null,"baujahr_juengstes": number | null,"egrid": string | null,"energieflaeche": number | null,"fossil": boolean | null,"gebaeude": number | null,"geschosse_max": number | null,"haupt_baujahr": number | null,"haupt_heizung": number | null,"haupt_heizung_energie": number | null,"haupt_heizung_seit": string | null,"wohnflaeche": number | null,"wohnungen": number | null,"zimmer": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"vorhaben_liste": {
                  Row: {
                    "adressen": number | null,"art": string,"beschreibung": string | null,"erstellt_am": string,"geaendert_am": string,"id": string,"kunde": string,"kunde_art": string,"lagen": (string)[] | null,"letzter_eintrag": string | null,"mandant_id": string,"objekttypen": (string)[] | null,"portfolio_id": string | null,"titel": string,"vollmacht_am": string | null,"vollmacht_von": string | null,"zeitraum_bis": string | null,"zustaendig": string | null,"zustand": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "vorhaben_mandant_id_fkey"
      columns: ["mandant_id"]
isOneToOne: false
      referencedRelation: "mandant"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vorhaben_portfolio_id_fkey"
      columns: ["portfolio_id"]
isOneToOne: false
      referencedRelation: "portfolio"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "akteur_art":
{ Args: { "p_name": string }; Returns: string
                           },
"akteur_art_aus_name":
{ Args: { "p_name": string }; Returns: string
                           },
"akteur_name_umgedreht":
{ Args: { "p_name": string }; Returns: boolean
                           },
"akteur_norm":
{ Args: { "p_name": string }; Returns: string
                           },
"akteur_parzellen":
{ Args: { "p_akteur": string }; Returns: {
              "adresse": string,"area": number,"egrid": string,"gemeinde": string,"geprueft": boolean,"parzelle_id": string,"quelle": string
            }[]
                           },
"anmeldung_merken":
{ Args: { "p_geraet"?: string,"p_geraet_id"?: string,"p_ort"?: string,"p_ort_ip"?: string }; Returns: undefined
                           },
"arbeitstage":
{ Args: { "p_tage"?: number }; Returns: {
              "abfragen": number,"bis": string,"eintraege": number,"email": string,"minuten": number,"tag": string,"user_id": string,"von": string
            }[]
                           },
"ausschluss_grund_von":
{ Args: { "p_denkmalschutz": string,"p_zone": string }; Returns: string
                           },
"baugesuche_abgleichen":
{ Args: { "p_tage"?: number }; Returns: {
              "gelegenheiten": number,"per_egrid": number,"per_nummer": number
            }[]
                           },
"baugesuche_umkreis":
{ Args: { "p_e": number,"p_kanton": string,"p_meter"?: number,"p_n": number }; Returns: Json
                           },
"calc_potenzial":
{ Args: { "p_area": number,"p_ausnuetzung": number,"p_baujahr": number,"p_denkmalschutz": string,"p_gebaeudeflaeche": number,"p_geschosse": number,"p_isos": string,"p_renovationsjahr": number,"p_vollgeschosse": number,"p_zone": string }; Returns: Json
                           },
"check_trichter":
{ Args: { "von"?: string }; Returns: {
              "domain": string,"ereignis": string,"marke": string,"quelle": string,"sitzungen": number
            }[]
                           },
"darf_mandant":
{ Args: { "p_mandant": string }; Returns: boolean
                           },
"darf_team":
{ Args: { "p_team": string }; Returns: boolean
                           },
"daten_stand":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"eigentuemer_uebernehmen":
{ Args: Record<PropertyKey, never>; Returns: {
              "akteure_neu": number,"eigentum_neu": number,"quellzeilen": number
            }[]
                           },
"eigentuemer_verdichten":
{ Args: { "p_schreiben"?: boolean }; Returns: {
              "akteure_neu": number,"eigentum_neu": number,"namen": number,"parzellen": number
            }[]
                           },
"erlaubte_portfolios":
{ Args: Record<PropertyKey, never>; Returns: string[]
                           },
"fonds_baugesuche":
{ Args: { "p_tage"?: number,"p_team"?: string }; Returns: Json
                           },
"fonds_darf":
{ Args: { "p_team": string }; Returns: boolean
                           },
"fonds_gesellschaften":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"fonds_suchtreffer":
{ Args: { "p_profil": string }; Returns: Json
                           },
"fonds_team":
{ Args: { "p_team"?: string }; Returns: string
                           },
"fonds_universum":
{ Args: { "p_team"?: string }; Returns: Json
                           },
"gebaeude_suchen":
{ Args: { "p_baujahr_bis"?: number,"p_baujahr_von"?: number,"p_gemeinde"?: string,"p_grenze"?: number,"p_klasse"?: number,"p_wohnflaeche_min"?: number,"p_zimmer_max"?: number,"p_zimmer_min"?: number }; Returns: {
              "adresse": string,"baujahr": number,"egid": number,"egrid": string,"gemeinde": string,"geschosse": number,"heizung_energie": number,"klasse": number,"lat": number,"lon": number,"parzelle_id": string,"wohnflaeche": number,"wohnungen": number,"zimmer": number
            }[]
                           },
"gelegenheit_aus_gespraech":
{ Args: { "p_anlass": string,"p_begruendung"?: string,"p_parzelle": string }; Returns: string
                           },
"gelegenheiten_nachbar_baut":
{ Args: { "p_min_reserve"?: number,"p_nur_bauvorhaben"?: boolean,"p_schreiben"?: boolean,"p_tage"?: number }; Returns: {
              "angelegt": number,"gesuche": number,"parzellen": number
            }[]
                           },
"gelegenheiten_potenzial":
{ Args: { "p_mandant"?: string,"p_min_reserve"?: number,"p_schreiben"?: boolean }; Returns: {
              "angelegt": number,"ersatzneubau": number,"gemeinsam": number,"kandidaten": number,"reserve": number
            }[]
                           },
"gelegenheiten_reaktivierung":
{ Args: { "p_schreiben"?: boolean,"p_tage"?: number }; Returns: {
              "angelegt": number,"gespraeche": number,"kandidaten": number
            }[]
                           },
"gemeinde_stats":
{ Args: { "p_kanton"?: string }; Returns: {
              "gemeinde": string,"geprueft": number,"interessant": number,"kanton": string,"offen": number,"total": number
            }[]
                           },
"has_role":
{ Args: { "_role": Database["public"]['Enums']["app_role"],"_user_id": string }; Returns: boolean
                           },
"import_properties":
{ Args: { "p_list_id"?: string,"p_rows": Json,"p_update_existing"?: boolean }; Returns: {
              "eingefuegt": number,"ergaenzt": number,"felder_detail": Json,"felder_gefuellt": number
            }[]
                           },
"investor_abgleich":
{ Args: { "p_profil"?: string,"p_schreiben"?: boolean }; Returns: {
              "neu": number,"profile": number,"treffer": number
            }[]
                           },
"investor_kategorien":
{ Args: { "p_typen": (string)[] }; Returns: (string)[]
                           },
"investor_lagen":
{ Args: { "p_lagen": (string)[] }; Returns: (string)[]
                           },
"investor_mandat_anlegen":
{ Args: { "p_max"?: number,"p_profil": string }; Returns: Json
                           },
"ist_fondsmanager":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"ist_keine_bauzone":
{ Args: { "z": string }; Returns: boolean
                           },
"ist_keine_wohnnutzung":
{ Args: { "z": string }; Returns: boolean
                           },
"ist_vorhanden":
{ Args: { "v": string }; Returns: boolean
                           },
"ist_zone_unbrauchbar":
{ Args: { "z": string }; Returns: boolean
                           },
"konten_liste":
{ Args: Record<PropertyKey, never>; Returns: {
              "email": string,"id": string
            }[]
                           },
"machbarkeit_grundlage":
{ Args: { "p_abstand"?: number,"p_parzelle": string }; Returns: Json
                           },
"merkliste_gebaeude":
{ Args: { "p_liste": string }; Returns: {
              "adresse": string,"baujahr": number,"egid": number,"egrid": string,"eigentuemer": string,"gemeinde": string,"geschosse": number,"heizung_energie": number,"klasse": number,"lat": number,"lon": number,"notiz": string,"parzelle_id": string,"parzelle_status": string,"stand": string,"stand_am": string,"telefon_bekannt": boolean,"wohnflaeche": number,"wohnungen": number,"zimmer": number
            }[]
                           },
"nachbarschaft_rechnen":
{ Args: { "p_kanton"?: string,"p_menge"?: number }; Returns: {
              "bearbeitet": number,"paare": number
            }[]
                           },
"nachbarschaft_zuruecksetzen":
{ Args: { "p_kanton"?: string }; Returns: number
                           },
"norm_zone":
{ Args: { "z": string }; Returns: string
                           },
"parzellen_kachel":
{ Args: { "x": number,"y": number,"z": number }; Returns: string
                           },
"parzellen_karte":
{ Args: { "p_menge"?: number,"p_nord": number,"p_ost": number,"p_sued": number,"p_west": number }; Returns: Json
                           },
"portfolio_bericht":
{ Args: { "p_mandant": string }; Returns: Json
                           },
"potenzial_nachrechnen":
{ Args: { "p_batch"?: number }; Returns: number
                           },
"recompute_potenzial":
{ Args: { "p_batch"?: number }; Returns: number
                           },
"refresh_gemeinde_stats":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"vorhaben_analyse":
{ Args: { "p_vorhaben": string }; Returns: Json
                           },
"zone_code":
{ Args: { "z": string }; Returns: string
                           },
"zone_parse":
{ Args: { "z": string }; Returns: {
              "anteil_prozent": number,"geschosse": number,"kurz": string,"ueberbauungsziffer": number,"ziffer": number,"zonenflaeche": number
            }[]
                           },
"zone_ziffer_am":
{ Args: { "p_e": number,"p_n": number }; Returns: {
              "abkuerzung": string,"art": string,"art_kurz": string,"bezeichnung": string,"code": string,"kanton": string,"ziffer": number
            }[]
                           }
          }
          Enums: {
            "app_role": "admin"|"office"|"mobile_swipe"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "app_role": ["admin", "office", "mobile_swipe"]
          }
        }
} as const
