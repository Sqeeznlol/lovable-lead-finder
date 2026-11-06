-- =====================================================================
-- Wohntraums: die erste Fondsleitung -- Helvetica, zwei Gefässe, 50 Liegenschaften
-- =====================================================================
-- Julian, 6. November: "Das ist die erste komplette Liste für einen Fonds
-- Manager ... Das ist unser erster Fondsmanager, unser erster Kunde."
-- Keine Testdaten. Die Liste (Asset_Liste_HSL_HL.xlsx) nennt je Zeile
-- Gefäss, Strasse/Nr., PLZ, Ort und Kanton; die Gefässe heissen wie in
-- der Spalte: "Helvetica Swiss Living Fund (HSL)" (42 Liegenschaften)
-- und "HL Anlagestiftung – Nachhaltiges Suburbanes Wohnen Schweiz" (8).
-- Fondsleitung beider Gefässe ist die Helvetica Asset Management AG,
-- Zürich (Website des Anbieters, 6. November).
--
-- Jede Zeile wurde am 6. November beim Bund aufgelöst (api3.geo.admin.ch:
-- Adresse -> Eingänge -> Gebäude im GWR -> Parzelle der Amtlichen
-- Vermessung), Werkzeug tools/fondsliste_aufloesen.cjs:
--   * Bereiche wie "18-24" zählen die Strassenseite der Enden; die andere
--     Seite nur, wenn ihr Haus auf derselben Parzelle steht ("Standweg
--     1-6" ist ein Grundstück, "Hof 23" neben "Hof 20-44" nicht).
--   * Gleicher Strassenname in zwei Ortschaften derselben PLZ (Erlen /
--     Engishofen): es zählt die Ortschaft der Liste.
--   * Lage = Schwerpunkt der Hauptparzelle (die mit den meisten Häusern
--     der Zeile), Fläche = Summe der Parzellen der Zeile, Nachbarn = alle
--     angrenzenden Parzellen laut Bund.
-- Kantone: AG, BE, BL, BS, FR, LU, SG, SH, SO, TG, VS, ZH. Im Bestand (Zürich, Thurgau) wird die
-- Parzelle über die EGRID verknüpft; die übrigen tragen ihre Lage selbst
-- (20261106100000_position_lage.sql) und stehen so im Universum.
--
-- Läuft mehrfach ohne Doppel: was unter demselben Rohtext im Gefäss steht,
-- wird übersprungen.
-- =====================================================================

do $$
declare
  tid uuid; aid uuid; mid uuid; hsl uuid; hl uuid; pid uuid; parz uuid; r record;
  neu int := 0; schon int := 0; verknuepft int := 0;
begin
  select id into tid from public.team where name = 'Helvetica';
  if tid is null then
    insert into public.team (name, art) values ('Helvetica', 'fonds') returning id into tid;
  end if;

  select id into aid from public.akteur where name_norm = public.akteur_norm('Helvetica Asset Management AG') limit 1;
  if aid is null then
    insert into public.akteur (art, name, ort, bemerkung)
    values ('institution', 'Helvetica Asset Management AG', 'Zürich', 'Fondsleitung HSL und HL Anlagestiftung; erster Kunde (6. November 2026)')
    returning id into aid;
  end if;

  select id into mid from public.mandant where akteur_id = aid and team_id = tid limit 1;
  if mid is null then
    insert into public.mandant (akteur_id, produkt, team_id, bemerkung)
    values (aid, 'intelligence', tid, 'Asset-Liste HSL/HL vom 6. November 2026') returning id into mid;
  end if;

  select id into hsl from public.portfolio where mandant_id = mid and name = 'Helvetica Swiss Living Fund (HSL)';
  if hsl is null then
    insert into public.portfolio (mandant_id, name) values (mid, 'Helvetica Swiss Living Fund (HSL)') returning id into hsl;
  end if;
  select id into hl from public.portfolio where mandant_id = mid and name = 'HL Anlagestiftung – Nachhaltiges Suburbanes Wohnen Schweiz';
  if hl is null then
    insert into public.portfolio (mandant_id, name) values (mid, 'HL Anlagestiftung – Nachhaltiges Suburbanes Wohnen Schweiz') returning id into hl;
  end if;

  for r in
    select * from (values
    (1, 'hl', 'Neubrückstrasse 18-24, 2555 Brügg', 'CH583646351108', 2587794.8, 1218974.2, 749, 'Brügg', 'BE',
     array['CH784846351005', 'CH994612813553']::text[]),
    (2, 'hl', 'Fälimattpark 1-4, 5735 Pfeffikon LU', 'CH368650352995', 2655731.3, 1233821.4, 6333, 'Rickenbach', 'LU',
     array['CH335086352916', 'CH352950863504', 'CH382350358625', 'CH473586295060', 'CH808635235076', 'CH813902768311', 'CH913901768383']::text[]),
    (3, 'hl', 'Neufeldstrasse 19, 5013 Niedergösgen', 'CH753532890682', 2641859.8, 1246795.5, 1682, 'Niedergösgen', 'SO',
     array['CH108706233281', 'CH883032069897', 'CH908706233203', 'CH910635328918', 'CH929838320631']::text[]),
    (4, 'hl', 'Weidstrasse 1+3, 4656 Starrkirch-Wil', 'CH528848320656', 2636681.6, 1244748.1, 2054, 'Starrkirch-Wil', 'SO',
     array['CH152732800644', 'CH168732066855', 'CH170687533209', 'CH185332068716', 'CH428068320629', 'CH645710777460', 'CH782132068202', 'CH809906013270', 'CH810601329957']::text[]),
    (5, 'hl', 'Feldstrasse 4/6/6a/8/10/12, 9434 Au SG', 'CH432777947177', 2765861.1, 1254919.6, 2916, 'Au', 'SG',
     array['CH567727947263', 'CH592777989407', 'CH657627779469', 'CH679477722723', 'CH892777879435']::text[]),
    (6, 'hl', 'Hofackerstrasse 16a/b, 9606 Bütschwil', 'CH919877967780', 2723641.2, 1247319.6, 3120, 'Bütschwil-Ganterschwil', 'SG',
     array['CH234277638216', 'CH407798779668', 'CH716377427791', 'CH834277638206', 'CH934277638566']::text[]),
    (7, 'hl', 'Rainstrasse 16-18b, 9500 Wil', 'CH380893127724', 2721595.1, 1257344.6, 5565, 'Wil', 'SG',
     array['CH111288937762', 'CH367793129353', 'CH480893127787', 'CH539377127258', 'CH958893771204', 'CH989693127763']::text[]),
    (8, 'hl', 'Lohstrasse 2-2a, 8580 Amriswil', 'CH967754511465', 2740711.9, 1267567.2, 3554, 'Amriswil', 'TG',
     array['CH181454517767', 'CH327739545103', 'CH386954517766', 'CH515137547731', 'CH552754775162', 'CH588250867763', 'CH735477514580', 'CH753854775185']::text[]),
    (9, 'hsl', 'Wydenstrasse 16/18/20, 5242 Birr', 'CH848967797365', 2658086.5, 1254538.4, 3932, 'Birr', 'AG',
     array['CH307989816749', 'CH457367798951', 'CH596779738956', 'CH978979736792']::text[]),
    (10, 'hsl', 'Myrtenstrasse 32/34, Hauptstrasse 81/83, 5737 Menziken', 'CH528984763925', 2657019.9, 1232251.7, 6225, 'Menziken', 'AG',
     array['CH328999763955', 'CH537689398425', 'CH597689803943', 'CH608939857609', 'CH628973763990', 'CH868976398626', 'CH908939757634']::text[]),
    (11, 'hsl', 'Schrägweg 16/18/20/22, 5727 Oberkulm', 'CH457076813995', 2651488.8, 1239044.2, 4776, 'Oberkulm', 'AG',
     array['CH128177763952', 'CH208139727612', 'CH228184763952', 'CH237681398405', 'CH508139707613', 'CH737681397835', 'CH743976817896']::text[]),
    (12, 'hsl', 'Hof 20-44, 5612 Villmergen', 'CH458015935036', 2661250.3, 1245062.1, 11349, 'Villmergen', 'AG',
     array['CH245015938092', 'CH409350791546', 'CH469315507992', 'CH487615509384', 'CH509350071534', 'CH515007159341', 'CH529307155006', 'CH580715509370', 'CH591593075019']::text[]),
    (13, 'hsl', 'Standweg 1-6, 4410 Liestal', 'CH807059231734', 2623223.3, 1258611.4, 4053, 'Liestal', 'BL',
     array['CH191779325946', 'CH367917596486', 'CH507159731756', 'CH752317705960', 'CH867017592306']::text[]),
    (14, 'hsl', 'Mattenweg 2/4, 4133 Pratteln', 'CH845917774796', 2620255.2, 1263554.4, 1146, 'Pratteln', 'BL',
     array['CH515941177883', 'CH707859121779', 'CH807859351773', 'CH831777594749', 'CH931778594706']::text[]),
    (15, 'hsl', 'Rankackerweg 12/14, 4133 Pratteln', 'CH853517785966', 2620329.1, 1263536.2, 1395, 'Pratteln', 'BL',
     array['CH515941177883', 'CH831777594749', 'CH867817593569', 'CH891778355902']::text[]),
    (16, 'hsl', 'Vorderbergweg 2-4/Reinacherst., 4106 Therwil', 'CH273978240753', 2609102.1, 1260843.7, 3268, 'Therwil', 'BL',
     array['CH267107397587', 'CH627038073958', 'CH990777433949']::text[]),
    (17, 'hsl', 'Birsigstrasse 80/82, Bachlettenstrasse 13/15, 4054 Basel', 'CH216740897853', 2610688.7, 1266580.6, 994, 'Basel', 'BS',
     array['CH246789784022', 'CH481989677947', 'CH927925896741']::text[]),
    (18, 'hsl', 'Hegenheimerstrasse 43 - 49, 4055 Basel', 'CH216707897958', 2610069.4, 1267733, 1330, 'Basel', 'BS',
     array['CH116746897833', 'CH838978675801', 'CH938978674379']::text[]),
    (19, 'hsl', 'Oberer Quai 106-116, 2503 Biel', 'CH213506461260', 2586062.3, 1221052.6, 3760, 'Biel/Bienne', 'BE',
     array['CH394614073573', 'CH501135424616', 'CH534612352943', 'CH773512204673']::text[]),
    (20, 'hsl', 'Bernstrasse 5, Wylerweg 1, 1a, 3, 3a, 7, 7a, 3324 Hindelbank', 'CH494689753533', 2607718, 1209946.2, 4478, 'Hindelbank', 'BE',
     array['CH194688553510', 'CH287146358561', 'CH313505468955', 'CH313565468405', 'CH408935754676', 'CH473584684662', 'CH608935794693', 'CH694688523543']::text[]),
    (21, 'hsl', 'Grauholzstrasse 65,67,69, 3063 Ittigen', 'CH228405463597', 2603081.7, 1203513, 3076, 'Ittigen', 'BE',
     array['CH380546358464', 'CH434684355087', 'CH582046359367', 'CH768146357287', 'CH768446355325', 'CH883246357646', 'CH885346358453', 'CH909835634687', 'CH994698633512']::text[]),
    (22, 'hsl', 'Birkenweg 16/18/22, 3250 Lyss', 'CH823419463550', 2589655.7, 1213883.8, 1262, 'Lyss', 'BE',
     array['CH103435364634']::text[]),
    (23, 'hsl', 'Lyss-Strasse 51 - 59, 2560 Nidau', 'CH157546113561', 2585533.8, 1219427.2, 4606, 'Nidau', 'BE',
     array['CH534610352070', 'CH543546185971', 'CH585646351843', 'CH594618563516']::text[]),
    (24, 'hsl', 'Ahornweg 12, 2542 Pieterlen', 'CH263446359251', 2592447, 1224598, 1760, 'Pieterlen', 'BE',
     array['CH413572463455', 'CH503435494653', 'CH634632358762', 'CH703535774668']::text[]),
    (25, 'hsl', 'Buchsweg 9/9a/11, 3052 Zollikofen', 'CH382546359397', 2601446.8, 1205027.8, 30365, 'Zollikofen', 'BE',
     array['CH173582334693', 'CH208235344668', 'CH283946358255', 'CH334682353557', 'CH353446823514', 'CH368246353440', 'CH407836626494', 'CH413533468267', 'CH413537468231', 'CH428237463586', 'CH452646823502', 'CH473582344685', 'CH483446358225', 'CH483646358268', 'CH494682343525', 'CH496478623672', 'CH534693351606', 'CH568046352337', 'CH568246353766', 'CH568246353865', 'CH613530468226', 'CH613536468269', 'CH673582374608', 'CH673582384605', 'CH683746358270', 'CH694682373545', 'CH768246353203', 'CH813537468289', 'CH834693354371', 'CH853946823597', 'CH908235344624', 'CH934682353745', 'CH973576304678', 'CH973582484667']::text[]),
    (26, 'hsl', 'Rue Georges-Jordil 1/3, 1700 Fribourg', 'CH638570017542', 2578239.3, 1183181.3, 1012, 'Fribourg', 'FR',
     array['CH188110947084', 'CH767010942890', 'CH857710929482']::text[]),
    (27, 'hsl', 'Nelkenstrasse 6/8, 6032 Emmen', 'CH273580215012', 2664431.4, 1215257.7, 2089, 'Emmen', 'LU',
     array['CH168050352142', 'CH282150358022', 'CH353750803597', 'CH473580225038', 'CH482250358024', 'CH528025503508', 'CH543550802280']::text[]),
    (28, 'hsl', 'Bahnhofstrasse 36/38/Zelgstrasse 35/37/39, 8222 Beringen', 'CH880708547141', 2684947.3, 1283363.7, 7483, 'Beringen', 'SH',
     array['CH127738085421', 'CH715430087783', 'CH807754310869', 'CH915461087232']::text[]),
    (29, 'hsl', 'Geiselfeldstrasse 11-17, Kriegstettenstrasse 38-46, 4563 Gerlafingen', 'CH733279067285', 2610639.5, 1224545.5, 7857, 'Gerlafingen', 'SO',
     array['CH207906313245', 'CH281832067764', 'CH756732780627', 'CH784232069801', 'CH793298420665', 'CH967732060519']::text[]),
    (30, 'hsl', 'Bündengasse 18/20/22, 2540 Grenchen', 'CH240632739706', 2596580, 1227269.4, 1693, 'Grenchen', 'SO',
     array['CH327349320635', 'CH809906883203', 'CH933273064402', 'CH959532730691']::text[]),
    (31, 'hsl', 'Viaduktstrasse 9/11, 2540 Grenchen', 'CH933273064402', 2596590, 1227239.4, 2391, 'Grenchen', 'SO',
     array['CH240632739706', 'CH327349320635', 'CH810688329950', 'CH840632732271', 'CH959532730691']::text[]),
    (32, 'hsl', 'Ziegelfeldstrasse 36, 4600 Olten', 'CH393282850622', 2634760.7, 1244677.9, 716, 'Olten', 'SO',
     array['CH368732066191', 'CH510661328719', 'CH733299069081']::text[]),
    (33, 'hsl', 'Winkelweg 16-20, 4553 Subingen', 'CH983532067845', 2612753.8, 1227405.5, 3644, 'Subingen', 'SO',
     array['CH233278063510', 'CH270699783283', 'CH386632069871', 'CH583032067726', 'CH956132980661']::text[]),
    (34, 'hsl', 'Thalisstrasse 2/4/6/8, 9469 Haag', 'CH246539777806', 2755685.5, 1231413.3, 6455, 'Sennwald', 'SG',
     array['CH146539777741', 'CH157739776536', 'CH207765783902', 'CH233977657895', 'CH257839776572', 'CH933977657752']::text[]),
    (35, 'hsl', 'Dürrenmattstrasse 38, 9000 St. Gallen', 'CH407759148735', 2744409.7, 1253613.6, 279, 'St. Gallen', 'SG',
     array['CH481487597732', 'CH498777145966', 'CH975977178701', 'CH981787597772']::text[]),
    (36, 'hsl', 'Hofjüngerstrasse 26-34, 9630 Wattwil', 'CH594077904520', 2724602.9, 1240803.4, 3214, 'Wattwil', 'SG',
     array['CH259640774582', 'CH274577994030', 'CH407745904077', 'CH907745774043', 'CH914577407730', 'CH994077774520']::text[]),
    (37, 'hsl', 'Hofjüngerstrasse 7, 9630 Wattwil', 'CH867740459367', 2724566.5, 1240602.6, 1157, 'Wattwil', 'SG',
     array['CH189140457772', 'CH259640774582', 'CH307745994084', 'CH327790404577', 'CH544540779233']::text[]),
    (38, 'hsl', 'Hofjüngerstrasse 9/11, 9630 Wattwil', 'CH544540779233', 2724567.5, 1240638.1, 1649, 'Wattwil', 'SG',
     array['CH259640774582', 'CH327790404577', 'CH727790404538', 'CH867740459367']::text[]),
    (39, 'hsl', 'Müller-Friedberg-Strasse 5, 9630 Wattwil', 'CH334077459379', 2724199.3, 1240787.8, 2272, 'Wattwil', 'SG',
     array['CH344540777224', 'CH844540779327', 'CH894077944503']::text[]),
    (40, 'hsl', 'Schomattenstrasse 41-45, 9630 Wattwil', 'CH844540779327', 2724210, 1240708.4, 4172, 'Wattwil', 'SG',
     array['CH159040774584', 'CH334077459379', 'CH344540777224', 'CH714594407742', 'CH894077794548']::text[]),
    (41, 'hsl', 'Schäfliplatz 1-3, 9315 Egnach', 'CH311089937739', 2745473.3, 1265944, 2882, 'Egnach', 'TG',
     array['CH127754262051', 'CH327789931059', 'CH339377108918', 'CH471077899311', 'CH832677205413']::text[]),
    (42, 'hsl', 'Kümmertshauserstrasse 7a-11b, 8586 Erlen', 'CH650486776358', 2734543.7, 1268505.3, 8914, 'Erlen', 'TG',
     array['CH416394867705', 'CH516353867749', 'CH567786635728', 'CH616354867706', 'CH616395867725', 'CH627704866311', 'CH638677630431', 'CH667786630447', 'CH827795866394', 'CH838677639566', 'CH846386779595', 'CH950486776353', 'CH967786630442']::text[]),
    (43, 'hsl', 'Bahnhofstrasse 16, Alleestrasse 25, 8590 Romanshorn', 'CH431177007016', 2745839.3, 1270105.5, 2409, 'Romanshorn', 'TG',
     array['CH288211007795', 'CH331177007050', 'CH340011777047', 'CH367711007074', 'CH407700701186', 'CH410070117713', 'CH427770110064', 'CH440011770479', 'CH440011777013', 'CH491177700069']::text[]),
    (44, 'hsl', 'Amriswilerstrasse 72, 8570 Weinfelden', 'CH557066770602', 2726479.7, 1269621, 2840, 'Weinfelden', 'TG',
     array['CH252766770604', 'CH340666779544', 'CH451266770650', 'CH567766067075', 'CH707706716666', 'CH810635667759']::text[]),
    (45, 'hsl', 'Crête Blanche 5a-b/ Av. Gare 2, 3977 Granges', 'CH543052303246', 2601922.2, 1123312.1, 3936, 'Sierre', 'VS',
     array['CH553252303010', 'CH613086521297', 'CH621286523096', 'CH659952133061', 'CH773016955238', 'CH943052270048']::text[]),
    (46, 'hsl', 'Chemin des Sémilles 13a/b, 1870 Monthey', 'CH120953523062', 2562595.8, 1121899.7, 3419, 'Monthey', 'VS',
     array['CH720882523012', 'CH735295303050', 'CH751252903011', 'CH773009555227', 'CH913019520226']::text[]),
    (47, 'hsl', 'Bodenacherstrasse 16/18, 8121 Benglen', 'CH907756853918', 2690431.9, 1246327.6, 1134, 'Fällanden', 'ZH',
     array['CH858539775676', 'CH893977855646', 'CH993977855612']::text[]),
    (48, 'hsl', 'Bodenacherstrasse 79, 8121 Benglen', 'CH545639778444', 2690713.4, 1246228.9, 2119, 'Fällanden', 'ZH',
     array['CH527771395675', 'CH527784395655', 'CH533977568414', 'CH558439775611', 'CH658439775674']::text[]),
    (49, 'hsl', 'Finsterrütistrasse 61, 63, 65, 67, 8135 Langnau am Albis', 'CH867789978065', 2682577.9, 1239241.5, 5047, 'Langnau am Albis', 'ZH',
     array['CH138977979920', 'CH149789779963', 'CH158389779771', 'CH819780897738', 'CH827780899789', 'CH907797808902', 'CH998977809791']::text[]),
    (50, 'hsl', 'Moosbrunnenstrasse 3/5/7/9, 8426 Lufingen', 'CH246235777727', 2687045, 1260544.2, 3637, 'Lufingen', 'ZH',
     array['CH287735627722', 'CH467735627026', 'CH507762783528', 'CH733577627941', 'CH746235777949', 'CH767735627516']::text[])
    ) as v(nr, gefaess, roh, egrid, e, n, flaeche, gemeinde, kanton, nachbarn)
    order by nr
  loop
    pid := case r.gefaess when 'hsl' then hsl else hl end;
    if exists (select 1 from public.portfolio_position x where x.portfolio_id = pid and x.roh_adresse = r.roh) then
      schon := schon + 1;
      continue;
    end if;
    select id into parz from public.properties where egrid = r.egrid limit 1;
    insert into public.portfolio_position
      (portfolio_id, parzelle_id, roh_adresse, zuordnung, egrid, e, n, flaeche, gemeinde, kanton, nachbar_egrids)
    values
      (pid, parz, r.roh, case when parz is null then 'nicht gefunden' else 'zugeordnet' end,
       r.egrid, r.e, r.n, r.flaeche, r.gemeinde, r.kanton, r.nachbarn);
    if parz is not null then
      verknuepft := verknuepft + 1;
      insert into public.parzelle_punkt (parzelle_id, e, n, quelle) values (parz, r.e, r.n, 'bund')
      on conflict (parzelle_id) do nothing;
      -- Nachbarn, die im Bestand stehen, in beide Richtungen.
      insert into public.nachbarschaft (parzelle_id, nachbar_id)
      select parz, p.id from public.properties p where p.egrid = any (r.nachbarn) and p.id <> parz
      union all
      select p.id, parz from public.properties p where p.egrid = any (r.nachbarn) and p.id <> parz
      on conflict do nothing;
    end if;
    neu := neu + 1;
  end loop;

  raise notice 'Helvetica: % Liegenschaften neu (% davon im Bestand verknüpft), % standen schon',
    neu, verknuepft, schon;
end $$;
