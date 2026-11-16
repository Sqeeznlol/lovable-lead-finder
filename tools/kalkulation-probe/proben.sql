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

  -- 3 einreichen verlangt Namen und Empfehlung
  begin perform public.kalkulation_schritt(kid, 'einreichen', '  '); ok := false; exception when others then ok := sqlerrm = 'Bitte den Namen angeben.'; end;
  assert ok, '3a ohne Namen';
  begin perform public.kalkulation_schritt(kid, 'einreichen', 'Lele'); ok := false; exception when others then ok := sqlerrm like 'Ohne Kaufpreisempfehlung%'; end;
  assert ok, '3b ohne Empfehlung';
  update public.kalkulation set empfehlung_chf = 2160000, eingaben = '{"a":1}' where id = kid;
  get diagnostics n = row_count; assert n = 1, '3c Entwurf ändern';

  -- 4 nichts überspringen
  begin perform public.kalkulation_schritt(kid, 'freigeben', 'Tim'); ok := false; exception when others then ok := sqlerrm like 'Dieser Schritt passt nicht%'; end;
  assert ok, '4a freigeben vor einreichen';
  begin perform public.kalkulation_schritt(kid, 'senden', 'Julian', null, null, 'Text'); ok := false; exception when others then ok := sqlerrm like 'Dieser Schritt passt nicht%'; end;
  assert ok, '4b senden vor einreichen';

  -- 5 einreichen: die Uhr startet, 24 Stunden
  k := public.kalkulation_schritt(kid, 'einreichen', ' Lele ');
  assert k.zustand = 'pruefung' and k.frist_am - k.eingereicht_am = interval '24 hours', '5 Uhr';
  assert jsonb_array_length(k.verlauf) = 1 and k.verlauf->0->>'name' = 'Lele' and k.verlauf->0->>'schritt' = 'einreichen', '5 Verlauf';

  -- 6 was eingereicht ist, bleibt
  update public.kalkulation set adresse = 'TEST geändert', empfehlung_chf = 1 where id = kid;
  get diagnostics n = row_count; assert n = 0, '6a eingereicht ändern';
  delete from public.kalkulation where id = kid;
  get diagnostics n = row_count; assert n = 0, '6b eingereicht löschen';

  -- 7 prüfen: bestätigen oder ändern
  begin perform public.kalkulation_schritt(kid, 'freigeben', 'Tim'); ok := false; exception when others then ok := true; end;
  assert ok, '7a freigeben vor prüfen';
  begin perform public.kalkulation_schritt(kid, 'pruefen', 'David', -5); ok := false; exception when others then ok := sqlerrm = 'Der Betrag ist nicht gültig.'; end;
  assert ok, '7b Betrag unter null';
  k := public.kalkulation_schritt(kid, 'pruefen', 'David', 2000000, 'Dach ist neu');
  assert k.zustand = 'freigabe' and k.preis_chf = 2000000 and (k.verlauf->1->>'chf')::numeric = 2000000 and k.verlauf->1->>'notiz' = 'Dach ist neu', '7c geändert';

  -- 8 zurück braucht einen Grund
  begin perform public.kalkulation_schritt(kid, 'zurueck', 'Tim'); ok := false; exception when others then ok := sqlerrm = 'Bitte sagen, was zu ändern ist.'; end;
  assert ok, '8a zurück ohne Grund';
  k := public.kalkulation_schritt(kid, 'zurueck', 'Tim', null, 'zu hoch');
  assert k.zustand = 'pruefung', '8b zurück';
  k := public.kalkulation_schritt(kid, 'pruefen', 'David');
  assert k.zustand = 'freigabe' and k.preis_chf = 2160000, '8c bestätigt die Empfehlung';

  -- 9 Freigabe, Angebot, Versand
  k := public.kalkulation_schritt(kid, 'freigeben', 'Tim');
  assert k.zustand = 'angebot' and k.preis_chf = 2160000 and k.gesendet_am is null, '9a freigegeben';
  begin perform public.kalkulation_schritt(kid, 'senden', 'Julian'); ok := false; exception when others then ok := sqlerrm = 'Das Angebot ist noch leer.'; end;
  assert ok, '9b leeres Angebot';
  n := jsonb_array_length(k.verlauf);
  k := public.kalkulation_schritt(kid, 'angebot', 'Julian', null, null, 'Guten Tag');
  assert k.angebot_text = 'Guten Tag' and jsonb_array_length(k.verlauf) = n and k.zustand = 'angebot', '9c Zwischenspeichern ist kein Schritt';
  k := public.kalkulation_schritt(kid, 'senden', 'Julian');
  assert k.zustand = 'gesendet' and k.gesendet_am is not null and k.angebot_text = 'Guten Tag' and jsonb_array_length(k.verlauf) = n + 1, '9d gesendet';
  begin perform public.kalkulation_schritt(kid, 'senden', 'Julian'); ok := false; exception when others then ok := true; end;
  assert ok, '9e zweimal senden';

  -- 10 ablehnen und wieder öffnen
  insert into public.kalkulation (adresse, empfehlung_chf) values ('TEST Teststrasse 2', 500000) returning id into kid;
  perform public.kalkulation_schritt(kid, 'einreichen', 'Lele');
  begin perform public.kalkulation_schritt(kid, 'ablehnen', 'David'); ok := false; exception when others then ok := sqlerrm = 'Bitte den Grund angeben.'; end;
  assert ok, '10a ablehnen ohne Grund';
  k := public.kalkulation_schritt(kid, 'ablehnen', 'David', null, 'Denkmal');
  assert k.zustand = 'abgelehnt', '10b abgelehnt';
  k := public.kalkulation_schritt(kid, 'oeffnen', 'Lele');
  assert k.zustand = 'entwurf' and k.frist_am is null and k.eingereicht_am is null and jsonb_array_length(k.verlauf) = 3, '10c wieder offen';
  delete from public.kalkulation where id = kid;
  get diagnostics n = row_count; assert n = 1, '10d Entwurf löschen';
  raise notice 'Angemeldet: alle Proben bestanden';
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
  raise notice 'Ohne Anmeldung: alle Proben bestanden';
end $$;
