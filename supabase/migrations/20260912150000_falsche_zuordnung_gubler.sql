-- ===================================================================
-- Eine Auskunft beim falschen Grundstueck
-- ===================================================================
-- Das Lesezeichen hat eine Zeitlang die erste Nummer genommen, die
-- irgendwo auf der Portalseite stand, statt die aus dem Auszug. So ist
-- Rudolf Gubler von der Grabenstrasse 12 (Parzelle 447,
-- CH627728290920) bei der Alten Basadingerstrasse 3 (Parzelle 454,
-- CH770977292983) gelandet.
--
-- Belegt ist das durch den Auszug selbst: "Rudolf Gubler,
-- Grabenstrasse 12, 8253 Diessenhofen, 1/1" unter "Liegenschaft Nr.
-- 447 ( CH627728290920 )".
--
-- Die Ursache ist im Lesezeichen behoben; hier werden die Daten
-- geradegerueckt.
-- ===================================================================

-- Die falsche Zuordnung faellt weg, und das Grundstueck kommt zurueck
-- in die Abfrageliste. Geraten wird nichts: wer dort Eigentuemer ist,
-- steht noch nicht fest.
update public.properties
set owner_name = null,
    owner_name_2 = null,
    owner_address = null,
    owners_json = null,
    eigentuemer_name = null,
    eigentuemer_adresse = null,
    eigentuemer_plz_ort = null,
    eigentuemer_fetched_at = null,
    is_queried = false,
    status = 'Neu'
where egrid = 'CH770977292983'
  and owner_name = 'Rudolf Gubler';

-- Und dorthin, wo er hingehoert -- aber nur, wenn dort noch niemand
-- steht. Einen bestehenden Eintrag zu ueberschreiben waere derselbe
-- Fehler noch einmal.
update public.properties
set owner_name = 'Rudolf Gubler',
    owner_address = 'Grabenstrasse 12, 8253 Diessenhofen',
    eigentuemer_name = 'Rudolf Gubler',
    eigentuemer_adresse = 'Grabenstrasse 12',
    eigentuemer_plz_ort = '8253 Diessenhofen',
    eigentuemer_fetched_at = now(),
    owners_json = jsonb_build_array(jsonb_build_object(
      'name', 'Rudolf Gubler',
      'fullName', 'Rudolf Gubler',
      'address', 'Grabenstrasse 12',
      'plz', '8253',
      'ort', 'Diessenhofen',
      'ownershipType', '1/1'))
where egrid = 'CH627728290920'
  and coalesce(owner_name, '') = '';

-- "1/1" ist der Anteil am Eigentum, keine Adresse. Als Adresse
-- gespeichert landet er auf einem Briefumschlag.
update public.properties
set eigentuemer_adresse = null
where eigentuemer_adresse ~ '^\s*\d+\s*/\s*\d+\s*$';

update public.properties
set owner_address = nullif(btrim(regexp_replace(
      owner_address, '^\s*\d+\s*/\s*\d+\s*,?\s*', '')), '')
where owner_address ~ '^\s*\d+\s*/\s*\d+\s*(,|$)';
