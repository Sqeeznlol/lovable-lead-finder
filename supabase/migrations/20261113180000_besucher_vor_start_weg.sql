-- =====================================================================
-- Besucherzahlen vor dem Start der Domains löschen
-- =====================================================================
-- Julian, 13. November: "stimmen die Anzahl Besucher?" -- nein. Die
-- Seite trug auf der Vercel-Vorschau, auf localhost und bei unseren
-- automatischen Prüfungen die Hauptdomain der Marke ein: 401 «Besucher»,
-- obwohl noch keine Werbung lief. Die Domains waren am Nachmittag erst
-- teilweise erreichbar (um 17:19 UTC lieferten 22 von 23 noch kein DNS),
-- echte Besucher gab es bis dahin keine nennenswerten; Aufrufe von uns
-- selbst gehören ohnehin nicht in die Zahlen. Seit dem Commit "Besucher
-- nur auf echten Domains zählen" zählt die Seite nur auf einer
-- Marken-Domain. Gelöscht wird alles bis zum Start der sauberen Zählung;
-- die Leads in anfrage bleiben unberührt.
-- =====================================================================

delete from public.check_ereignis where zeit < '2026-11-13 17:30:00+00';
