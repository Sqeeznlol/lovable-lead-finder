-- =====================================================================
-- Eigentümersuche: Trigramm-Index auf owner_name
-- =====================================================================
-- Gemessen am 1. November ("Auswerten -> suche"): die Teilsuche
-- owner_name ilike '%swisscanto%' liest alle 396'271 Zeilen und braucht
-- 7,2 Sekunden. Die Seite läuft als "authenticated" mit 8 Sekunden
-- Zeitgrenze -- eine Suche knapp an der Grenze ist eine, die bei
-- etwas Last abbricht.
--
-- Nur 114 Objekte tragen überhaupt einen Eigentümer. Der Index deckt
-- deshalb nur diese ab: er bleibt winzig, und Postgres darf ihn nehmen,
-- weil "owner_name ilike ..." nur für nicht-leere Werte wahr sein kann.
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_properties_owner_trgm
  on public.properties using gin (owner_name extensions.gin_trgm_ops)
  where owner_name is not null;

-- Dasselbe für die Akteure; heute 182, aber dafür ist die Tabelle da,
-- dass es viele werden.
create index if not exists idx_akteur_name_trgm
  on public.akteur using gin (name extensions.gin_trgm_ops);
