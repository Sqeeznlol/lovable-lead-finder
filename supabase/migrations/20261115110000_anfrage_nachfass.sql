-- =====================================================================
-- Nachfass-Abfolge für Leads der Check-Seiten
-- =====================================================================
-- Julian, 14. November ("mach alles bis auf 2 mit briefen"): wer eine
-- Anfrage schickt, bekommt am Tag 1 den Bericht, am Tag 7 eine
-- Erinnerung und nach drei Monaten "Ihre Parzelle neu geprüft".
-- Ein Versanddienst fehlt noch (Konto bei Julian); darum führt Aurora
-- die Schritte: welche Stufe erledigt ist und wann. Die Regeln stehen in
-- src/lib/nachfass.ts. Lesen und ändern darf wie bisher nur ein
-- angemeldetes Konto (Regel anfrage_bearbeiten).
alter table public.anfrage
  add column if not exists nachfass_stufe smallint not null default 0 check (nachfass_stufe between 0 and 3),
  add column if not exists nachfass_am timestamptz;
