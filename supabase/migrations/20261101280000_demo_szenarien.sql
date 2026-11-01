-- =====================================================================
-- Demo-Szenarien der Zentrale (30 Kundenfälle)
-- =====================================================================
-- Erzeugt von tools/demo_szenarien.mjs aus daten/demo-szenarien.json --
-- dort ändern, nicht hier.
--
-- Gewünscht am 1. November: 20 bis 40 durchgespielte Fälle mit
-- verschiedenen Firmen, damit jede Seite der Zentrale mit echtem
-- Inhalt zu sehen und zu prüfen ist. Alle Firmen sind erfunden und
-- tragen "(Demo)"; die Parzellen sind echte Zürcher Parzellen -- eine
-- Zuordnung zu einer erfundenen Firma, am Grundstück ändert sich
-- nichts. Jede Zeile trägt den Vermerk TESTDATEN.
--
-- Wegräumen, alles auf einmal (Vorhaben, Portfolio und Positionen
-- hängen am Mandanten und gehen mit). Gelegenheiten zuerst: sie
-- verlieren beim Löschen des Mandanten nur den Bezug (on delete set
-- null) und blieben sonst ohne Kunde stehen.
--
--   delete from public.gelegenheit g using public.mandant m, public.akteur a
--    where g.mandant_id = m.id and m.akteur_id = a.id and a.bemerkung = 'TESTDATEN -- Demo-Szenario';
--   delete from public.mandant m using public.akteur a
--    where m.akteur_id = a.id and a.bemerkung = 'TESTDATEN -- Demo-Szenario';
--   delete from public.akteur where bemerkung = 'TESTDATEN -- Demo-Szenario';
--
-- Mehrfach einspielen schadet nicht: was schon da ist, wird gefunden.
-- =====================================================================

create or replace function pg_temp.demo_fall(
  p_kunde text, p_kunde_art text, p_art text, p_titel text, p_zustand text,
  p_monate int, p_gemeinden text[], p_anzahl int, p_offen int, p_vollmacht boolean,
  p_lagen text[], p_objekttypen text[], p_beschreibung text, p_verlauf text[]
) returns void language plpgsql as $f$
declare
  eigner uuid; kunde uuid; mappe uuid; vh uuid; i int;
begin
  select id into eigner from public.akteur where name = p_kunde and bemerkung = 'TESTDATEN -- Demo-Szenario';
  if eigner is null then
    insert into public.akteur (art, name, ort, bemerkung)
    values (p_kunde_art, p_kunde, coalesce(p_gemeinden[1], p_lagen[1]), 'TESTDATEN -- Demo-Szenario')
    returning id into eigner;
  end if;

  select id into kunde from public.mandant where akteur_id = eigner;
  if kunde is null then
    insert into public.mandant (akteur_id, produkt, bemerkung)
    values (eigner, 'acquisition', 'TESTDATEN') returning id into kunde;
  end if;

  if exists (select 1 from public.vorhaben where mandant_id = kunde and titel = p_titel) then
    return;
  end if;

  if p_anzahl > 0 then
    insert into public.portfolio (mandant_id, name) values (kunde, p_titel) returning id into mappe;

    -- Echte Parzellen der genannten Gemeinden: mit EGRID und Adresse,
    -- nicht ausgeschlossen, je Adresse eine. Zuerst die mit Reserve,
    -- sonst gemischt -- aber für jeden Fall gleich (md5 statt random),
    -- damit ein zweites Einspielen dieselbe Auswahl träfe.
    insert into public.portfolio_position (portfolio_id, parzelle_id, roh_adresse, zuordnung)
    select mappe, p.id, p.address, 'zugeordnet'
      from (
        select distinct on (lower(address)) id, address, hnf_delta
          from public.properties
         where kanton = 'ZH'
           and egrid is not null
           and address not like 'Parzelle %'
           and coalesce(ausgeschlossen, false) = false
           and exists (select 1 from unnest(p_gemeinden) g where properties.gemeinde ilike g || '%')
         order by lower(address), area desc nulls last
      ) p
     order by (coalesce(p.hnf_delta, 0) > 0) desc, md5(p.id::text || p_titel)
     limit greatest(0, p_anzahl - p_offen);

    -- Was der Kunde liefert, aber nicht zuzuordnen war: bleibt als
    -- Rohtext stehen, wie bei echten Listen.
    for i in 1 .. p_offen loop
      insert into public.portfolio_position (portfolio_id, roh_adresse, zuordnung)
      values (mappe, 'Adresse ' || i || ' laut Kundenliste, nicht eindeutig', 'offen');
    end loop;
  end if;

  insert into public.vorhaben (mandant_id, art, titel, beschreibung, zeitraum_bis, portfolio_id, zustand,
                               vollmacht_am, vollmacht_von, lagen, objekttypen, zustaendig)
  values (kunde, p_art, p_titel, p_beschreibung,
          case when p_monate > 0 then (current_date + make_interval(months => p_monate))::date end,
          mappe, p_zustand,
          case when p_vollmacht then current_date - 14 end,
          case when p_vollmacht then 'Geschäftsleitung ' || p_kunde end,
          p_lagen, p_objekttypen, 'Julian')
  returning id into vh;

  insert into public.vorhaben_eintrag (vorhaben_id, am, von, art, text)
  select vh, now() - make_interval(days => ((coalesce(array_length(p_verlauf, 1), 0) - n) * 3 + 1)::int),
         'Demo', 'schritt', t
    from unnest(p_verlauf) with ordinality as x(t, n);
