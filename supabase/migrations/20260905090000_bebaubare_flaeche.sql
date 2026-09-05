-- =====================================================================
-- Bebaubare Fläche aus dem Zonenanteil statt aus der ganzen Parzelle
-- =====================================================================
-- Die Zonenangabe der ZH-Listen trägt einen Klammerzusatz:
--
--   "Wohnzone dreigeschossig 2.7 BMZ (rechtskräftig, 1357m², 100%)"
--
-- Die 1'357 m² sind nicht die Grösse der Zone im Allgemeinen, sondern ihr
-- Anteil an genau dieser Parzelle. Geprüft an 24'279 Zeilen einer echten
-- Liste: Klammerfläche geteilt durch den Prozentsatz ergibt bei 98.8% die
-- Grundstücksfläche.
--
-- Bisher wurde mit dem Feld "area" gerechnet. Das führte zu Objekten mit
-- 660'936 m² Grundstück in einer Wohnzone und Margen von über vier
-- Milliarden Franken -- eine Parzelle kann eben zur Hälfte Bauzone und zur
-- Hälfte Wald oder Wiese sein, bebauen lässt sich nur der Zonenanteil.
--
-- zone_parse() liefert diesen Anteil jetzt mit, und die Kernrechnung nimmt
-- ihn als Rechenfläche. Nur wo die Liste ihn nicht nennt, muss weiterhin
-- die ganze Grundstücksfläche herhalten.
-- =====================================================================

DROP FUNCTION IF EXISTS public.zone_parse(text);

CREATE OR REPLACE FUNCTION public.zone_parse(z text)
RETURNS TABLE (
  ziffer             numeric,
  zonenflaeche       numeric,
  anteil_prozent     numeric,
  geschosse          numeric,
  ueberbauungsziffer numeric,
  kurz               text
)
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  t text;
  m text[];
