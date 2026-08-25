-- =====================================================================
-- Automatische Potenzial- und Investitionsrechnung
-- =====================================================================
-- Füllt hnf_bestand / hnf_neu / hnf_delta / hnf_faktor / reserve_gf /
-- reserve_quote / ausnuetzung / deal_score / score_tier / score_killers /
-- score_reasons für alle Liegenschaften — einmalig für den Bestand und
-- danach automatisch per Trigger bei jedem Insert/Update.
--
-- Spiegelt src/lib/potential.ts. Wer die Annahmen ändert (AZ pro Zone,
-- Baukosten, Erlös), ändert sie in public.potenzial_config und ruft
-- public.recompute_potenzial() auf.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Zusätzliche Ergebnis-Spalten
-- ---------------------------------------------------------------------
-- Diese Kennzahlen-Spalten existierten in der Produktionsinstanz bereits von
-- Hand; auf einer frischen Instanz gibt es sie nicht. Deshalb hier vollständig
-- anlegen, damit das Skript auf einer leeren Datenbank durchläuft.
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS vollgeschosse   numeric,
  ADD COLUMN IF NOT EXISTS geschosse       numeric,
  ADD COLUMN IF NOT EXISTS nutzflaeche     numeric,
  ADD COLUMN IF NOT EXISTS hnf_bestand     numeric,
  ADD COLUMN IF NOT EXISTS hnf_neu         numeric,
  ADD COLUMN IF NOT EXISTS hnf_delta       numeric,
  ADD COLUMN IF NOT EXISTS hnf_faktor      numeric,
  ADD COLUMN IF NOT EXISTS reserve_gf      numeric,
  ADD COLUMN IF NOT EXISTS reserve_quote   numeric,
  ADD COLUMN IF NOT EXISTS deal_score      numeric,
  ADD COLUMN IF NOT EXISTS score_tier      text,
  ADD COLUMN IF NOT EXISTS score_killers   jsonb,
  ADD COLUMN IF NOT EXISTS score_reasons   jsonb,
  ADD COLUMN IF NOT EXISTS scored_at       timestamptz,
  ADD COLUMN IF NOT EXISTS gf_zulaessig    numeric,
  ADD COLUMN IF NOT EXISTS gf_bestand      numeric,
  ADD COLUMN IF NOT EXISTS az_quelle       text,
  ADD COLUMN IF NOT EXISTS investition_chf numeric,
  ADD COLUMN IF NOT EXISTS erloes_chf      numeric,
  ADD COLUMN IF NOT EXISTS marge_chf       numeric,
  ADD COLUMN IF NOT EXISTS marge_quote     numeric,
  ADD COLUMN IF NOT EXISTS potenzial_score integer,
  ADD COLUMN IF NOT EXISTS confidence      text,
  ADD COLUMN IF NOT EXISTS ausgeschlossen  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ausschluss_grund text;

COMMENT ON COLUMN public.properties.gf_zulaessig    IS 'Zulässige anrechenbare Geschossfläche in m² (Grundstück × AZ)';
COMMENT ON COLUMN public.properties.gf_bestand      IS 'Heute genutzte Geschossfläche in m² (Gebäudefläche × Geschosse)';
COMMENT ON COLUMN public.properties.reserve_gf      IS 'Ungenutzte Reserve in m² aGF, nie negativ';
COMMENT ON COLUMN public.properties.reserve_quote   IS 'Reserve / zulässige aGF, 0–1';
COMMENT ON COLUMN public.properties.potenzial_score IS 'Automatischer Potenzial-Score 0–100 (siehe src/lib/potential.ts)';
COMMENT ON COLUMN public.properties.confidence      IS 'Verlässlichkeit der Rechnung: hoch | mittel | tief | keine';
COMMENT ON COLUMN public.properties.ausgeschlossen  IS 'Nicht kauf-/entwickelbar (Nicht-Bauzone oder Denkmalschutz) — aus allen Arbeitslisten ausgeblendet';

