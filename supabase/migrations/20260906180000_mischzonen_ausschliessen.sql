-- =====================================================================
-- Die Wohn- und Arbeitszone gehört auch heraus
-- =====================================================================
-- Die Migration von vorhin hat sie zurückgeholt, weil "Wohn" im Namen
-- steht. Das ist so nicht gewollt: eine Mischzone ist kein Zielobjekt.
--
-- Geprüft wird auf den Zonentyp -- "Arbeitszone", "Gewerbezone",
-- "Industrie" --, nicht auf das blosse Wort "Gewerbe". Eine "Wohnzone
-- mit Gewerbeanteil" ist eine Wohnzone und bleibt in der Liste.
-- =====================================================================

create or replace function public.ist_keine_wohnnutzung(z text)
returns boolean
language sql immutable
set search_path = public
as $$
  select coalesce(
    public.zone_code(z) in ('OE', 'OEB', 'OED', 'G', 'G1', 'G2', 'G3',
                            'I', 'I1', 'I2', 'I3', 'A', 'A1', 'A2')
    or z ~* '(gewerbezone|industriezone|industrie|arbeitszone|(ö|oe)ffentliche(n)? (bauten|zwecke))',
    false
  )
$$;

update public.properties
   set ausgeschlossen   = true,
       ausschluss_grund = public.ausschluss_grund_von(zone, denkmalschutz),
       score_tier       = 'D',
       potenzial_score  = 0
 where ausgeschlossen is distinct from true
   and public.ist_keine_wohnnutzung(zone);
