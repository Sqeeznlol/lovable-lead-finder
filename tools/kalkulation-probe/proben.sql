\set ON_ERROR_STOP 1
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
create temp table merk (id uuid);
grant all on merk to public;

do $$
declare k public.kalkulation; kid uuid; n int; ok boolean;
  procedure_name text;
begin
  -- 1 anlegen: nur die erlaubten Spalten, der Rest aus den Vorgaben
  insert into public.kalkulation (adresse, kanton, eingaben, ergebnis) values ('TEST Teststrasse 1', 'ZH', '{}', '{}') returning * into k;
  kid := k.id; insert into merk values (kid);
  assert k.zustand = 'entwurf' and k.verlauf = '[]'::jsonb and k.erstellt_von = '00000000-0000-0000-0000-000000000001', '1 Vorgaben';

  -- 2 der Ablauf lässt sich weder beim Anlegen noch später von aussen schreiben
  begin insert into public.kalkulation (adresse, zustand) values ('TEST x y z', 'gesendet'); ok := false; exception when insufficient_privilege then ok := true; end;
  assert ok, '2a zustand beim Anlegen';
  begin update public.kalkulation set zustand = 'gesendet' where id = kid; ok := false; exception when insufficient_privilege then ok := true; end;
  assert ok, '2b zustand ändern';
  begin update public.kalkulation set verlauf = '[{"schritt":"freigeben"}]' where id = kid; ok := false; exception when insufficient_privilege then ok := true; end;
  assert ok, '2c verlauf ändern';
  begin update public.kalkulation set preis_chf = 1, frist_am = now() + interval '9 days' where id = kid; ok := false; exception when insufficient_privilege then ok := true; end;
  assert ok, '2d preis und frist ändern';

  -- 3 einreichen verlangt Namen, Empfehlung und einen Empfänger
  begin perform public.kalkulation_schritt(kid, 'einreichen', '  '); ok := false; exception when others then ok := sqlerrm = 'Bitte den Namen angeben.'; end;
  assert ok, '3a ohne Namen';
  begin perform public.kalkulation_schritt(kid, 'einreichen', 'Lele'); ok := false; exception when others then ok := sqlerrm like 'Ohne Kaufpreisempfehlung%'; end;
  assert ok, '3b ohne Empfehlung';
  update public.kalkulation set empfehlung_chf = 2160000, eingaben = '{"a":1}', quelle = 'mail',
    parzellen = '[{"nummer":"SE6956","flaeche":2112}]', personen = '[{"name":"TEST Muster","empfaenger":false}]' where id = kid;
  get diagnostics n = row_count; assert n = 1, '3c Entwurf ändern';
  begin perform public.kalkulation_schritt(kid, 'einreichen', 'Lele'); ok := false; exception when others then ok := sqlerrm = 'Bitte wählen, an wen das Angebot geht.'; end;
  assert ok, '3d ohne Empfänger';
  update public.kalkulation set personen = '[{"name":"TEST Muster","empfaenger":true}]' where id = kid;
  begin update public.kalkulation set firma = 'stimo' where id = kid; ok := false; exception when insufficient_privilege then ok := true; end;
  assert ok, '3e Firma wählt David, nicht der Agent';
  begin update public.kalkulation set preis_urteil = 'passt' where id = kid; ok := false; exception when insufficient_privilege then ok := true; end;
  assert ok, '3f Urteil nur über den Ablauf';

  -- 4 nichts überspringen
  begin perform public.kalkulation_schritt(kid, 'pruefen', 'Tim', 1, 'Altlasten im Kataster', null, '{"urteil":"zu_hoch"}'); ok := false; exception when others then ok := sqlerrm like 'Dieser Schritt passt nicht%'; end;
  assert ok, '4a Preis festlegen vor einreichen';
  begin perform public.kalkulation_schritt(kid, 'senden', 'David', null, null, 'Text'); ok := false; exception when others then ok := sqlerrm like 'Dieser Schritt passt nicht%'; end;
  assert ok, '4b senden vor einreichen';

  -- 5 einreichen: die Uhr startet, 24 Stunden
  k := public.kalkulation_schritt(kid, 'einreichen', ' Lele ');
  assert k.zustand = 'pruefung' and k.frist_am - k.eingereicht_am = interval '24 hours', '5 Uhr';
  assert jsonb_array_length(k.verlauf) = 1 and k.verlauf->0->>'name' = 'Lele' and k.verlauf->0->>'schritt' = 'einreichen', '5 Verlauf';

  -- 6 was eingereicht ist, bleibt
  update public.kalkulation set adresse = 'TEST geändert', empfehlung_chf = 1, personen = '[]' where id = kid;
  get diagnostics n = row_count; assert n = 0, '6a eingereicht ändern';
  delete from public.kalkulation where id = kid;
  get diagnostics n = row_count; assert n = 0, '6b eingereicht löschen';

  -- 7 Tim legt den Preis fest (22. November: «Tim entscheidet immer schlussendlich»)
  begin perform public.kalkulation_schritt(kid, 'senden', 'Tim', null, null, 'Text'); ok := false; exception when others then ok := sqlerrm like 'Dieser Schritt passt nicht%'; end;
  assert ok, '7a senden vor dem Preis';
  begin perform public.kalkulation_schritt(kid, 'pruefen', 'Tim', -5); ok := false; exception when others then ok := sqlerrm = 'Der Betrag ist nicht gültig.'; end;
  assert ok, '7b Betrag unter null';
  begin perform public.kalkulation_schritt(kid, 'pruefen', 'Tim', 2000000, 'Dach ist neu und gut'); ok := false; exception when others then ok := sqlerrm like 'Bitte sagen, ob die Empfehlung%'; end;
  assert ok, '7c ohne Urteil';
  begin perform public.kalkulation_schritt(kid, 'pruefen', 'Tim', 2000000, 'zu', null, '{"urteil":"zu_hoch"}'); ok := false; exception when others then ok := sqlerrm like 'Bitte begründen%'; end;
  assert ok, '7d ohne Grund';
  begin perform public.kalkulation_schritt(kid, 'pruefen', 'Tim', 2500000, 'Altlasten im Kataster', null, '{"urteil":"zu_hoch"}'); ok := false; exception when others then ok := sqlerrm like 'Ist die Empfehlung zu hoch%'; end;
  assert ok, '7e zu hoch, aber Preis höher';
  begin perform public.kalkulation_schritt(kid, 'pruefen', 'Tim', 2000000, 'Altlasten im Kataster', null, '{"urteil":"zu_tief"}'); ok := false; exception when others then ok := sqlerrm like 'Ist die Empfehlung zu tief%'; end;
  assert ok, '7f zu tief, aber Preis tiefer';
  begin perform public.kalkulation_schritt(kid, 'pruefen', 'Tim', 2000000, 'Altlasten im Kataster', null, '{"urteil":"zu_hoch"}'); ok := false; exception when others then ok := sqlerrm = 'Bitte Firma und Vorlage wählen.'; end;
  assert ok, '7g ohne Firma';
  begin perform public.kalkulation_schritt(kid, 'speichern', 'Tim', null, null, null, '{"firma":"keine"}'); ok := false; exception when check_violation then ok := true; end;
  assert ok, '7h unbekannte Firma';
  k := public.kalkulation_schritt(kid, 'speichern', 'Tim', null, null, null, '{"firma":"studer","vorlage":"bauland","schrift":"serif","angebot":{"bindung":90}}');
  n := jsonb_array_length(k.verlauf);
  assert n = 1, '7i Zwischenspeichern ist kein Schritt';
  k := public.kalkulation_schritt(kid, 'pruefen', 'Tim', 2000000, 'Altlasten im Kataster', null, '{"urteil":"zu_hoch"}');
  assert k.zustand = 'angebot' and k.preis_chf = 2000000 and k.preis_urteil = 'zu_hoch' and k.preis_grund = 'Altlasten im Kataster'
     and k.firma = 'studer' and k.vorlage = 'bauland' and k.angebot->>'bindung' = '90', '7j Tims Preis gilt, gleich zum Versand';
  assert k.schrift = 'carlito', '7k die Schrift gehört zur Firma, gewählt wird sie nicht';
  assert (k.verlauf->1->>'chf')::numeric = 2000000 and k.verlauf->1->>'urteil' = 'zu_hoch', '7l Verlauf mit Urteil';

  -- 8 zurück braucht einen Grund; Tim legt neu fest
  begin perform public.kalkulation_schritt(kid, 'zurueck', 'Tim'); ok := false; exception when others then ok := sqlerrm = 'Bitte sagen, was zu ändern ist.'; end;
  assert ok, '8a zurück ohne Grund';
  k := public.kalkulation_schritt(kid, 'zurueck', 'Tim', null, 'Firma stimo');
  assert k.zustand = 'pruefung', '8b zurück zum Preis';
  k := public.kalkulation_schritt(kid, 'pruefen', 'Tim', 2160000, 'Empfehlung stimmt mit Inseraten', null, '{"urteil":"passt","firma":"stimo"}');
  assert k.zustand = 'angebot' and k.preis_chf = 2160000 and k.firma = 'stimo' and k.schrift = 'nunito' and k.preis_urteil = 'passt', '8c passt';

  -- 9 Tim verschickt
  k := public.kalkulation_schritt(kid, 'speichern', 'Tim', null, null, null, '{"angebot":{"bindung":60}}');
  assert k.zustand = 'angebot' and k.angebot->>'bindung' = '60', '9a vor dem Versand noch ändern';
  n := jsonb_array_length(k.verlauf);
  k := public.kalkulation_schritt(kid, 'senden', 'Tim', null, null, 'Guten Tag');
  assert k.zustand = 'gesendet' and k.gesendet_am is not null and k.angebot_text = 'Guten Tag' and jsonb_array_length(k.verlauf) = n + 1, '9b gesendet';
  assert (select array_agg(v->>'schritt' order by o) from jsonb_array_elements(k.verlauf) with ordinality x(v, o))
       = array['einreichen','pruefen','zurueck','pruefen','senden'], '9c der ganze Weg im Verlauf';
  begin perform public.kalkulation_schritt(kid, 'senden', 'Tim'); ok := false; exception when others then ok := true; end;
  assert ok, '9d zweimal senden';

  -- 10 ablehnen und wieder öffnen
  insert into public.kalkulation (adresse, empfehlung_chf, personen) values ('TEST Teststrasse 2', 500000, '[{"name":"TEST","empfaenger":true}]') returning id into kid;
  perform public.kalkulation_schritt(kid, 'einreichen', 'Lele');
  begin perform public.kalkulation_schritt(kid, 'ablehnen', 'David'); ok := false; exception when others then ok := sqlerrm = 'Bitte den Grund angeben.'; end;
  assert ok, '10a ablehnen ohne Grund';
  k := public.kalkulation_schritt(kid, 'ablehnen', 'David', null, 'Denkmal');
  assert k.zustand = 'abgelehnt', '10b abgelehnt';
  k := public.kalkulation_schritt(kid, 'oeffnen', 'Lele');
  assert k.zustand = 'entwurf' and k.frist_am is null and k.eingereicht_am is null and jsonb_array_length(k.verlauf) = 3, '10c wieder offen';
  delete from public.kalkulation where id = kid;
  get diagnostics n = row_count; assert n = 1, '10d Entwurf löschen';

  -- 10e eine für Tim, die in der nächsten Gruppe liegen bleibt
  insert into public.kalkulation (adresse, empfehlung_chf, personen) values ('TEST Teststrasse 3', 800000, '[{"name":"TEST","empfaenger":true}]') returning id into kid;
  perform public.kalkulation_schritt(kid, 'einreichen', 'Lele');
  perform public.kalkulation_schritt(kid, 'speichern', 'Tim', null, null, null, '{"firma":"studer","vorlage":"unverbindlich"}');
  insert into merk values (kid);
  raise notice 'Angemeldet: alle Proben bestanden';