-- ---------------------------------------------------------------------
-- 2. Konfigurationstabelle (Annahmen, zentral änderbar)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.potenzial_config (
  id                 boolean PRIMARY KEY DEFAULT true CHECK (id),
  az_by_zone         jsonb   NOT NULL DEFAULT '{
    "W":0.35,"W2":0.45,"W2G":0.5,"W3":0.6,"W3G":0.65,"W4":0.75,"W4G":0.8,
    "W5":0.9,"W6":1.1,"W7":1.3,"WG":0.55,"WG2":0.55,"WG3":0.7,"WG4":0.85,
    "K":1.0,"Z":0.8
  }'::jsonb,
  hnf_faktor         numeric NOT NULL DEFAULT 0.8,
  baukosten_pro_m2   numeric NOT NULL DEFAULT 3200,
  erloes_pro_m2_hnf  numeric NOT NULL DEFAULT 9500,
  min_reserve_m2     numeric NOT NULL DEFAULT 80,
  ziel_reserve_quote numeric NOT NULL DEFAULT 0.35,
  -- Ziffer im Zonennamen ("Wohnzone 1.6"): Baumassenziffer oder Ausnützung?
  ziffer_als_bmz     boolean NOT NULL DEFAULT true,
  geschosshoehe      numeric NOT NULL DEFAULT 3.2,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.potenzial_config
  ADD COLUMN IF NOT EXISTS ziffer_als_bmz boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS geschosshoehe  numeric NOT NULL DEFAULT 3.2;

INSERT INTO public.potenzial_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.potenzial_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read potenzial_config" ON public.potenzial_config;
CREATE POLICY "Anyone can read potenzial_config"
  ON public.potenzial_config FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can update potenzial_config" ON public.potenzial_config;
