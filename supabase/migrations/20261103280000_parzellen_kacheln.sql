-- =====================================================================
-- Vektorkacheln für die Parzellen (Vorbereitung für die ganze Schweiz)
-- =====================================================================
-- docs/plattform.md, Abschnitt 4a: "Die Karte lässt sich nicht als JSON
-- ausliefern" -- bei Millionen Polygonen rechnet PostGIS je Kachel ein
-- fertiges Paket (ST_AsMVT), und der Browser lädt nur, was im Bild
-- ist. Diese Funktion ist der Server-Teil: eine Kachel z/x/y als
-- Mapbox Vector Tile (bytea), mit den Eigenschaften, die die Karte
-- heute zeigt (keine Eigentümer -- die kommen je Parzelle, nicht in
-- der Kachel).
--
-- Die Karte selbst bleibt vorerst beim bisherigen Weg (parzellen_karte,
-- GeoJSON je Ausschnitt): Zürcher Parzellen haben heute keinen Umriss
-- (gemessen 3. November: 0 von 394'917), die Kachel wäre dort leer. Die
-- Umstellung des Browsers lohnt sich, sobald die Zürcher Umrisse da
-- sind (Aufgabe 27).
--
-- Unter Zoom 13 keine Kachel: dort sind Parzellen kleiner als ein
-- Pixel, und die Rechnung läse den ganzen Kanton.
-- =====================================================================

create or replace function public.parzellen_kachel(z int, x int, y int)
returns bytea
language sql
stable
security invoker
set search_path to 'public', 'extensions'
as $$
  with grenzen as (
    select ST_TileEnvelope(z, x, y) as g
  ),
  mvt as (
    select ST_AsMVTGeom(ST_Transform(p.geometrie, 3857), grenzen.g, 4096, 64, true) as geom,
           p.id, p.address as adresse, p.parzelle, p.gemeinde, p.area as flaeche, p.zone,
           round(p.marge_chf) as marge, coalesce(p.ausgeschlossen, false) as ausgeschlossen, p.kategorie as art
    from public.properties p, grenzen
    where z >= 13
      and p.geometrie is not null
      and p.geometrie && ST_Transform(grenzen.g, 2056)
  )
  -- Ohne Kennung als Feature-ID: die ist eine UUID, und MVT verlangt eine Ganzzahl; die id steht als Eigenschaft drin.
  select ST_AsMVT(mvt, 'parzellen', 4096, 'geom') from mvt;
$$;

revoke all on function public.parzellen_kachel(int, int, int) from public, anon;
grant execute on function public.parzellen_kachel(int, int, int) to authenticated;
