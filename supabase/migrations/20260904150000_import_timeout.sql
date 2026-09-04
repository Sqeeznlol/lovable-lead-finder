-- =====================================================================
-- Import: Zeitlimit anheben und Fehler sichtbar machen
-- =====================================================================
-- Supabase begrenzt die Laufzeit einer Anfrage für die Rollen anon und
-- authenticated auf wenige Sekunden. Ein Block mit mehreren tausend
-- Zeilen, die beim Einfügen alle durch die Potenzial-Berechnung laufen,
-- überschreitet das auf einer kleinen Instanz -- die Anfrage bricht mit
-- einem Serverfehler ab, ohne dass eine Zeile ankommt.
--
-- Die Funktion setzt ihr Zeitlimit deshalb selbst hoch. Das gilt nur für
-- die Dauer dieses Aufrufs und ändert nichts an den übrigen Anfragen.
-- =====================================================================

ALTER FUNCTION public.import_properties(jsonb, uuid, boolean)
  SET statement_timeout = '180s';

COMMENT ON FUNCTION public.import_properties(jsonb, uuid, boolean) IS
  'Importiert einen Block Liegenschaften in einer Anweisung; bestehende Zeilen werden nur ergänzt, nie überschrieben. Eigenes Zeitlimit von 180s, da der Trigger jede Zeile durchrechnet.';