end $$;

-- 10f Rollen: wer im Ablauf welche Rolle hat, legt nur ein Admin fest; mit Konto tut nur dieses Konto den Schritt
do $$
declare k public.kalkulation; kid uuid := (select id from public.kalkulation where adresse = 'TEST Teststrasse 3'); ok boolean;
begin
  begin insert into public.angebot_person (name, rollen) values ('TEST Tim', '{visum}'); ok := false; exception when insufficient_privilege then ok := true; end;
  assert ok, '10f ohne Admin keine Rollen';
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
  insert into public.angebot_person (name, rollen, firma, user_id) values ('TEST Tim', '{visum,unterschrift}', 'stimo', '00000000-0000-0000-0000-000000000004');
  begin insert into public.angebot_person (name, rollen) values ('TEST x', '{chef}'); ok := false; exception when check_violation then ok := true; end;
  assert ok, '10g unbekannte Rolle';
  begin perform public.kalkulation_schritt(kid, 'pruefen', 'Tim', null, 'Vergleich mit Volketswil', null, '{"urteil":"passt"}'); ok := false; exception when insufficient_privilege then ok := sqlerrm like 'Diesen Schritt tut%'; end;
  assert ok, '10h ein anderes Konto legt den Preis nicht fest';
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
  k := public.kalkulation_schritt(kid, 'pruefen', 'Tim', null, 'Vergleich mit Volketswil', null, '{"urteil":"passt"}');
  assert k.zustand = 'angebot' and k.preis_chf = 800000, '10i Tims Konto legt den Preis fest';
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
  begin perform public.kalkulation_schritt(kid, 'senden', 'Tim', null, null, 'x'); ok := false; exception when insufficient_privilege then ok := true; end;
  assert ok, '10j verschicken nur mit Tims Konto';
  raise notice 'Rollen: alle Proben bestanden';
