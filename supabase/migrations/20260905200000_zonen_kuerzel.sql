-- =====================================================================
-- Zonen-Kürzel der Gemeinden und unbrauchbare Zonenangaben
-- =====================================================================
-- Die Ausschlussregeln passten bisher nur auf ausgeschriebene Namen wie
-- "Zone für öffentliche Bauten". Winterthur führt seine Bau- und
-- Zonenordnung jedoch in Kürzeln. Erhoben am Bestand (GitHub-Actions-
-- Aufgabe "zonennamen", 11'000 Zeilen, 5. September) standen dort als
-- kaufbar in der Liste:
--
--   Oe  Zone für öffentliche Bauten .......  3
--   Wa  Wald ..............................  3
--   Gw  Gewässer ..........................  1
--   F   Freihaltezone .....................  1
--   G   Gewerbezone .......................  1
--   I1, I2  Industriezone .................  2
--   E1, E2  Erholungszone .................  5
--
-- Keines davon lässt sich kaufen und zu Wohnraum entwickeln.
--
-- Zusätzlich stand in 3'092 von 11'000 Zeilen der Wert "zarchivat" --
-- rund ein Viertel des kaufbaren Bestands. Das benennt keine Zone,
-- sondern ist ein Fehler aus der Quelle. Ohne Zonenangabe lässt sich
-- kein Potenzial rechnen; solche Objekte gehören nicht in die
-- Anrufliste, sondern auf die Nachbesserung der Daten. Sie bekommen
-- deshalb einen eigenen Grund und nicht "Keine Bauzone" -- das ist ein
-- Datenproblem, kein planungsrechtliches.
--
-- Die Kürzel werden gegen den ganzen Zonentext geprüft, nicht als
-- Teilwort: sonst schlüge "F" in jeder "Wohnzone mit Gewerbeanteil" an.
--
-- Ebenfalls ausgeschlossen wird das Bahnareal. Auch hier nur als eigenes
-- Wort -- eine Kernzone an einer Bahnhofstrasse gehört zum Besten, was
-- der Bestand hergibt, und darf nicht mit herausfallen.
-- =====================================================================

-- Zonentext ohne Klammerzusatz und ohne Leerzeichen, in Grossbuchstaben.
CREATE OR REPLACE FUNCTION public.zone_code(z text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT upper(regexp_replace(regexp_replace(COALESCE(z, ''), '\([^)]*\)', ' ', 'g'), '\s+', '', 'g'))
$$;

COMMENT ON FUNCTION public.zone_code(text) IS
  'Zonentext auf das blosse Kürzel reduziert, für den Vergleich mit den Zonenlisten der Gemeinden';

-- Angabe benennt keine Zone, sondern ist ein Fehler aus der Quelle.
CREATE OR REPLACE FUNCTION public.ist_zone_unbrauchbar(z text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(public.zone_code(z) ~ '^(ZARCHIVAT|UNBEKANNT|K\.?A\.?|N/A|-+)$', false)
$$;

COMMENT ON FUNCTION public.ist_zone_unbrauchbar(text) IS
  'Zonenangabe ist unbrauchbar (z.B. "zarchivat") -- Datenfehler, keine Zone';

CREATE OR REPLACE FUNCTION public.ist_keine_bauzone(z text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    public.ist_zone_unbrauchbar(z)
    OR public.zone_code(z) IN ('WA', 'WALD', 'GW', 'GEW', 'F', 'FR', 'FH',
                               'L', 'LW', 'E', 'E1', 'E2', 'E3', 'R',
                               'BA', 'BAHN', 'EB')
    -- Bahnareal nur als eigenes Wort: eine Bahnhofstrasse liegt meist in
    -- der Kernzone und ist sehr wohl kaufbar.
    OR z ~* 'landwirtschaftszone|wald|freihaltezone|erholungszone|gew(ä|ae)sser|reservezone|verkehrszone|\ybahnareal\y|\ybahngebiet\y|\ybahnzone\y|\ygleisareal\y|eisenbahn',
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.ist_keine_wohnnutzung(z text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    public.zone_code(z) IN ('OE', 'OEB', 'OED', 'G', 'G1', 'G2', 'G3',
                            'I', 'I1', 'I2', 'I3', 'A', 'A1', 'A2')
    OR z ~* '(gewerbezone|industriezone|arbeitszone|(ö|oe)ffentliche(n)? (bauten|zwecke))',
    false
  )
$$;

-- Der Grund unterscheidet jetzt das Datenproblem vom Zonenentscheid.
CREATE OR REPLACE FUNCTION public.ausschluss_grund_von(
  p_zone text,
  p_denkmalschutz text
)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.ist_zone_unbrauchbar(p_zone)          THEN 'Zonenangabe fehlt'
    WHEN public.ist_keine_bauzone(p_zone)             THEN 'Keine Bauzone'
    WHEN public.ist_keine_wohnnutzung(p_zone)         THEN 'Keine Wohnnutzung'
    WHEN public.ist_vorhanden(p_denkmalschutz)        THEN 'Denkmalschutz'
    ELSE NULL
  END
$$;

-- Die betroffenen Objekte neu bewerten. Es sind wenige Tausend, das
-- läuft in einem Durchgang; der ganze Bestand täte das nicht.
UPDATE public.properties
   SET ausgeschlossen    = true,
       ausschluss_grund  = public.ausschluss_grund_von(zone, denkmalschutz),
       score_tier        = 'D',
       potenzial_score   = 0
 WHERE ausgeschlossen IS DISTINCT FROM true
   AND (public.ist_zone_unbrauchbar(zone)
        OR public.ist_keine_bauzone(zone)
        OR public.ist_keine_wohnnutzung(zone));
