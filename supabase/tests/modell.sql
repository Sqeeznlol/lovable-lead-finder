-- =====================================================================
-- Prüft die Übernahme der Eigentümer ins neue Modell
-- =====================================================================
-- Entworfen an den wirklichen Daten vom 31. Oktober (114 Auskünfte),
-- geschrieben mit erfundenen Namen: die echten Eigentümer sind
-- Personendaten und gehören nicht ins Repository. Die *Muster* sind
-- abgeschrieben, nicht die Menschen.
--
-- Läuft im Ablauf "Modell prüfen" bei jedem Push.
-- =====================================================================

insert into public.properties (address, egrid, owner_name, owner_name_2,
       owners_json, eigentuemer_adresse, eigentuemer_plz_ort, eigentuemer_fetched_at) values
-- Dieselbe Person auf zwei Parzellen -- muss ein Akteur werden.
('Haldenweg 2','CH1','Erwin Amrein',null,null,'Haldenweg 2','8526 Musterdorf',now()),
('Haldenweg 3','CH2','Erwin Amrein',null,null,'Haldenweg 2','8526 Musterdorf',now()),
-- Gleicher Name, andere Gemeinde -- zwei Menschen, kein Zusammenlegen.
('Seeweg 4','CH3','Hans Brunner',null,null,'Seeweg 4','8598 Seedorf',now()),
('Bergweg 9','CH4','Hans Brunner',null,null,'Bergweg 9','7451 Bergdorf',now()),
-- Umlaut gegen Umschrift -- derselbe Mensch.
('Rebweg 1','CH5','Jürg Müller',null,null,'Rebweg 1','8525 Rebdorf',now()),
('Rebweg 3','CH6','Juerg Mueller',null,null,'Rebweg 1','8525 Rebdorf',now()),
-- Erbengemeinschaft -- keine Person, die man anruft.
('Franzosenweg 11','CH7','Steiner Robert Erben',null,null,null,'8253 Musterstadt',now()),
-- Firma auf zwei Parzellen -- Name allein genügt zum Zusammenlegen.
('Zugerweg 62','CH8','Lindauer Metallwarenfabrik AG',null,null,'Zugerweg 64','8820 Werkdorf',now()),
('Winterweg 53','CH9','Lindauer Metallwarenfabrik AG',null,null,'Zugerweg 64','8820 Werkdorf',now()),
('Kirchweg 2','CH10','Evangelische Kirchgemeinde Musterdorf',null,null,'Kirchweg 2','8253 Musterstadt',now()),
-- Nachname zuerst, wie im Grundbuch.
('Hauptweg 26','CH11','Brunner Werner Emil',null,null,null,'8598 Seedorf',now()),
-- Ein einziges Wort -- Person oder Firma?
('Steinweg 7','CH12','Rieder',null,null,'Steinweg 48','8804 Auendorf',now()),
-- owners_json hat Vorrang vor den Textfeldern.
('Doppelweg 1','CH13','WIRD IGNORIERT','AUCH IGNORIERT',
 '[{"name":"Anna Maria Frei","address":"Doppelweg 1","plz":"8400","ort":"Doppeldorf","ownershipType":"Miteigentum"},
   {"name":"Talacker AG","address":"Hauptweg 36","plz":"8598","ort":"Seedorf","ownershipType":"Miteigentum"}]'::jsonb,
 null,null,now()),
('Zweiweg 5','CH14','Peter Gerber','Rita Gerber',null,'Zweiweg 5','8400 Doppeldorf',now());

select * from public.eigentuemer_uebernehmen();