end $$;

-- 13 Bemerkungen zum Preis (20. November): jeder darf, gemessen wird gegen die Empfehlung der Datenbank
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$
declare kid uuid; b public.kalkulation_bemerkung; ok boolean; n int;
begin
  insert into public.kalkulation (adresse, kanton, test, eingaben, ergebnis, empfehlung_chf) values ('TEST Bemerkung 1', 'ZH', true, '{}', '{}', 1410000) returning id into kid;
  insert into public.kalkulation_bemerkung (kalkulation_id, name, urteil, preis_chf, text) values (kid, 'TEST', 'zu_tief', 4100000, 'Fläche mehr wert als die Miete') returning * into b;
  assert b.empfehlung_chf = 1410000 and b.kanton = 'ZH' and b.test and b.user_id = '00000000-0000-0000-0000-000000000001', '13a vorbelegt aus der Kalkulation';
  insert into public.kalkulation_bemerkung (kalkulation_id, name, urteil, preis_chf, text) values (kid, 'TEST', 'passt', 99, 'stimmt') returning * into b;
  assert b.preis_chf = 1410000, '13b richtig so heisst: Preis = Empfehlung';
  begin insert into public.kalkulation_bemerkung (kalkulation_id, name, urteil, preis_chf, text) values (kid, 'TEST', 'zu_tief', 1000000, 'x'); ok := false; exception when others then ok := sqlerrm like 'Zu tief heisst%'; end;
  assert ok, '13c zu tief mit tieferem Preis';
  begin insert into public.kalkulation_bemerkung (kalkulation_id, name, text, empfehlung_chf) values (kid, 'TEST', 'x', 1); ok := false; exception when insufficient_privilege then ok := true; end;
  assert ok, '13d Empfehlung von aussen';
  begin update public.kalkulation_bemerkung set text = 'anders' where kalkulation_id = kid; ok := false; exception when insufficient_privilege then ok := true; end;
  assert ok, '13e ändern';
  -- Ein anderes Konto liest mit, nimmt aber nicht zurück, was es nicht geschrieben hat.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
  select count(*) into n from public.kalkulation_bemerkung where kalkulation_id = kid; assert n = 2, '13f andere lesen mit';
  delete from public.kalkulation_bemerkung where kalkulation_id = kid;
  select count(*) into n from public.kalkulation_bemerkung where kalkulation_id = kid; assert n = 2, '13g fremde zurücknehmen';
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
  delete from public.kalkulation_bemerkung where kalkulation_id = kid and urteil = 'passt';
  select count(*) into n from public.kalkulation_bemerkung where kalkulation_id = kid; assert n = 1, '13h eigene zurücknehmen';
  raise notice 'Bemerkungen: alle Proben bestanden';
