-- Platz für die fehlenden Zürcher Parzellen.
--
-- Gemessen am 1. November (Auswerten/indizes): die Datenbank steht bei
-- 1093 MB, bei 1107 MB schaltete Supabase am 31. Oktober auf nur-lesen.
-- properties trägt 522 MB Indizes auf 395 MB Daten. Der amtlichen
-- Vermessung fehlen uns 207'456 Zürcher Liegenschaften -- rund 290 MB,
-- die heute nicht hineinpassen.
--
-- Entfernt werden nur Indizes, die laut pg_stat_user_indexes seit
-- Bestehen der Statistik (stats_reset leer) nie gelesen wurden, und
-- zwei Doppel auf der EGRID. Die Daten bleiben unberührt; jeder Index
-- lässt sich bei Bedarf in Sekunden neu anlegen.
--
-- Bleiben bewusst:
--   properties_egrid_unique   (egrid) where egrid is not null
--     -> Ziel von "on conflict (egrid) where egrid is not null" im
--        Kantonsladen.
--   uniq_properties_egrid     (egrid) where egrid is not null and egrid <> ''
--     -> Ziel von "on conflict" in den Import-Funktionen.
-- Entfernt als Doppel:
--   idx_properties_egrid_unique  -- gleich wie properties_egrid_unique
--   idx_properties_egrid         -- ohne Bedingung; Suchen nach einer
--                                   EGRID nimmt der eindeutige Index

drop index if exists public.idx_properties_egrid_unique;
drop index if exists public.idx_properties_egrid;

-- Nie gelesen (idx_scan = 0), grösste zuerst.
drop index if exists public.idx_properties_gebaeudeflaeche_area;
drop index if exists public.idx_properties_gebaeudeflaeche;
drop index if exists public.idx_properties_hnf_neu;
drop index if exists public.idx_properties_ai_score;
drop index if exists public.idx_properties_zone;
drop index if exists public.properties_tier_idx;
drop index if exists public.idx_properties_reserve_gf;
drop index if exists public.idx_properties_address;
drop index if exists public.properties_marge_idx;
drop index if exists public.properties_hnf_delta_idx;
drop index if exists public.idx_properties_gwr_egid;
drop index if exists public.idx_properties_vorauswahl;
drop index if exists public.properties_ausgeschlossen_idx;
drop index if exists public.idx_properties_geb_status;
drop index if exists public.idx_properties_gemeinde_status;
drop index if exists public.idx_properties_plz;
drop index if exists public.idx_properties_gemeinde;
drop index if exists public.idx_properties_preselection_status;
drop index if exists public.idx_properties_preselection;
drop index if exists public.idx_properties_stage_changed_at;
drop index if exists public.idx_properties_imported_at;
drop index if exists public.idx_properties_bezirk;
drop index if exists public.idx_properties_phone_search_status;
drop index if exists public.idx_properties_is_queried;
drop index if exists public.idx_properties_potenzial_score;
drop index if exists public.idx_properties_score_tier;
drop index if exists public.idx_properties_export_status;
drop index if exists public.idx_properties_list_id;
drop index if exists public.idx_properties_review_status;
drop index if exists public.idx_properties_ai_recommendation;
drop index if exists public.idx_properties_follow_up_at;
drop index if exists public.idx_properties_baujahr;
drop index if exists public.idx_properties_eigentuemer_name;
drop index if exists public.idx_properties_preselected;
drop index if exists public.properties_scored_at_idx;
