-- =====================================================================
-- Was sich nicht bebauen lässt, gehört ins Archiv
-- =====================================================================
-- Der Thurgau führt Zonen, die es in Zürich so nicht gibt, und sie
-- standen als kaufbare Objekte in der Arbeitsliste:
--
--   Lw Landwirtschaftszone            9'336 Parzellen
--   Ls Landschaftsschutzzone          2'467
--   W Wald / Fo Wald / Wald Wald      4'653
--   SaB Strasse ausserhalb Bauzone    1'144
--   SnB Strassenflächen ausserhalb…     999
--   StNB Strasse Nichtbaugebiet         647
--   AG Arbeitszone Gewerbe              434
--
-- Dazu kommt ein Fehler, der Zürich genauso betraf: die Regel für
-- Gewerbe prüft auf "arbeitszone" -- und das steht auch in "Wohn- und
-- Arbeitszone". Dort darf gerade Wohnraum entstehen. Steht "Wohn" im
-- Namen, schlägt das die Gewerberegel; sonst fielen im Thurgau allein
-- über 5'000 Parzellen der WA-Zonen zu Unrecht heraus.
-- =====================================================================

create or replace function public.ist_keine_bauzone(z text)
returns boolean
language sql immutable
set search_path = public
as $$
  select coalesce(
    public.ist_zone_unbrauchbar(z)
    or public.zone_code(z) in ('WA', 'WALD', 'GW', 'GEW', 'F', 'FR', 'FH',
                               'L', 'LW', 'E', 'E1', 'E2', 'E3', 'R',
                               'BA', 'BAHN', 'EB')
    -- Bahnareal nur als eigenes Wort: eine Bahnhofstrasse liegt meist in
    -- der Kernzone und ist sehr wohl kaufbar.
    or z ~* 'landwirtschaft|landschaftsschutz|\ywald\y|waldzone|forstzone|freihaltezone|erholungszone|gew(ä|ae)sser|reservezone|verkehrszone|verkehrsfl(ä|ae)che|\ystrasse\y|strassen|nationalstrass|nichtbaugebiet|nichtbauzone|nicht zugewiesene zone|ausserhalb (von )?(der )?(bauzone|bauzonen|baugebiet)|deponie|abbauzone|\ybahnareal\y|\ybahngebiet\y|\ybahnzone\y|\ygleisareal\y|\ybahnfl(ä|ae)che|eisenbahn',
    false
  )
$$;

create or replace function public.ist_keine_wohnnutzung(z text)
returns boolean
language sql immutable
set search_path = public
as $$
  select coalesce(
    z !~* 'wohn'
    and (
      public.zone_code(z) in ('OE', 'OEB', 'OED', 'G', 'G1', 'G2', 'G3',
                              'I', 'I1', 'I2', 'I3', 'A', 'A1', 'A2')
      or z ~* '(gewerbezone|gewerbe|industrie|arbeitszone|(ö|oe)ffentliche(n)? (bauten|zwecke))'
    ),
    false
  )
$$;

-- Was neu unter die Regeln fällt, wandert ins Archiv.
update public.properties
   set ausgeschlossen   = true,
       ausschluss_grund = public.ausschluss_grund_von(zone, denkmalschutz),
       score_tier       = 'D',
       potenzial_score  = 0
 where ausgeschlossen is distinct from true
   and (public.ist_zone_unbrauchbar(zone)
        or public.ist_keine_bauzone(zone)
        or public.ist_keine_wohnnutzung(zone));

-- Und was zu Unrecht draussen war, kommt zurück: die Wohn- und
-- Arbeitszonen, die nur wegen des Wortes "Arbeitszone" ausgeschlossen
-- wurden.
update public.properties
   set ausgeschlossen   = false,
       ausschluss_grund = null
 where ausgeschlossen = true
   and ausschluss_grund = 'Keine Wohnnutzung'
   and zone ~* 'wohn'
   and not public.ist_keine_bauzone(zone)
   and not public.ist_zone_unbrauchbar(zone);
