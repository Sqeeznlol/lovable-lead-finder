-- =====================================================================
-- Import-Bericht: welche Felder eine Liste tatsächlich beigetragen hat
-- =====================================================================
-- Die Funktion meldete bisher nur, wie viele Parzellen neu angelegt und
-- wie viele ergänzt wurden. "Ergänzt" sagt aber nichts darüber, ob eine
-- Liste eine einzige Postleitzahl nachgetragen hat oder für tausende
-- Parzellen die fehlende Zone.
--
-- Sie zählt jetzt zusätzlich, wie viele leere Felder die Liste füllt, und
-- schlüsselt das nach Feld auf. Gezählt wird vor dem Schreiben -- danach
-- ist nicht mehr erkennbar, was vorher leer war.
-- =====================================================================

DROP FUNCTION IF EXISTS public.import_properties(jsonb, uuid, boolean);

CREATE OR REPLACE FUNCTION public.import_properties(
  p_rows            jsonb,
  p_list_id         uuid    DEFAULT NULL,
  p_update_existing boolean DEFAULT true
)
RETURNS TABLE (eingefuegt integer, ergaenzt integer, felder_gefuellt integer, felder_detail jsonb)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
SET statement_timeout = '180s'
AS $$
DECLARE
  v_ins    integer := 0;
  v_upd    integer := 0;
  v_felder integer := 0;
  v_detail jsonb   := '{}'::jsonb;
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

  -- Vor dem Schreiben zählen, welche Lücken diese Liste schliesst.
  WITH zaehlung AS (
    SELECT
      count(*) FILTER (WHERE p.strassenname IS NULL AND d.strassenname IS NOT NULL) AS n_strassenname,
      count(*) FILTER (WHERE p.hausnummer IS NULL AND d.hausnummer IS NOT NULL) AS n_hausnummer,
      count(*) FILTER (WHERE p.plz IS NULL AND d.plz IS NOT NULL) AS n_plz,
      count(*) FILTER (WHERE p.plz_ort IS NULL AND d.plz_ort IS NOT NULL) AS n_plz_ort,
      count(*) FILTER (WHERE p.gemeinde IS NULL AND d.gemeinde IS NOT NULL) AS n_gemeinde,
      count(*) FILTER (WHERE p.bezirk IS NULL AND d.bezirk IS NOT NULL) AS n_bezirk,
      count(*) FILTER (WHERE p.area IS NULL AND d.area IS NOT NULL) AS n_area,
      count(*) FILTER (WHERE p.gebaeudeflaeche IS NULL AND d.gebaeudeflaeche IS NOT NULL) AS n_gebaeudeflaeche,
      count(*) FILTER (WHERE p.hnf_schaetzung IS NULL AND d.hnf_schaetzung IS NOT NULL) AS n_hnf_schaetzung,
      count(*) FILTER (WHERE p.wohnflaeche IS NULL AND d.wohnflaeche IS NOT NULL) AS n_wohnflaeche,
      count(*) FILTER (WHERE p.nutzflaeche IS NULL AND d.nutzflaeche IS NOT NULL) AS n_nutzflaeche,
      count(*) FILTER (WHERE p.baujahr IS NULL AND d.baujahr IS NOT NULL) AS n_baujahr,
      count(*) FILTER (WHERE p.renovationsjahr IS NULL AND d.renovationsjahr IS NOT NULL) AS n_renovationsjahr,
      count(*) FILTER (WHERE p.geschosse IS NULL AND d.geschosse IS NOT NULL) AS n_geschosse,
      count(*) FILTER (WHERE p.wohnungen IS NULL AND d.wohnungen IS NOT NULL) AS n_wohnungen,
      count(*) FILTER (WHERE p.ausnuetzung IS NULL AND d.ausnuetzung IS NOT NULL) AS n_ausnuetzung,
      count(*) FILTER (WHERE p.zone IS NULL AND d.zone IS NOT NULL) AS n_zone,
      count(*) FILTER (WHERE p.kategorie IS NULL AND d.kategorie IS NOT NULL) AS n_kategorie,
      count(*) FILTER (WHERE p.gebaeudeart IS NULL AND d.gebaeudeart IS NOT NULL) AS n_gebaeudeart,
      count(*) FILTER (WHERE p.denkmalschutz IS NULL AND d.denkmalschutz IS NOT NULL) AS n_denkmalschutz,
      count(*) FILTER (WHERE p.isos IS NULL AND d.isos IS NOT NULL) AS n_isos,
      count(*) FILTER (WHERE p.google_maps_url IS NULL AND d.google_maps_url IS NOT NULL) AS n_google_maps_url,
      count(*) FILTER (WHERE p.streetview_url IS NULL AND d.streetview_url IS NOT NULL) AS n_streetview_url,
      count(*) FILTER (WHERE p.gis_url IS NULL AND d.gis_url IS NOT NULL) AS n_gis_url,
      count(*) FILTER (WHERE p.housing_stat_url IS NULL AND d.housing_stat_url IS NOT NULL) AS n_housing_stat_url,
      count(*) FILTER (WHERE p.bfs_nr IS NULL AND d.bfs_nr IS NOT NULL) AS n_bfs_nr
    FROM _dedup d
    JOIN public.properties p ON p.egrid = d.egrid
    WHERE d.egrid IS NOT NULL AND d.egrid <> ''
  )
  SELECT
    (z.n_strassenname +
           z.n_hausnummer +
           z.n_plz +
           z.n_plz_ort +
           z.n_gemeinde +
           z.n_bezirk +
           z.n_area +
           z.n_gebaeudeflaeche +
           z.n_hnf_schaetzung +
           z.n_wohnflaeche +
           z.n_nutzflaeche +
           z.n_baujahr +
           z.n_renovationsjahr +
           z.n_geschosse +
           z.n_wohnungen +
           z.n_ausnuetzung +
           z.n_zone +
           z.n_kategorie +
           z.n_gebaeudeart +
           z.n_denkmalschutz +
           z.n_isos +
           z.n_google_maps_url +
           z.n_streetview_url +
           z.n_gis_url +
           z.n_housing_stat_url +
           z.n_bfs_nr)::integer,
    (SELECT jsonb_object_agg(feld, anzahl)
     FROM jsonb_each(jsonb_build_object(
        'strassenname', z.n_strassenname,
        'hausnummer', z.n_hausnummer,
        'plz', z.n_plz,
        'plz_ort', z.n_plz_ort,
        'gemeinde', z.n_gemeinde,
        'bezirk', z.n_bezirk,
        'area', z.n_area,
        'gebaeudeflaeche', z.n_gebaeudeflaeche,
        'hnf_schaetzung', z.n_hnf_schaetzung,
        'wohnflaeche', z.n_wohnflaeche,
        'nutzflaeche', z.n_nutzflaeche,
        'baujahr', z.n_baujahr,
        'renovationsjahr', z.n_renovationsjahr,
        'geschosse', z.n_geschosse,
        'wohnungen', z.n_wohnungen,
        'ausnuetzung', z.n_ausnuetzung,
        'zone', z.n_zone,
        'kategorie', z.n_kategorie,
        'gebaeudeart', z.n_gebaeudeart,
        'denkmalschutz', z.n_denkmalschutz,
        'isos', z.n_isos,
        'google_maps_url', z.n_google_maps_url,
        'streetview_url', z.n_streetview_url,
        'gis_url', z.n_gis_url,
        'housing_stat_url', z.n_housing_stat_url,
        'bfs_nr', z.n_bfs_nr
     )) AS e(feld, wert)
     CROSS JOIN LATERAL (SELECT (e.wert)::integer AS anzahl) c
     WHERE c.anzahl > 0)
  INTO v_felder, v_detail
  FROM zaehlung z;

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

  RETURN QUERY SELECT v_ins, v_upd, COALESCE(v_felder, 0), COALESCE(v_detail, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.import_properties(jsonb, uuid, boolean) IS
  'Importiert einen Block Liegenschaften in einer Anweisung; bestehende Zeilen werden nur ergänzt, nie überschrieben. Meldet zurück, wie viele Parzellen neu sind und wie viele leere Felder die Liste gefüllt hat.';

GRANT EXECUTE ON FUNCTION public.import_properties(jsonb, uuid, boolean) TO anon, authenticated;
