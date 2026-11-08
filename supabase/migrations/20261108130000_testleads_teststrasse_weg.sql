-- Die ersten Testdaten vom 8. November hatten erfundene Adressen
-- ("Teststrasse 7, 8610 Uster") ohne Parzelle. Ersetzt durch 20
-- Test-Leads, die über die echten Check-Seiten gingen (Quelle "test",
-- Namen mit TEST). Nur genau diese 20 Zeilen: markiert, Name TEST,
-- Adresse "Teststrasse".
delete from public.anfrage
where angaben->>'test' = 'true'
  and name like 'TEST %'
  and adresse like 'Teststrasse %';
