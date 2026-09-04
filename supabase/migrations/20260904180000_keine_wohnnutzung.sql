-- =====================================================================
-- Zonen ohne Wohnnutzung ausschliessen
-- =====================================================================
-- Das Geschäft besteht darin, Eigentümer zum Verkauf zu bewegen, das
-- Objekt neu zu erstellen und teurer zu verkaufen oder zu vermieten. Wo
-- die Zone keine Wohnnutzung zulässt -- Gewerbe, Industrie, Arbeitszonen,
-- Zonen für öffentliche Bauten -- geht das nicht. Diese Objekte gehören
-- deshalb gar nicht erst in die Arbeitsliste, auch wenn dort baulich
-- Reserve läge.
--
-- Bewusst getrennt von ist_keine_bauzone(): dort geht es um Flächen, auf
-- denen überhaupt nicht gebaut werden darf. Hier darf gebaut werden, nur
-- nicht das, womit sich Geld verdienen lässt. Der Ausschlussgrund lautet
-- entsprechend anders, damit im Nachhinein nachvollziehbar bleibt, warum
-- ein Objekt aussortiert wurde.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.ist_keine_wohnnutzung(z text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    z ~* '(gewerbezone|industriezone|arbeitszone|(ö|oe)ffentliche(n)? (bauten|zwecke))',
    false
  )
$$;

COMMENT ON FUNCTION public.ist_keine_wohnnutzung(text) IS
  'Zone lässt keine Wohnnutzung zu (Gewerbe, Industrie, öffentliche Bauten)';

-- Kernrechnung: dort keine Ausnützung vergeben und als Killer vermerken
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
  v_zone        text;
  v_p           record;
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
  v_zone := public.norm_zone(p_zone);
  SELECT * INTO v_p FROM public.zone_parse(p_zone);

  -- Ausnützungsziffer: Objektwert vor Zonenziffer vor Zonentabelle.
  -- Nicht-Bauzonen und Zonen ohne Wohnnutzung bekommen gar keine.
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

  IF v_az IS NOT NULL AND p_area IS NOT NULL AND p_area > 0 THEN
    v_gf_zul := p_area * v_az;
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

  IF public.ist_vorhanden(p_denkmalschutz) THEN
    v_killer := v_killer || 'Denkmalschutz'::text;
  END IF;
  IF public.ist_vorhanden(p_isos) THEN
    v_killer := v_killer || 'ISOS-Ortsbild'::text;
  END IF;
  IF public.ist_keine_bauzone(p_zone) THEN
    v_killer := v_killer || 'Keine Bauzone'::text;
  END IF;
  IF public.ist_keine_wohnnutzung(p_zone) THEN
    v_killer := v_killer || 'Keine Wohnnutzung'::text;
  END IF;
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
        WHEN v_bj <= 1930 THEN 15
        WHEN v_bj <= 1960 THEN 12
        WHEN v_bj <= 1975 THEN 8
        WHEN v_bj <= 1990 THEN 4
        ELSE 0 END;
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

-- Trigger und Nachrechnung müssen den neuen Grund mitschreiben
CREATE OR REPLACE FUNCTION public.ausschluss_grund_von(p_zone text, p_denkmalschutz text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.ist_keine_bauzone(p_zone)     THEN 'Keine Bauzone'
    WHEN public.ist_keine_wohnnutzung(p_zone) THEN 'Keine Wohnnutzung'
    WHEN public.ist_vorhanden(p_denkmalschutz) THEN 'Denkmalschutz'
    ELSE NULL END
$$;

-- Trigger und Nachrechnung auf den erweiterten Ausschluss umstellen.
-- Beide setzten den Grund bisher über ein eigenes CASE; sie rufen jetzt
-- ausschluss_grund_von() auf, damit es nur noch eine Stelle gibt.
CREATE OR REPLACE FUNCTION public.trg_properties_potenzial()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE r jsonb;
BEGIN
  IF COALESCE(current_setting('bauraum.skip_potenzial', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  r := public.calc_potenzial(
    NEW.zone, NEW.ausnuetzung, NEW.area, NEW.gebaeudeflaeche,
    NEW.geschosse, NEW.vollgeschosse, NEW.baujahr, NEW.renovationsjahr,
    NEW.denkmalschutz, NEW.isos
  );

  NEW.ausnuetzung             := COALESCE(NEW.ausnuetzung, (r ->> 'ausnuetzung')::numeric);
  NEW.az_quelle               := r ->> 'az_quelle';
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

CREATE OR REPLACE FUNCTION public.potenzial_nachrechnen(p_batch integer DEFAULT 2000)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
SET statement_timeout = '180s'
AS $$
DECLARE v_rows integer;
BEGIN
  WITH todo AS (
    SELECT id FROM public.properties
    WHERE scored_at IS NULL
    LIMIT p_batch
    FOR UPDATE SKIP LOCKED
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
    hnf_schaetzung          = COALESCE(p.hnf_schaetzung, (c.r ->> 'hnf_neu')::numeric),
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

-- Bestand neu bewerten lassen: alle Zeilen, deren Bewertung sich durch den
-- erweiterten Ausschluss ändern kann.
UPDATE public.properties SET scored_at = NULL
WHERE public.ist_keine_wohnnutzung(zone) OR ausgeschlossen;
