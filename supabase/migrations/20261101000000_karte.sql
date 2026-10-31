-- =====================================================================
-- Die Umrisse für die Karte
-- =====================================================================
-- PostgREST gibt eine Geometriespalte als WKB-Hex zurück -- für eine
-- Karte im Browser unbrauchbar, ohne sie dort erst zu zerlegen. Diese
-- Funktion liefert stattdessen fertiges GeoJSON für genau den
-- Ausschnitt, den man gerade sieht.
--
-- Warum nach Ausschnitt und nicht alles: im Thurgau stehen 137'214
-- Parzellen. Sie alle zu schicken wären Dutzende Megabyte je
-- Kartenbewegung. Der Umgebungsvergleich `&&` nutzt den GIST-Index,
-- der schon da ist.
--
-- Bewusst OHNE Eigentümer. Die Karte zeigt Lage, Fläche, Zone und
-- Marge -- amtliche und gerechnete Angaben. Wer auf eine Parzelle
-- klickt, holt den Eigentümer über `properties`, wo er ohnehin steht
-- und seit jeher lesbar ist. So kommt mit dieser Funktion kein
-- einziges Personendatum neu hinzu.
--
-- Umgerechnet wird nach WGS84 (4326): Kartenbibliotheken rechnen in
-- Grad, die amtliche Vermessung in LV95.
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
        'ausgeschlossen', p.ausgeschlossen
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
