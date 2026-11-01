-- =====================================================================
-- Karte: Objektart mitliefern, für den Filter
-- =====================================================================
-- Tim verlangt Filter nach Objektart, Parzellengrösse und Potenzial.
-- Fläche und Marge liefert parzellen_karte schon; die Objektart fehlte.
-- Gemessen am 1. November ("Auswerten -> arten"): `kategorie` ist die
-- gefüllte Spalte (Einfamilienhaus 151'548, Mehrfamilienhaus 16'225,
-- leer 89'521), `gebaeudeart` ist zu 209'569 leer. Also `kategorie`.
--
-- Sonst unverändert gegenüber 20261101000000_karte.sql; weiterhin
-- ohne Eigentümer.
-- =====================================================================

set search_path to public, extensions;

create or replace function public.parzellen_karte(
  p_west  double precision,
  p_sued  double precision,
  p_ost   double precision,
  p_nord  double precision,
  p_menge int default 1200
)
returns jsonb
language sql
stable
set search_path to 'public', 'extensions'
as $$
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(f), '[]'::jsonb)
  )
  from (
    select jsonb_build_object(
      'type', 'Feature',
      'id', p.id,
      'geometry', ST_AsGeoJSON(ST_Transform(p.geometrie, 4326))::jsonb,
      'properties', jsonb_build_object(
        'adresse',        p.address,
        'parzelle',       p.parzelle,
        'gemeinde',       p.gemeinde,
        'flaeche',        p.area,
        'zone',           p.zone,
        'marge',          p.marge_chf,
        'ausgeschlossen', p.ausgeschlossen,
        'art',            p.kategorie
      )
    ) as f
    from public.properties p
    where p.geometrie is not null
      and p.geometrie && ST_Transform(
            ST_MakeEnvelope(p_west, p_sued, p_ost, p_nord, 4326), 2056)
    limit greatest(1, least(p_menge, 3000))
  ) x;
$$;

comment on function public.parzellen_karte(double precision, double precision,
                                           double precision, double precision, int) is
  'Parzellenumrisse als GeoJSON fuer einen Kartenausschnitt. Ohne '
  'Eigentuemer -- der wird beim Klick ueber properties geholt.';

-- Die Karte laeuft im Browser, also mit dem oeffentlichen Schluessel.
-- Die Funktion liest nur, was ueber properties ohnehin offensteht.
grant execute on function public.parzellen_karte(double precision, double precision,
                                                 double precision, double precision, int)
  to anon, authenticated;