BEGIN
  ziffer := NULL; zonenflaeche := NULL; anteil_prozent := NULL;
  geschosse := NULL; ueberbauungsziffer := NULL; kurz := NULL;
  IF z IS NULL OR btrim(z) = '' THEN RETURN NEXT; RETURN; END IF;

  -- Klammerzusatz auswerten, bevor er entfernt wird
  m := regexp_match(z, '([0-9''’.]+)\s*m²\s*,\s*([0-9]+)\s*%');
  IF m IS NOT NULL THEN
    BEGIN
      zonenflaeche   := replace(replace(m[1], '''', ''), '’', '')::numeric;
      anteil_prozent := m[2]::numeric;
    EXCEPTION WHEN others THEN
      zonenflaeche := NULL; anteil_prozent := NULL;
    END;
    IF zonenflaeche IS NOT NULL AND zonenflaeche <= 0 THEN zonenflaeche := NULL; END IF;
  END IF;

  t := btrim(regexp_replace(z, '\([^)]*\)', ' ', 'g'));

  m := regexp_match(upper(regexp_replace(t, '\s+', '', 'g')), '^([WKZ]{1,2}G?[0-9]?G?)$');
  IF m IS NOT NULL THEN kurz := m[1]; RETURN NEXT; RETURN; END IF;

  m := regexp_match(t, '([0-9]+)\s*-?\s*geschossig', 'i');
  IF m IS NOT NULL THEN geschosse := m[1]::numeric; END IF;

  m := regexp_match(t, '([0-9]+)\s*/\s*([0-9]{2,3})');
  IF m IS NOT NULL THEN
    geschosse := COALESCE(geschosse, m[1]::numeric);
    ueberbauungsziffer := m[2]::numeric;
  ELSE
    m := regexp_match(t, '([0-9]+[.,][0-9]+)');
    IF m IS NOT NULL THEN ziffer := replace(m[1], ',', '.')::numeric; END IF;
  END IF;

  RETURN NEXT;
END;
$$;

-- Kernrechnung: Zonenanteil als bebaubare Fläche
CREATE OR REPLACE FUNCTION public.calc_potenzial(
  p_zone           text,
  p_ausnuetzung    numeric,
  p_area           numeric,
  p_gebaeudeflaeche numeric,
  p_geschosse      numeric,
  p_vollgeschosse  numeric,
  p_baujahr        integer,
  p_renovationsjahr integer,
  p_denkmalschutz  text,
  p_isos           text
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  cfg           public.potenzial_config%ROWTYPE;
  v_p           record;
  v_area        numeric;
  v_az          numeric;
  v_az_quelle   text;
  v_geschosse   numeric;
  v_gf_zul      numeric;
  v_gf_best     numeric;
  v_raw_reserve numeric;
  v_reserve     numeric;
  v_quote       numeric;
  v_vg          numeric;
  v_anrechenbar numeric;
  v_hnf_best    numeric;
  v_hnf_neu     numeric;
  v_hnf_delta   numeric;
  v_invest      numeric;
  v_erloes      numeric;
  v_marge       numeric;
  v_marge_q     numeric;
  v_killer      text[] := ARRAY[]::text[];
  v_reasons     text[] := ARRAY[]::text[];
  v_conf        text := 'keine';
  v_score       numeric := 0;
  v_bj          integer;
  v_geschosse_zone jsonb := '{
    "W":2,"W2":2,"W2G":2,"W3":3,"W3G":3,"W4":4,"W4G":4,"W5":5,"W6":6,"W7":7,
    "WG":2,"WG2":2,"WG3":3,"WG4":4,"K":4,"Z":3
  }'::jsonb;
BEGIN
  SELECT * INTO cfg FROM public.potenzial_config WHERE id LIMIT 1;
  SELECT * INTO v_p FROM public.zone_parse(p_zone);

  IF public.ist_keine_bauzone(p_zone) OR public.ist_keine_wohnnutzung(p_zone) THEN
    v_az := NULL;
  ELSIF p_ausnuetzung IS NOT NULL AND p_ausnuetzung > 0 AND p_ausnuetzung < 5 THEN
    v_az := p_ausnuetzung;
    v_az_quelle := 'objekt';
  ELSE
    IF v_p.ziffer IS NOT NULL AND v_p.ziffer > 0 THEN
      v_az := CASE WHEN cfg.ziffer_als_bmz
                   THEN v_p.ziffer / NULLIF(cfg.geschosshoehe, 0)
                   ELSE v_p.ziffer END;
      v_az_quelle := 'zone';
    ELSIF v_p.geschosse IS NOT NULL AND v_p.ueberbauungsziffer IS NOT NULL THEN
      v_az := v_p.geschosse * (v_p.ueberbauungsziffer / 100);
      v_az_quelle := 'zone';
    ELSIF v_p.kurz IS NOT NULL AND cfg.az_by_zone ? v_p.kurz THEN
      v_az := (cfg.az_by_zone ->> v_p.kurz)::numeric;
      v_az_quelle := 'zone';
    ELSIF v_p.geschosse IS NOT NULL THEN
      v_az := v_p.geschosse * 0.3;
      v_az_quelle := 'geschosse';
    ELSIF v_p.kurz IS NOT NULL AND v_geschosse_zone ? v_p.kurz THEN
      v_az := (v_geschosse_zone ->> v_p.kurz)::numeric * 0.3;
      v_az_quelle := 'geschosse';
    END IF;
  END IF;

  -- Bebaubar ist der Teil der Parzelle, der in dieser Zone liegt.
  v_area := COALESCE(v_p.zonenflaeche, p_area);
  IF v_area IS NOT NULL AND v_area <= 0 THEN v_area := NULL; END IF;

  IF v_p.zonenflaeche IS NOT NULL AND p_area IS NOT NULL AND p_area > 0
     AND abs(v_p.zonenflaeche - p_area) / p_area > 0.1 THEN
    v_reasons := v_reasons ||
      ('Bebaubar ' || round(v_p.zonenflaeche) || ' m² von ' || round(p_area) || ' m² Parzelle')::text;
  ELSIF v_p.zonenflaeche IS NULL AND p_area IS NOT NULL THEN
    v_reasons := v_reasons || 'Zonenanteil unbekannt — ganze Grundstücksfläche gerechnet'::text;
  END IF;

  IF v_az IS NOT NULL AND v_area IS NOT NULL THEN
    v_gf_zul := v_area * v_az;
  END IF;

  v_geschosse := COALESCE(NULLIF(p_geschosse, 0), NULLIF(p_vollgeschosse, 0));
  IF p_gebaeudeflaeche IS NOT NULL AND p_gebaeudeflaeche > 0 THEN
    IF v_geschosse IS NOT NULL AND v_geschosse > 0 THEN
      v_gf_best := p_gebaeudeflaeche * v_geschosse;
    ELSE
      v_gf_best := p_gebaeudeflaeche * 2;
      v_reasons := v_reasons || 'Geschosse unbekannt — 2 Vollgeschosse angenommen'::text;
    END IF;
  END IF;

  IF v_gf_zul IS NOT NULL AND v_gf_best IS NOT NULL THEN
    v_raw_reserve := v_gf_zul - v_gf_best;
    v_reserve := GREATEST(v_raw_reserve, 0);
    IF v_gf_zul > 0 THEN v_quote := v_reserve / v_gf_zul; END IF;
    IF v_raw_reserve < 0 THEN
      v_killer := v_killer || 'Bestand überschreitet Zone (Besitzstand)'::text;
    END IF;
  END IF;

  v_vg := COALESCE(v_p.geschosse, v_geschosse, 2);
  v_anrechenbar := v_vg + CASE WHEN cfg.mit_attika THEN cfg.attika_faktor ELSE 0 END;

  v_hnf_best := v_gf_best * cfg.hnf_faktor;
  IF v_gf_zul IS NOT NULL AND v_vg > 0 THEN
    v_hnf_neu := (v_gf_zul / v_vg) * v_anrechenbar * cfg.hnf_faktor;
  END IF;
  IF v_hnf_neu IS NOT NULL AND v_hnf_best IS NOT NULL THEN
    v_hnf_delta := GREATEST(v_hnf_neu - v_hnf_best, 0);
  END IF;

  v_invest := v_reserve   * cfg.baukosten_pro_m2;
  v_erloes := v_hnf_delta * cfg.erloes_pro_m2_hnf;
  v_marge  := v_erloes - v_invest;
  IF v_invest IS NOT NULL AND v_invest > 0 THEN
    v_marge_q := v_marge / v_invest;
  END IF;

  IF public.ist_vorhanden(p_denkmalschutz) THEN v_killer := v_killer || 'Denkmalschutz'::text; END IF;
  IF public.ist_vorhanden(p_isos)          THEN v_killer := v_killer || 'ISOS-Ortsbild'::text; END IF;
  IF public.ist_keine_bauzone(p_zone)      THEN v_killer := v_killer || 'Keine Bauzone'::text; END IF;
  IF public.ist_keine_wohnnutzung(p_zone)  THEN v_killer := v_killer || 'Keine Wohnnutzung'::text; END IF;
  IF v_reserve IS NOT NULL AND v_reserve < cfg.min_reserve_m2 THEN
    v_killer := v_killer || ('Reserve < ' || cfg.min_reserve_m2 || ' m²')::text;
  END IF;

  IF v_gf_zul IS NOT NULL AND v_gf_best IS NOT NULL THEN
    IF v_az_quelle = 'objekt' AND v_geschosse IS NOT NULL THEN v_conf := 'hoch';
    ELSIF v_az_quelle = 'zone' AND v_geschosse IS NOT NULL THEN v_conf := 'mittel';
    ELSE v_conf := 'tief';
    END IF;
  END IF;

  IF v_hnf_delta IS NOT NULL THEN
    v_score := LEAST(v_hnf_delta / 1200, 1) * 40
             + LEAST(CASE WHEN v_hnf_best > 0 THEN v_hnf_delta / v_hnf_best ELSE 1 END, 1) * 25
             + LEAST(GREATEST(COALESCE(v_marge_q, 0), 0) / 0.5, 1) * 15;
    v_bj := COALESCE(p_renovationsjahr, p_baujahr);
    IF v_bj IS NOT NULL THEN
      v_score := v_score + CASE
        WHEN v_bj <= 1930 THEN 15 WHEN v_bj <= 1960 THEN 12
        WHEN v_bj <= 1975 THEN 8  WHEN v_bj <= 1990 THEN 4 ELSE 0 END;
    END IF;
    v_score := v_score + LEAST(COALESCE(v_az, 0) / 1.3, 1) * 5;
    v_score := v_score - COALESCE(array_length(v_killer, 1), 0) * 25;
    v_score := GREATEST(0, LEAST(100, v_score));
  END IF;

  IF v_az_quelle IS NOT NULL THEN
    v_reasons := v_reasons || ('AZ ' || v_az || ' (' || v_az_quelle || ')')::text;
  END IF;

  RETURN jsonb_build_object(
    'ausnuetzung',     v_az,
    'az_quelle',       v_az_quelle,
    'bebaubar_m2',     round(v_area),
    'gf_zulaessig',    round(v_gf_zul),
    'gf_bestand',      round(v_gf_best),
    'reserve_gf',      round(v_reserve),
    'reserve_quote',   round(v_quote, 3),
    'hnf_faktor',      cfg.hnf_faktor,
    'vollgeschosse',   v_vg,
    'anrechenbar',     round(v_anrechenbar, 2),
    'hnf_bestand',     round(v_hnf_best),
    'hnf_neu',         round(v_hnf_neu),
    'hnf_delta',       round(v_hnf_delta),
    'investition_chf', round(v_invest),
    'erloes_chf',      round(v_erloes),
    'marge_chf',       round(v_marge),
    'marge_quote',     round(v_marge_q, 3),
    'potenzial_score', round(v_score)::int,
    'confidence',      v_conf,
    'killer',          to_jsonb(v_killer),
    'reasons',         to_jsonb(v_reasons)
  );
END;
$$;

ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS bebaubar_m2 numeric;
COMMENT ON COLUMN public.properties.bebaubar_m2 IS
  'Fläche der Parzelle, die in der massgebenden Bauzone liegt';

-- Trigger und Nachrechnung müssen die neue Spalte mitschreiben
CREATE OR REPLACE FUNCTION public.potenzial_nachrechnen(p_batch integer DEFAULT 2000)
RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = public
SET statement_timeout = '180s'
AS $$
DECLARE v_rows integer;
BEGIN
  WITH todo AS (
    SELECT id FROM public.properties WHERE scored_at IS NULL
    LIMIT p_batch FOR UPDATE SKIP LOCKED
  ),
  calc AS (
    SELECT p.id, public.calc_potenzial(
             p.zone, p.ausnuetzung, p.area, p.gebaeudeflaeche, p.geschosse,
             p.vollgeschosse, p.baujahr, p.renovationsjahr, p.denkmalschutz, p.isos
           ) AS r
    FROM public.properties p JOIN todo t ON t.id = p.id
  )
  UPDATE public.properties p SET
    ausnuetzung             = COALESCE(p.ausnuetzung, (c.r ->> 'ausnuetzung')::numeric),
    az_quelle               = c.r ->> 'az_quelle',
    bebaubar_m2             = (c.r ->> 'bebaubar_m2')::numeric,
    gf_zulaessig            = (c.r ->> 'gf_zulaessig')::numeric,
    gf_bestand              = (c.r ->> 'gf_bestand')::numeric,
    reserve_gf              = (c.r ->> 'reserve_gf')::numeric,
    reserve_quote           = (c.r ->> 'reserve_quote')::numeric,
    hnf_faktor              = (c.r ->> 'hnf_faktor')::numeric,
    vollgeschosse_zulaessig = (c.r ->> 'vollgeschosse')::numeric,
    anrechenbare_geschosse  = (c.r ->> 'anrechenbar')::numeric,
    hnf_bestand             = (c.r ->> 'hnf_bestand')::numeric,
    hnf_neu                 = (c.r ->> 'hnf_neu')::numeric,
    hnf_delta               = (c.r ->> 'hnf_delta')::numeric,
    hnf_schaetzung          = (c.r ->> 'hnf_neu')::numeric,
    investition_chf         = (c.r ->> 'investition_chf')::numeric,
    erloes_chf              = (c.r ->> 'erloes_chf')::numeric,
    marge_chf               = (c.r ->> 'marge_chf')::numeric,
    marge_quote             = (c.r ->> 'marge_quote')::numeric,
    potenzial_score         = (c.r ->> 'potenzial_score')::int,
    confidence              = c.r ->> 'confidence',
    score_killers           = c.r -> 'killer',
    score_reasons           = c.r -> 'reasons',
    score_tier              = CASE
                                WHEN (c.r ->> 'potenzial_score')::int >= 70 THEN 'A'
                                WHEN (c.r ->> 'potenzial_score')::int >= 50 THEN 'B'
                                WHEN (c.r ->> 'potenzial_score')::int >= 30 THEN 'C'
                                ELSE 'D' END,
    ausschluss_grund = public.ausschluss_grund_von(p.zone, p.denkmalschutz),
    ausgeschlossen   = public.ausschluss_grund_von(p.zone, p.denkmalschutz) IS NOT NULL,
    preselection_status = CASE
                            WHEN public.ausschluss_grund_von(p.zone, p.denkmalschutz) IS NOT NULL
                                 AND p.preselection_status = 'Nicht geprüft'
                            THEN 'Ausschliessen' ELSE p.preselection_status END,
    scored_at = now()
  FROM calc c WHERE c.id = p.id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.potenzial_nachrechnen(integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_properties_potenzial()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF COALESCE(current_setting('bauraum.skip_potenzial', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;
  r := public.calc_potenzial(NEW.zone, NEW.ausnuetzung, NEW.area, NEW.gebaeudeflaeche,
       NEW.geschosse, NEW.vollgeschosse, NEW.baujahr, NEW.renovationsjahr,
       NEW.denkmalschutz, NEW.isos);
  NEW.ausnuetzung             := COALESCE(NEW.ausnuetzung, (r ->> 'ausnuetzung')::numeric);
  NEW.az_quelle               := r ->> 'az_quelle';
  NEW.bebaubar_m2             := (r ->> 'bebaubar_m2')::numeric;
  NEW.gf_zulaessig            := (r ->> 'gf_zulaessig')::numeric;
  NEW.gf_bestand              := (r ->> 'gf_bestand')::numeric;
  NEW.reserve_gf              := (r ->> 'reserve_gf')::numeric;
  NEW.reserve_quote           := (r ->> 'reserve_quote')::numeric;
  NEW.hnf_faktor              := (r ->> 'hnf_faktor')::numeric;
  NEW.vollgeschosse_zulaessig := (r ->> 'vollgeschosse')::numeric;
  NEW.anrechenbare_geschosse  := (r ->> 'anrechenbar')::numeric;
  NEW.hnf_bestand             := (r ->> 'hnf_bestand')::numeric;
  NEW.hnf_neu                 := (r ->> 'hnf_neu')::numeric;
  NEW.hnf_delta               := (r ->> 'hnf_delta')::numeric;
  NEW.hnf_schaetzung          := (r ->> 'hnf_neu')::numeric;
  NEW.investition_chf         := (r ->> 'investition_chf')::numeric;
  NEW.erloes_chf              := (r ->> 'erloes_chf')::numeric;
  NEW.marge_chf               := (r ->> 'marge_chf')::numeric;
  NEW.marge_quote             := (r ->> 'marge_quote')::numeric;
  NEW.potenzial_score         := (r ->> 'potenzial_score')::int;
  NEW.confidence              := r ->> 'confidence';
  NEW.score_killers           := r -> 'killer';
  NEW.score_reasons           := r -> 'reasons';
  NEW.score_tier              := CASE
                                   WHEN (r ->> 'potenzial_score')::int >= 70 THEN 'A'
                                   WHEN (r ->> 'potenzial_score')::int >= 50 THEN 'B'
                                   WHEN (r ->> 'potenzial_score')::int >= 30 THEN 'C'
                                   ELSE 'D' END;
  NEW.ausschluss_grund := public.ausschluss_grund_von(NEW.zone, NEW.denkmalschutz);
  NEW.ausgeschlossen   := NEW.ausschluss_grund IS NOT NULL;
  IF NEW.ausgeschlossen AND NEW.preselection_status = 'Nicht geprüft' THEN
    NEW.preselection_status := 'Ausschliessen';
    NEW.preselection_note   := COALESCE(NEW.preselection_note, 'Automatisch: ' || NEW.ausschluss_grund);
  END IF;
  NEW.scored_at := now();
  RETURN NEW;
END;
$$;

-- Alles neu bewerten: die Rechenfläche hat sich für viele Objekte geändert
UPDATE public.properties SET scored_at = NULL;