do $$
declare n int; m text;
begin
  select count(*) into n from akteur where name='Erwin Amrein';
  if n <> 1 then raise exception 'Erwin Amrein: % Akteure statt 1', n; end if;
  select count(*) into n from eigentum e join akteur a on a.id=e.akteur_id where a.name='Erwin Amrein';
  if n <> 2 then raise exception 'Erwin Amrein: % Parzellen statt 2', n; end if;

  select count(*) into n from akteur where name='Hans Brunner';
  if n <> 2 then raise exception 'Hans Brunner: % statt 2 -- verschiedene PLZ sind verschiedene Menschen', n; end if;

  select count(*) into n from akteur where name_norm = public.akteur_norm('Jürg Müller');
  if n <> 1 then raise exception 'Umlaut: % Akteure statt 1', n; end if;
  select count(*) into n from eigentum e join akteur a on a.id=e.akteur_id
    where a.name_norm = public.akteur_norm('Jürg Müller');
  if n <> 2 then raise exception 'Umlaut: % Parzellen statt 2', n; end if;

  select art into m from akteur where name='Steiner Robert Erben';
  if m <> 'gemeinschaft' then raise exception 'Erbengemeinschaft als % eingestuft', m; end if;

  select art into m from akteur where name like 'Lindauer%';
  if m <> 'firma' then raise exception 'AG als % eingestuft', m; end if;
  select count(*) into n from eigentum e join akteur a on a.id=e.akteur_id where a.name like 'Lindauer%';
  if n <> 2 then raise exception 'Firma: % Parzellen statt 2', n; end if;

  select art into m from akteur where name like 'Evangelische%';
  if m <> 'institution' then raise exception 'Kirchgemeinde als % eingestuft', m; end if;

  if not (select name_umgedreht from akteur where name='Brunner Werner Emil')
    then raise exception 'Nachname-zuerst nicht erkannt'; end if;
  if (select art_sicher from akteur where name='Rieder')
    then raise exception 'Einzelwort gilt faelschlich als sicher'; end if;

  select count(*) into n from akteur where name like '%IGNORIERT%';
  if n <> 0 then raise exception 'Textfeld wurde trotz owners_json verwendet'; end if;
  select count(*) into n from eigentum e join properties p on p.id=e.parzelle_id
    where p.address='Doppelweg 1';
  if n <> 2 then raise exception 'owners_json: % Eigentuemer statt 2', n; end if;
  select count(*) into n from eigentum e join properties p on p.id=e.parzelle_id
    where p.address='Zweiweg 5';
  if n <> 2 then raise exception 'zwei Textfelder: % statt 2', n; end if;

  if (select count(*) from eigentum where geprueft) > 0
    then raise exception 'Etwas gilt als geprueft, obwohl es nur umgezogen wurde'; end if;

  -- Wiederholbar: ein zweiter Lauf darf nichts Neues anlegen.
  perform public.eigentuemer_uebernehmen();
  select count(*) into n from akteur;
  if n <> 13 then raise exception 'Nach dem zweiten Lauf % Akteure statt 13', n; end if;

  -- Die Zweifelsfaelle muessen vorgelegt werden, nicht still durchgehen.
  select count(*) into n from eigentuemer_zu_pruefen;
  if n <> 3 then raise exception 'Zu pruefen: % Faelle statt 3', n; end if;

  raise notice 'Übernahme: alle Zusicherungen erfuellt.';
end $$;

-- ----------------------------------------------- Zugang, im Verhalten
do $$
declare n int;
begin
  execute 'grant usage on schema public to anon, authenticated';
  execute 'grant select on all tables in schema public to anon, authenticated';
  set local role anon;
  select count(*) into n from public.akteur;
  if n <> 0 then raise exception 'anon sieht % Akteure -- die Tabelle muss verschlossen sein', n; end if;
  select count(*) into n from public.eigentum;
  if n <> 0 then raise exception 'anon sieht % Eigentumszeilen', n; end if;
  reset role;
  set local role authenticated;
  select count(*) into n from public.akteur;
  if n = 0 then raise exception 'angemeldet sieht keine Akteure -- Regel zu streng'; end if;
  reset role;
  raise notice 'Zugang: anon verschlossen, angemeldet offen.';
end $$;

