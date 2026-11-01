-- =====================================================================
-- Baugesuch: Publikation und Quelle zum Nachprüfen
-- =====================================================================
-- Julian: "die Quelle und das Baugesuch muss auch direkt da rein, dass
-- man das noch überprüfen kann". Bisher stand nur, was wir aus dem
-- Gesuch gemacht haben -- nicht, wo es steht. Die Zürcher Quelle führt
-- dafür je Zeile die Publikationsnummer (publicationNumber, z.B.
-- "BP-ZH01-0000063847") und die Kennung im Amtsblattportal (id), dazu
-- die Einsprachefrist (entryDeadline) und das Ablaufdatum der
-- Publikation (expirationDate). Nachgesehen am 1. November.
-- =====================================================================

alter table public.baugesuch
  add column if not exists publikation_nr   text,
  add column if not exists publikation_id   text,
  add column if not exists einsprache_bis   date,
  add column if not exists publiziert_bis   date,
  add column if not exists quelle_url       text;