end $$;

-- 11 eine Fondsleitung sieht und schreibt nichts
set request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$
declare n int; ok boolean;
begin
  select count(*) into n from public.kalkulation; assert n = 0, '11a Fondsleitung liest';
  begin insert into public.kalkulation (adresse) values ('TEST Fonds 1'); ok := false; exception when insufficient_privilege then ok := true; end;
  assert ok, '11b Fondsleitung legt an';
  begin perform public.kalkulation_schritt((select id from merk limit 1), 'oeffnen', 'Fonds'); ok := false; exception when insufficient_privilege then ok := sqlerrm = 'Kein Zugriff.'; end;
  assert ok, '11c Fondsleitung im Ablauf';
  raise notice 'Fondsleitung: alle Proben bestanden';
end $$;

-- 12 ohne Anmeldung gar nichts
reset role; set role anon; set request.jwt.claim.sub = '';
do $$
declare ok boolean;
begin
  begin perform 1 from public.kalkulation; ok := false; exception when insufficient_privilege then ok := true; end;
  assert ok, '12a anon liest';
  begin perform public.kalkulation_schritt(gen_random_uuid(), 'einreichen', 'x'); ok := false; exception when insufficient_privilege then ok := true; end;
  assert ok, '12b anon im Ablauf';
  begin perform 1 from public.kalkulation_bemerkung; ok := false; exception when insufficient_privilege then ok := true; end;
  assert ok, '12c anon liest Bemerkungen';
  raise notice 'Ohne Anmeldung: alle Proben bestanden';
end $$;