end $f$;

select pg_temp.demo_fall('Pensionskasse Glattal (Demo)', 'institution', 'entwickeln', 'Bestand Zürich Nord verdichten', 'research', 6, array['Zürich']::text[], 1000, 38, false, null, null, '1000 Adressen aus dem Direktbestand. Wünscht Start der Entwicklung in sechs Monaten; zuerst die Lagen mit der grössten Reserve.', array['Adressliste erhalten (Excel, 1000 Zeilen)', '962 Adressen zugeordnet, 38 offen']::text[]);
select pg_temp.demo_fall('Anlagestiftung Zürichsee (Demo)', 'institution', 'entwickeln', 'Arrondierung Goldküste', 'akquise', 9, array['Küsnacht', 'Meilen', 'Herrliberg', 'Erlenbach']::text[], 120, 0, true, null, null, 'Nachbarparzellen zu eigenen Liegenschaften zukaufen, um grösser bauen zu können.', array['Vollmacht unterschrieben', '41 Nachbarn angeschrieben', '3 Rückmeldungen, 1 Besichtigung']::text[]);
select pg_temp.demo_fall('Vorsorgestiftung Irchel (Demo)', 'institution', 'verkaufen', 'Drei Wohnbauten Winterthur abstossen', 'analyse', 4, array['Winterthur']::text[], 3, 0, false, null, null, 'Off-market an geprüfte Käufer; keine öffentliche Ausschreibung.', array['Objekte besichtigt', 'Bewertung angefordert']::text[]);
select pg_temp.demo_fall('Limmat Wohnbau AG (Demo)', 'firma', 'kaufen', 'Suche MFH Agglomeration West', 'eingegangen', 12, null, 0, 0, false, array['Dietikon', 'Schlieren', 'Urdorf']::text[], array['MFH']::text[], 'Budget bis 25 Mio. je Objekt, Baujahr vor 1980 bevorzugt.', null);
select pg_temp.demo_fall('Versicherung Alpstein (Demo)', 'institution', 'entwickeln', 'Ersatzneubau Oerlikon und Seebach', 'freigabe', 8, array['Zürich']::text[], 64, 2, false, null, null, 'Analyse liegt beim Anlageausschuss; Entscheid im nächsten Quartal.', array['Analyse an Kunde übergeben', 'Rückfragen zu zwei Parzellen beantwortet']::text[]);
select pg_temp.demo_fall('Familie Brunner Holding (Demo)', 'firma', 'verkaufen', 'Gewerbeliegenschaft Kloten', 'abgeschlossen', 0, array['Kloten']::text[], 1, 0, false, null, null, 'Verkauf an Investor aus dem Netzwerk, off-market.', array['Käufer aus Netzwerk vorgestellt', 'Beurkundung erfolgt']::text[]);
select pg_temp.demo_fall('Immobilienfonds Uetliberg (Demo)', 'institution', 'kaufen', 'Entwicklungsareale ab 5000 m²', 'research', 18, null, 0, 0, false, array['Winterthur', 'Uster', 'Wetzikon']::text[], array['Land', 'Gewerbe']::text[], 'Sucht grosse Areale mit Umzonungspotenzial.', null);
select pg_temp.demo_fall('Pensionskasse Tösstal (Demo)', 'institution', 'entwickeln', 'Portfolio Tösstal prüfen', 'analyse', 6, array['Bauma', 'Turbenthal', 'Wila', 'Zell']::text[], 180, 11, false, null, null, 'Alter Bestand, viele Reserven vermutet.', array['180 Adressen erhalten', '169 zugeordnet']::text[]);
select pg_temp.demo_fall('Wohnbaugenossenschaft Sonnenhalde (Demo)', 'institution', 'entwickeln', 'Siedlungen erneuern Schwamendingen', 'eingegangen', 24, array['Zürich']::text[], 42, 0, false, null, null, 'Etappierte Erneuerung, Mieterschaft bleibt.', null);
select pg_temp.demo_fall('Stiftung Pfannenstiel (Demo)', 'institution', 'verkaufen', 'Landreserve Egg', 'pausiert', 10, array['Egg']::text[], 2, 0, false, null, null, 'Stiftungsrat wartet auf Zonenplanrevision.', array['Pausiert bis Revision der Nutzungsplanung']::text[]);
select pg_temp.demo_fall('Nordring Real Estate AG (Demo)', 'firma', 'entwickeln', 'Gewerbe zu Wohnen Opfikon', 'akquise', 5, array['Opfikon', 'Wallisellen']::text[], 25, 0, true, null, null, 'Umnutzung von Gewerbebauten; Nachbarn für grössere Areale.', array['Vollmacht erhalten', '12 Eigentümer kontaktiert']::text[]);
select pg_temp.demo_fall('Anlagestiftung Furttal (Demo)', 'institution', 'entwickeln', 'Bestand Furttal', 'research', 7, array['Regensdorf', 'Buchs', 'Dällikon', 'Otelfingen']::text[], 240, 17, false, null, null, null, null);
select pg_temp.demo_fall('Ammann Erben Verwaltung (Demo)', 'firma', 'verkaufen', 'Erbengemeinschaft Horgen', 'freigabe', 3, array['Horgen']::text[], 4, 0, false, null, null, 'Fünf Erben, Einigkeit über Verkauf; Preisfreigabe ausstehend.', null);
select pg_temp.demo_fall('Pensionskasse Weinland (Demo)', 'institution', 'entwickeln', 'Weinland: Reserven heben', 'analyse', 9, array['Andelfingen', 'Marthalen', 'Stammheim', 'Ossingen']::text[], 95, 4, false, null, null, null, null);
select pg_temp.demo_fall('Seefeld Kapitalpartner (Demo)', 'firma', 'kaufen', 'Renditeobjekte Stadt Zürich', 'akquise', 6, null, 0, 0, true, array['Zürich']::text[], array['MFH', 'Wohn- und Geschäftshaus']::text[], 'Bis 40 Mio., Kreise 3, 4, 6, 10.', null);
select pg_temp.demo_fall('Versicherung Rigi (Demo)', 'institution', 'entwickeln', 'Bahnhofgebiete Oberland', 'research', 12, array['Wetzikon', 'Hinwil', 'Rüti', 'Bubikon']::text[], 310, 22, false, null, null, null, null);
select pg_temp.demo_fall('Gartenstadt Immobilien AG (Demo)', 'firma', 'entwickeln', 'Einfamilienhauszonen Uster', 'eingegangen', 15, array['Uster']::text[], 70, 6, false, null, null, null, null);
select pg_temp.demo_fall('Personalvorsorge Unterland (Demo)', 'institution', 'verkaufen', 'Bülach: Bestand bereinigen', 'analyse', 6, array['Bülach', 'Bachenbülach', 'Winkel']::text[], 18, 1, false, null, null, null, null);
select pg_temp.demo_fall('Familie Keller Immobilien (Demo)', 'firma', 'entwickeln', 'Dorfkern Wädenswil', 'abgeschlossen', 0, array['Wädenswil']::text[], 6, 0, false, null, null, null, array['Zwei Nachbarparzellen erworben', 'Baueingabe eingereicht']::text[]);
select pg_temp.demo_fall('Anlagefonds Albis (Demo)', 'institution', 'entwickeln', 'Knonaueramt Gesamtanalyse', 'freigabe', 9, array['Affoltern am Albis', 'Obfelden', 'Mettmenstetten', 'Hausen am Albis']::text[], 150, 9, false, null, null, null, null);
select pg_temp.demo_fall('Stadtwerk Pensionskasse (Demo)', 'institution', 'entwickeln', 'Winterthur: 600 Adressen', 'research', 6, array['Winterthur']::text[], 600, 41, false, null, null, 'Grösstes Mandat nach Glattal; gleiche Vorgehensweise.', null);
select pg_temp.demo_fall('Hofmann Bau und Land AG (Demo)', 'firma', 'kaufen', 'Bauland Zürcher Oberland', 'research', 9, null, 0, 0, false, array['Pfäffikon', 'Fehraltorf', 'Russikon']::text[], array['Land']::text[], null, null);
select pg_temp.demo_fall('Stiftung Lindenhof (Demo)', 'institution', 'verkaufen', 'Altstadthaus Zürich', 'akquise', 2, array['Zürich']::text[], 1, 0, true, null, null, 'Käufer aus dem Netzwerk angefragt, zwei Angebote.', array['Zwei Angebote erhalten', 'Zweite Runde mit beiden']::text[]);
select pg_temp.demo_fall('Pensionskasse Limmattal (Demo)', 'institution', 'entwickeln', 'Dietikon und Schlieren verdichten', 'analyse', 6, array['Dietikon', 'Schlieren']::text[], 210, 13, false, null, null, null, null);
select pg_temp.demo_fall('Glärnisch Asset Management (Demo)', 'firma', 'entwickeln', 'Zimmerberg Arrondierung', 'pausiert', 12, array['Thalwil', 'Rüschlikon', 'Kilchberg', 'Oberrieden']::text[], 36, 0, false, null, null, null, null);
select pg_temp.demo_fall('Vorsorgewerk Rafzerfeld (Demo)', 'institution', 'entwickeln', 'Rafzerfeld und Eglisau', 'eingegangen', 9, array['Rafz', 'Eglisau', 'Glattfelden']::text[], 48, 3, false, null, null, null, null);
select pg_temp.demo_fall('Meier und Partner Family Office (Demo)', 'firma', 'kaufen', 'Wohnhäuser Seeufer', 'freigabe', 6, null, 0, 0, false, array['Stäfa', 'Männedorf', 'Uetikon am See']::text[], array['MFH', 'EFH']::text[], null, null);
select pg_temp.demo_fall('Anlagestiftung Greifensee (Demo)', 'institution', 'entwickeln', 'Greifensee und Fällanden', 'akquise', 7, array['Greifensee', 'Fällanden', 'Volketswil', 'Schwerzenbach']::text[], 88, 0, true, null, null, null, null);
select pg_temp.demo_fall('Industriepark Hard AG (Demo)', 'firma', 'verkaufen', 'Industrieareal Embrach', 'research', 12, array['Embrach']::text[], 7, 0, false, null, null, 'Areal mit möglicher Umzonung; Käufer mit langem Atem gesucht.', null);
select pg_temp.demo_fall('Pensionskasse Säntisblick mit sehr langem Stiftungsnamen für den Härtetest (Demo)', 'institution', 'entwickeln', 'Ein sehr langer Vorhabentitel, der prüft, ob Liste und Kopf auch dann sauber umbrechen, wenn jemand alles in den Titel schreibt', 'research', 1, array['Dübendorf', 'Wangen-Brüttisellen']::text[], 15, 15, false, null, null, 'Härtetest: alle Adressen noch offen, Frist fast erreicht.', null);

do $$
declare n int; a int;
begin
  select count(*), coalesce(sum(adressen), 0) into n, a from public.vorhaben_liste where kunde like '%(Demo)';
  raise notice 'Demo-Szenarien: % Vorhaben, % Adressen', n, a;
end $$;
