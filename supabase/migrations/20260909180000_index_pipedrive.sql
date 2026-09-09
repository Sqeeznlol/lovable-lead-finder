-- =====================================================================
-- Die drei Listen, die bei jedem Klick geladen werden
-- =====================================================================
-- "Nummern", "Pipedrive" und das Archiv fragen dasselbe Muster ab:
-- Objekte mit Eigentümer, mit oder ohne Deal-Nummer. Ohne Index geht
-- die Datenbank dafür durch 396'271 Zeilen -- bei jedem Aufruf.
--
-- Die Teilindizes sind winzig: es gibt eine Handvoll Objekte mit
-- Eigentümer, nicht Hunderttausende. Genau deshalb lohnen sie sich.
-- =====================================================================

create index if not exists idx_properties_offen
  on public.properties (marge_chf desc nulls last)
  where pipedrive_deal_id is null
    and owner_name is not null
    and owner_name <> '';

create index if not exists idx_properties_uebertragen
  on public.properties (last_export_at desc nulls last)
  where pipedrive_deal_id is not null;

analyze public.properties;