CREATE POLICY "Authenticated can update potenzial_config"
  ON public.potenzial_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- 3. Zone normalisieren ("W3 (3 Vollgeschosse)" -> "W3")
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.norm_zone(z text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN z IS NULL OR btrim(z) = '' THEN NULL
    ELSE COALESCE(
      (regexp_match(upper(regexp_replace(z, '\s+', '', 'g')), '^([WKZ]{1,2}G?[0-9]?G?)'))[1],
      upper(btrim(z))
    )
  END
$$;

-- ---------------------------------------------------------------------
-- 3b. Textfelder und Nicht-Bauzonen auswerten
-- ---------------------------------------------------------------------
-- Die Listen schreiben "nicht vorhanden" bzw. "Kein Denkmalschutzobjekt im
-- Perimeter" statt leer zu lassen. Eine Prüfung auf "Feld gefüllt" würde
-- deshalb fast jedes Objekt als geschützt aussortieren.
CREATE OR REPLACE FUNCTION public.ist_vorhanden(v text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN v IS NULL THEN false
    WHEN lower(btrim(v)) IN ('', 'none', 'null', '-') THEN false
    WHEN lower(btrim(v)) ~ '^(nicht vorhanden|kein|keine|nein|no|n/a)' THEN false
    ELSE true
  END
$$;

-- Landwirtschaft, Wald, Freihalte-/Erholungszonen: nicht bebaubar.
CREATE OR REPLACE FUNCTION public.ist_keine_bauzone(z text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    z ~* 'landwirtschaftszone|wald|freihaltezone|erholungszone|gew(ä|ae)sser|reservezone|verkehrszone',
    false
  )
$$;

-- ---------------------------------------------------------------------
-- 3c. Zonen-Freitext auswerten
-- ---------------------------------------------------------------------
-- Die ZH-Listen liefern Zonen als Fliesstext, nicht als "W3":
--   "Wohnzone 1.6 (rechtskräftig, 8460m², 95%)"  -> Ziffer 1.6
--   "3-geschossige Wohnzone 2.5"                 -> 3 Geschosse, Ziffer 2.5
--   "Wohnzone 2/50"                              -> 2 Geschosse, ÜZ 50%
-- Der Klammerzusatz nennt Flächen der Zone, nicht des Grundstücks, und
-- muss vor dem Parsen weg — sonst wird "8460" als Ziffer gelesen.
CREATE OR REPLACE FUNCTION public.zone_parse(z text)
RETURNS TABLE (ziffer numeric, geschosse numeric, ueberbauungsziffer numeric, kurz text)
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  t text;
  m text[];
BEGIN
  ziffer := NULL; geschosse := NULL; ueberbauungsziffer := NULL; kurz := NULL;
  IF z IS NULL OR btrim(z) = '' THEN RETURN NEXT; RETURN; END IF;

  t := btrim(regexp_replace(z, '\([^)]*\)', ' ', 'g'));

  -- Bereits normierte Kurzform, z.B. "W3" oder "W4G"
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

-- ---------------------------------------------------------------------
-- 4. Kernrechnung — eine Zeile rein, alle Kennzahlen raus
-- ---------------------------------------------------------------------
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
  -- Fallback: zulässige Vollgeschosse pro Zone, falls keine AZ hinterlegt ist
  v_geschosse_zone jsonb := '{
    "W":2,"W2":2,"W2G":2,"W3":3,"W3G":3,"W4":4,"W4G":4,"W5":5,"W6":6,"W7":7,
    "WG":2,"WG2":2,"WG3":3,"WG4":4,"K":4,"Z":3
  }'::jsonb;
BEGIN
  SELECT * INTO cfg FROM public.potenzial_config WHERE id LIMIT 1;
  v_zone := public.norm_zone(p_zone);

  -- Ausnützungsziffer: Objektwert vor Zonentabelle vor Geschoss-Heuristik.
  -- Nicht-Bauzonen bekommen gar keine.
  IF public.ist_keine_bauzone(p_zone) THEN
    v_az := NULL;
  ELSIF p_ausnuetzung IS NOT NULL AND p_ausnuetzung > 0 AND p_ausnuetzung < 5 THEN
    v_az := p_ausnuetzung;
    v_az_quelle := 'objekt';
  ELSE
    SELECT * INTO v_p FROM public.zone_parse(p_zone);

    IF v_p.ziffer IS NOT NULL AND v_p.ziffer > 0 THEN
      -- Ziffer aus dem Zonennamen; als BMZ über die Geschosshöhe umrechnen
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
      v_gf_best := p_gebaeudeflaeche * 2;   -- konservative Annahme
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

  v_hnf_best  := v_gf_best * cfg.hnf_faktor;
  v_hnf_neu   := v_gf_zul  * cfg.hnf_faktor;
  IF v_hnf_neu IS NOT NULL AND v_hnf_best IS NOT NULL THEN
    v_hnf_delta := GREATEST(v_hnf_neu - v_hnf_best, 0);
  END IF;

  v_invest := v_reserve   * cfg.baukosten_pro_m2;
  v_erloes := v_hnf_delta * cfg.erloes_pro_m2_hnf;
  v_marge  := v_erloes - v_invest;
  IF v_invest IS NOT NULL AND v_invest > 0 THEN
    v_marge_q := v_marge / v_invest;
  END IF;

  -- Killer-Kriterien
  IF public.ist_vorhanden(p_denkmalschutz) THEN
    v_killer := v_killer || 'Denkmalschutz'::text;
  END IF;
  IF public.ist_vorhanden(p_isos) THEN
    v_killer := v_killer || 'ISOS-Ortsbild'::text;
  END IF;
  IF public.ist_keine_bauzone(p_zone) THEN
    v_killer := v_killer || 'Keine Bauzone'::text;
  END IF;
  IF v_reserve IS NOT NULL AND v_reserve < cfg.min_reserve_m2 THEN
    v_killer := v_killer || ('Reserve < ' || cfg.min_reserve_m2 || ' m²')::text;
  END IF;

  -- Verlässlichkeit
  IF v_gf_zul IS NOT NULL AND v_gf_best IS NOT NULL THEN
    IF v_az_quelle = 'objekt' AND v_geschosse IS NOT NULL THEN v_conf := 'hoch';
    ELSIF v_az_quelle = 'zone' AND v_geschosse IS NOT NULL THEN v_conf := 'mittel';
    ELSE v_conf := 'tief';
    END IF;
  END IF;

  -- Score 0–100 (identisch zu potentialScore() im Frontend)
  IF v_reserve IS NOT NULL THEN
    v_score := LEAST(v_reserve / 1500, 1) * 35
             + LEAST(COALESCE(v_quote, 0) / NULLIF(cfg.ziel_reserve_quote, 0), 1) * 30
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

-- ---------------------------------------------------------------------
-- 5. Trigger — jede neue/geänderte Zeile rechnet sich selbst
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_properties_potenzial()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE r jsonb;
BEGIN
  r := public.calc_potenzial(
    NEW.zone, NEW.ausnuetzung, NEW.area, NEW.gebaeudeflaeche,
    NEW.geschosse, NEW.vollgeschosse, NEW.baujahr, NEW.renovationsjahr,
    NEW.denkmalschutz, NEW.isos
  );

  NEW.ausnuetzung     := COALESCE(NEW.ausnuetzung, (r ->> 'ausnuetzung')::numeric);
  NEW.az_quelle       := r ->> 'az_quelle';
  NEW.gf_zulaessig    := (r ->> 'gf_zulaessig')::numeric;
  NEW.gf_bestand      := (r ->> 'gf_bestand')::numeric;
  NEW.reserve_gf      := (r ->> 'reserve_gf')::numeric;
  NEW.reserve_quote   := (r ->> 'reserve_quote')::numeric;
  NEW.hnf_faktor      := (r ->> 'hnf_faktor')::numeric;
  NEW.hnf_bestand     := (r ->> 'hnf_bestand')::numeric;
  NEW.hnf_neu         := (r ->> 'hnf_neu')::numeric;
  NEW.hnf_delta       := (r ->> 'hnf_delta')::numeric;
  NEW.hnf_schaetzung  := COALESCE(NEW.hnf_schaetzung, (r ->> 'hnf_bestand')::numeric);
  NEW.investition_chf := (r ->> 'investition_chf')::numeric;
  NEW.erloes_chf      := (r ->> 'erloes_chf')::numeric;
  NEW.marge_chf       := (r ->> 'marge_chf')::numeric;
  NEW.marge_quote     := (r ->> 'marge_quote')::numeric;
  NEW.potenzial_score := (r ->> 'potenzial_score')::int;
  NEW.confidence      := r ->> 'confidence';
  NEW.score_killers   := r -> 'killer';
  NEW.score_reasons   := r -> 'reasons';
  NEW.score_tier      := CASE
                           WHEN (r ->> 'potenzial_score')::int >= 70 THEN 'A'
                           WHEN (r ->> 'potenzial_score')::int >= 50 THEN 'B'
                           WHEN (r ->> 'potenzial_score')::int >= 30 THEN 'C'
                           ELSE 'D' END;
  NEW.ausgeschlossen   := public.ist_keine_bauzone(NEW.zone) OR public.ist_vorhanden(NEW.denkmalschutz);
  NEW.ausschluss_grund := CASE
                            WHEN public.ist_keine_bauzone(NEW.zone) THEN 'Keine Bauzone'
                            WHEN public.ist_vorhanden(NEW.denkmalschutz) THEN 'Denkmalschutz'
                            ELSE NULL END;
  -- Ausgeschlossene Objekte gar nicht erst in die Vorauswahl geben
  IF NEW.ausgeschlossen AND NEW.preselection_status = 'Nicht geprüft' THEN
    NEW.preselection_status := 'Ausschliessen';
    NEW.preselection_note   := COALESCE(NEW.preselection_note, 'Automatisch: ' || NEW.ausschluss_grund);
  END IF;
  NEW.scored_at       := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_properties_potenzial ON public.properties;
CREATE TRIGGER trg_properties_potenzial
  BEFORE INSERT OR UPDATE OF zone, ausnuetzung, area, gebaeudeflaeche,
                             geschosse, vollgeschosse, baujahr, renovationsjahr,
                             denkmalschutz, isos
  ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.trg_properties_potenzial();

-- ---------------------------------------------------------------------
-- 6. Nachrechnen des Bestands — in Batches, damit nichts timeoutet
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_potenzial(p_batch integer DEFAULT 5000)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_done integer := 0;
  v_rows integer;
BEGIN
  LOOP
    WITH todo AS (
      SELECT id FROM public.properties
      WHERE scored_at IS NULL OR scored_at < (SELECT updated_at FROM public.potenzial_config WHERE id)
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
      ausnuetzung     = COALESCE(p.ausnuetzung, (c.r ->> 'ausnuetzung')::numeric),
      az_quelle       = c.r ->> 'az_quelle',
      gf_zulaessig    = (c.r ->> 'gf_zulaessig')::numeric,
      gf_bestand      = (c.r ->> 'gf_bestand')::numeric,
      reserve_gf      = (c.r ->> 'reserve_gf')::numeric,
      reserve_quote   = (c.r ->> 'reserve_quote')::numeric,
      hnf_faktor      = (c.r ->> 'hnf_faktor')::numeric,
      hnf_bestand     = (c.r ->> 'hnf_bestand')::numeric,
      hnf_neu         = (c.r ->> 'hnf_neu')::numeric,
      hnf_delta       = (c.r ->> 'hnf_delta')::numeric,
      hnf_schaetzung  = COALESCE(p.hnf_schaetzung, (c.r ->> 'hnf_bestand')::numeric),
      investition_chf = (c.r ->> 'investition_chf')::numeric,
      erloes_chf      = (c.r ->> 'erloes_chf')::numeric,
      marge_chf       = (c.r ->> 'marge_chf')::numeric,
      marge_quote     = (c.r ->> 'marge_quote')::numeric,
      potenzial_score = (c.r ->> 'potenzial_score')::int,
      confidence      = c.r ->> 'confidence',
      score_killers   = c.r -> 'killer',
      score_reasons   = c.r -> 'reasons',
      ausgeschlossen  = public.ist_keine_bauzone(p.zone) OR public.ist_vorhanden(p.denkmalschutz),
      ausschluss_grund = CASE
                           WHEN public.ist_keine_bauzone(p.zone) THEN 'Keine Bauzone'
                           WHEN public.ist_vorhanden(p.denkmalschutz) THEN 'Denkmalschutz'
                           ELSE NULL END,
      preselection_status = CASE
                              WHEN (public.ist_keine_bauzone(p.zone) OR public.ist_vorhanden(p.denkmalschutz))
                                   AND p.preselection_status = 'Nicht geprüft'
                              THEN 'Ausschliessen' ELSE p.preselection_status END,
      score_tier      = CASE
                          WHEN (c.r ->> 'potenzial_score')::int >= 70 THEN 'A'
                          WHEN (c.r ->> 'potenzial_score')::int >= 50 THEN 'B'
                          WHEN (c.r ->> 'potenzial_score')::int >= 30 THEN 'C'
                          ELSE 'D' END,
      scored_at       = now()
    FROM calc c WHERE c.id = p.id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_done := v_done + v_rows;
    EXIT WHEN v_rows = 0;
  END LOOP;
  RETURN v_done;
END;
$$;

-- Indexe für die neuen Sortier-/Filterfelder
CREATE INDEX IF NOT EXISTS idx_properties_potenzial_score ON public.properties (potenzial_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_properties_reserve_gf      ON public.properties (reserve_gf DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_properties_score_tier      ON public.properties (score_tier);
CREATE INDEX IF NOT EXISTS idx_properties_ausgeschlossen   ON public.properties (ausgeschlossen) WHERE NOT ausgeschlossen;

-- Bestand einmalig durchrechnen
SELECT public.recompute_potenzial();