-- ------------------------------------------------- Geometrie (PostGIS)
do $$
declare n int;
begin
  update public.properties set geometrie =
    ST_Multi(ST_GeomFromText('POLYGON((2690000 1250000, 2690100 1250000,
                                        2690100 1250100, 2690000 1250100,
                                        2690000 1250000))', 2056))
  where address = 'Haldenweg 2';
  update public.properties set geometrie =
    ST_Multi(ST_GeomFromText('POLYGON((2690100 1250000, 2690200 1250000,
                                        2690200 1250100, 2690100 1250100,
                                        2690100 1250000))', 2056))
  where address = 'Haldenweg 3';

  -- Eine dritte Parzelle, die *nicht* angrenzt: sonst wuerde der
  -- Test auch dann gruen, wenn die Funktion schlicht alles paart.
  update public.properties set geometrie =
    ST_Multi(ST_GeomFromText('POLYGON((2695000 1255000, 2695100 1255000,
                                        2695100 1255100, 2695000 1255100,
                                        2695000 1255000))', 2056))
  where address = 'Seeweg 4';

  -- Genau das ist die Frage, an der Arrondierung und
  -- Baugesuch-Meldung haengen: grenzt a an b?
  perform public.nachbarschaft_rechnen();

  select count(*) into n from public.nachbarschaft;
  if n <> 2 then raise exception 'Nachbarschaft: % Zeilen statt 2 (beide Richtungen)', n; end if;
  if (select grenzlaenge_m from public.nachbarschaft limit 1) <> 100
    then raise exception 'Gemeinsame Grenze falsch berechnet'; end if;

  -- Die entfernte Parzelle darf keinen Nachbarn haben.
  select count(*) into n from public.nachbarschaft nb
  join public.properties p on p.id = nb.parzelle_id
  where p.address = 'Seeweg 4';
  if n <> 0 then raise exception 'Entfernte Parzelle hat % Nachbarn', n; end if;

  -- Wiederholbar: ein zweiter Lauf darf nicht verdoppeln.
  perform public.nachbarschaft_rechnen();
  select count(*) into n from public.nachbarschaft;
  if n <> 2 then raise exception 'Nach dem zweiten Lauf % Zeilen statt 2', n; end if;

  -- Und die Sicht, die die Oberflaeche benutzen wird.
  select count(*) into n from public.nachbarn
  where nachbar_adresse = 'Haldenweg 3';
  if n <> 1 then raise exception 'Sicht nachbarn: % Treffer statt 1', n; end if;

  raise notice 'Geometrie: Nachbarschaft gerechnet, Grenze 100 m, Ferne ohne Nachbarn.';
end $$;

-- --------------------------------------------- Geländer gegen Massenlöschung
-- Die Oberfläche löscht einzeln und muss das weiter können; der Griff
-- nach dem ganzen Bestand über den öffentlichen Zugang darf nicht
-- gehen. Beides wird hier im Verhalten geprüft, nicht behauptet.
do $$
declare n int; fehler text;
begin
  -- Genug Zeilen, um die Grenze zu überschreiten.
  insert into public.properties (address, egrid)
  select 'Wegwerfweg ' || i, 'CHTEST' || i from generate_series(1, 30) i;

  execute 'grant delete on public.properties to anon';

  -- 1. Einzeln löschen muss weiter gehen.
  set local role anon;
  delete from public.properties where address = 'Wegwerfweg 1';
  reset role;
  select count(*) into n from public.properties where address = 'Wegwerfweg 1';
  if n <> 0 then raise exception 'Einzellöschen wurde blockiert -- das Geländer sitzt zu eng'; end if;

  -- 2. Alles auf einmal darf nicht gehen.
  begin
    set local role anon;
    delete from public.properties where address like 'Wegwerfweg%';
    reset role;
    raise exception 'Massenlöschung ging durch -- das Geländer greift nicht';
  exception
    when insufficient_privilege then
      reset role;
      raise notice 'Geländer: Massenlöschung abgewiesen, Einzellöschen geht.';
  end;

  -- Der Bestand muss noch da sein.
  select count(*) into n from public.properties where address like 'Wegwerfweg%';
  if n <> 29 then raise exception 'Nach der abgewiesenen Löschung stehen % statt 29 Zeilen da', n; end if;
end $$;
