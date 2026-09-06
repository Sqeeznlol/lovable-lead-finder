-- Ein Index auf dem Kanton
--
-- Seit Thurgau dazukam, stehen 396'271 Zeilen in der Tabelle. Die
-- Webseite fragt "gib mir die Objekte des gewählten Kantons" -- und
-- ohne Index geht die Datenbank dafür jede Zeile durch. Das dauert
-- länger als die Frist, die PostgREST einer Abfrage lässt: der Browser
-- bekam
--
--     HTTP 500  {"code":"57014",
--                "message":"canceling statement due to statement timeout"}
--
-- und damit gar keine Thurgauer Objekte zu sehen. Derselbe Fehler wie
-- beim Verschneiden und beim Einspielen, nur an dritter Stelle: es
-- fehlte der Index.
--
-- Der zweite Index bedient die Voreinstellung der Masterliste, die
-- innerhalb eines Kantons nach dem grössten Flächenzuwachs sortiert.
CREATE INDEX IF NOT EXISTS idx_properties_kanton
  ON public.properties (kanton);

CREATE INDEX IF NOT EXISTS idx_properties_kanton_hnf
  ON public.properties (kanton, hnf_delta DESC NULLS LAST);

ANALYZE public.properties;
