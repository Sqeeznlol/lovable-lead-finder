-- =====================================================================
-- Massen-Import in einem einzigen Aufruf
-- =====================================================================
-- Der Import lief bisher zeilenweise über die REST-Schnittstelle: pro
-- Zeile eine Abfrage, ob der EGRID schon existiert, dann ein Insert oder
-- Update, bei gesetzter Liste noch ein drittes Update. Bei 50'000 Zeilen
-- summiert sich das auf weit über 50'000 Roundtrips -- der Import lief
-- deshalb minutenlang.
--
-- Diese Funktion nimmt einen ganzen Block als JSON entgegen und erledigt
-- alles in einer einzigen Anweisung: neue Parzellen werden eingefügt,
-- bekannte ergänzt. Ergänzt heisst COALESCE -- vorhandene Werte bleiben
-- stehen, nur Lücken werden gefüllt. Der Akquise-Stand (Status, Notizen,
-- Eigentümer, Telefonnummern) wird nie angefasst.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.import_properties(
  p_rows            jsonb,
  p_list_id         uuid    DEFAULT NULL,
  p_update_existing boolean DEFAULT true
)
RETURNS TABLE (eingefuegt integer, ergaenzt integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_ins integer := 0;
  v_upd integer := 0;
BEGIN
  CREATE TEMP TABLE _eingang ON COMMIT DROP AS
  SELECT * FROM jsonb_to_recordset(p_rows) AS x(
    address              text,
    egrid                text,
    parzelle             text,
    plot_number          text,
    gwr_egid             text,
    gvz_nr               text,
    gebaeude_anzahl      integer,
    strassenname         text,
    hausnummer           text,
    plz                  text,
    plz_ort              text,
    gemeinde             text,
    ortschaftsname       text,
    bezirk               text,
    bezirksort           text,
    kanton               text,
    area                 numeric,
    gebaeudeflaeche      numeric,
    hnf_schaetzung       numeric,
    wohnflaeche          numeric,
    nutzflaeche          numeric,
    baujahr              integer,
    renovationsjahr      integer,
    geschosse            numeric,
    wohnungen            numeric,
    ausnuetzung          numeric,
    zone                 text,
    kategorie            text,
    gebaeudeart          text,
    geb_status           text,
    denkmalschutz        text,
    denkmalschutz_titel  text,
    isos                 text,
    isos_titel           text,
    google_maps_url      text,
    streetview_url       text,
    housing_stat_url     text,
    gis_url              text,
    objektadresse        text,
    bfs_nr               text,
    source_file          text
  );

  -- Innerhalb eines Blocks kann derselbe EGRID nur einmal vorkommen, sonst
  -- kann ON CONFLICT die Zeile nicht zweimal behandeln.
  CREATE TEMP TABLE _dedup ON COMMIT DROP AS
  SELECT DISTINCT ON (COALESCE(NULLIF(egrid, ''), gen_random_uuid()::text)) *
  FROM _eingang
  ORDER BY COALESCE(NULLIF(egrid, ''), gen_random_uuid()::text),
           COALESCE(gebaeudeflaeche, 0) DESC;

  WITH eingefuegt AS (
    INSERT INTO public.properties AS p (
      address, egrid, parzelle, plot_number, gwr_egid, gvz_nr, gebaeude_anzahl,
      strassenname, hausnummer, plz, plz_ort, gemeinde, ortschaftsname,
      bezirk, bezirksort, kanton, area, gebaeudeflaeche, hnf_schaetzung,
      wohnflaeche, nutzflaeche, baujahr, renovationsjahr, geschosse, wohnungen,
      ausnuetzung, zone, kategorie, gebaeudeart, geb_status, denkmalschutz,
      denkmalschutz_titel, isos, isos_titel, google_maps_url, streetview_url,
      housing_stat_url, gis_url, objektadresse, bfs_nr, source_file,
      list_id, status, preselection_status, is_queried
    )
    SELECT
      COALESCE(NULLIF(d.address, ''), 'Parzelle ' || COALESCE(d.parzelle, d.egrid, '?')),
      NULLIF(d.egrid, ''), d.parzelle, COALESCE(d.plot_number, d.parzelle), d.gwr_egid,
      d.gvz_nr, COALESCE(d.gebaeude_anzahl, 1),
      d.strassenname, d.hausnummer, d.plz, d.plz_ort, d.gemeinde, d.ortschaftsname,
      d.bezirk, d.bezirksort, COALESCE(d.kanton, 'ZH'), d.area, d.gebaeudeflaeche,
      d.hnf_schaetzung, d.wohnflaeche, d.nutzflaeche, d.baujahr, d.renovationsjahr,
      d.geschosse, d.wohnungen, d.ausnuetzung, d.zone, d.kategorie, d.gebaeudeart,
      COALESCE(d.geb_status, 'Bestehend'), d.denkmalschutz, d.denkmalschutz_titel,
      d.isos, d.isos_titel, d.google_maps_url, d.streetview_url, d.housing_stat_url,
      d.gis_url, d.objektadresse, d.bfs_nr, d.source_file,
      p_list_id, 'Neu', 'Nicht geprüft', false
    FROM _dedup d
    ON CONFLICT (egrid) WHERE egrid IS NOT NULL AND egrid <> ''
    DO UPDATE SET
      -- Nur Lücken füllen: der bestehende Wert gewinnt immer.
      strassenname     = COALESCE(p.strassenname, EXCLUDED.strassenname),
      hausnummer       = COALESCE(p.hausnummer, EXCLUDED.hausnummer),
      plz              = COALESCE(p.plz, EXCLUDED.plz),
      plz_ort          = COALESCE(p.plz_ort, EXCLUDED.plz_ort),
      gemeinde         = COALESCE(p.gemeinde, EXCLUDED.gemeinde),
      bezirk           = COALESCE(p.bezirk, EXCLUDED.bezirk),
      kanton           = COALESCE(p.kanton, EXCLUDED.kanton),
      area             = COALESCE(p.area, EXCLUDED.area),
      gebaeudeflaeche  = COALESCE(p.gebaeudeflaeche, EXCLUDED.gebaeudeflaeche),
      hnf_schaetzung   = COALESCE(p.hnf_schaetzung, EXCLUDED.hnf_schaetzung),
      wohnflaeche      = COALESCE(p.wohnflaeche, EXCLUDED.wohnflaeche),
      nutzflaeche      = COALESCE(p.nutzflaeche, EXCLUDED.nutzflaeche),
      baujahr          = COALESCE(p.baujahr, EXCLUDED.baujahr),
      renovationsjahr  = COALESCE(p.renovationsjahr, EXCLUDED.renovationsjahr),
      geschosse        = COALESCE(p.geschosse, EXCLUDED.geschosse),
      wohnungen        = COALESCE(p.wohnungen, EXCLUDED.wohnungen),
      ausnuetzung      = COALESCE(p.ausnuetzung, EXCLUDED.ausnuetzung),
      zone             = COALESCE(p.zone, EXCLUDED.zone),
      kategorie        = COALESCE(p.kategorie, EXCLUDED.kategorie),
      gebaeudeart      = COALESCE(p.gebaeudeart, EXCLUDED.gebaeudeart),
      denkmalschutz    = COALESCE(p.denkmalschutz, EXCLUDED.denkmalschutz),
      isos             = COALESCE(p.isos, EXCLUDED.isos),
      google_maps_url  = COALESCE(p.google_maps_url, EXCLUDED.google_maps_url),
      streetview_url   = COALESCE(p.streetview_url, EXCLUDED.streetview_url),
      gis_url          = COALESCE(p.gis_url, EXCLUDED.gis_url),
      housing_stat_url = COALESCE(p.housing_stat_url, EXCLUDED.housing_stat_url),
      bfs_nr           = COALESCE(p.bfs_nr, EXCLUDED.bfs_nr),
      gebaeude_anzahl  = GREATEST(p.gebaeude_anzahl, EXCLUDED.gebaeude_anzahl),
      list_id          = COALESCE(p_list_id, p.list_id),
      source_file      = COALESCE(p.source_file, EXCLUDED.source_file)
    WHERE p_update_existing
    -- xmax = 0 kennzeichnet eine tatsächlich eingefügte Zeile
    RETURNING (xmax = 0) AS ist_neu
  )
  SELECT count(*) FILTER (WHERE ist_neu),
         count(*) FILTER (WHERE NOT ist_neu)
  INTO v_ins, v_upd
  FROM eingefuegt;

  RETURN QUERY SELECT v_ins, v_upd;
END;
$$;

COMMENT ON FUNCTION public.import_properties(jsonb, uuid, boolean) IS
  'Importiert einen Block Liegenschaften in einer Anweisung; bestehende Zeilen werden nur ergänzt, nie überschrieben';

GRANT EXECUTE ON FUNCTION public.import_properties(jsonb, uuid, boolean) TO anon, authenticated;
