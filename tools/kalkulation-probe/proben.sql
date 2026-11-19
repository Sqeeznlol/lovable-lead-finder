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
  begin perform public.kalkulation_schritt(kid, 'visieren', 'Tim'); ok := false; exception when others then ok := sqlerrm like 'Dieser Schritt passt nicht%'; end;
  assert ok, '4a visieren vor einreichen';
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

  -- 7 David prüft: Urteil, Grund, Firma, Vorlage, Schrift
  begin perform public.kalkulation_schritt(kid, 'visieren', 'Tim'); ok := false; exception when others then ok := true; end;
  assert ok, '7a visieren vor prüfen';
  begin perform public.kalkulation_schritt(kid, 'pruefen', 'David', -5); ok := false; exception when others then ok := sqlerrm = 'Der Betrag ist nicht gültig.'; end;
  assert ok, '7b Betrag unter null';
  begin perform public.kalkulation_schritt(kid, 'pruefen', 'David', 2000000, 'Dach ist neu und gut'); ok := false; exception when others then ok := sqlerrm like 'Bitte sagen, ob die Empfehlung%'; end;
  assert ok, '7c ohne Urteil';
  begin perform public.kalkulation_schritt(kid, 'pruefen', 'David', 2000000, 'zu', null, '{"urteil":"zu_hoch"}'); ok := false; exception when others then ok := sqlerrm like 'Bitte begründen%'; end;
  assert ok, '7d ohne Grund';
  begin perform public.kalkulation_schritt(kid, 'pruefen', 'David', 2500000, 'Altlasten im Kataster', null, '{"urteil":"zu_hoch"}'); ok := false; exception when others then ok := sqlerrm like 'Ist die Empfehlung zu hoch%'; end;
  assert ok, '7e zu hoch, aber Preis höher';
  begin perform public.kalkulation_schritt(kid, 'pruefen', 'David', 2000000, 'Altlasten im Kataster', null, '{"urteil":"zu_tief"}'); ok := false; exception when others then ok := sqlerrm like 'Ist die Empfehlung zu tief%'; end;
  assert ok, '7f zu tief, aber Preis tiefer';
  begin perform public.kalkulation_schritt(kid, 'pruefen', 'David', 2000000, 'Altlasten im Kataster', null, '{"urteil":"zu_hoch"}'); ok := false; exception when others then ok := sqlerrm = 'Bitte Firma, Vorlage und Schrift wählen.'; end;
  assert ok, '7g ohne Firma';
  begin perform public.kalkulation_schritt(kid, 'speichern', 'David', null, null, null, '{"firma":"keine"}'); ok := false; exception when check_violation then ok := true; end;
  assert ok, '7h unbekannte Firma';
  k := public.kalkulation_schritt(kid, 'speichern', 'David', null, null, null, '{"firma":"stimo","vorlage":"bauland","schrift":"nunito","angebot":{"bindung":90}}');
  n := jsonb_array_length(k.verlauf);
  assert n = 1, '7i Zwischenspeichern ist kein Schritt';
  k := public.kalkulation_schritt(kid, 'pruefen', 'David', 2000000, 'Altlasten im Kataster', null, '{"urteil":"zu_hoch"}');
  assert k.zustand = 'visum' and k.preis_chf = 2000000 and k.preis_urteil = 'zu_hoch' and k.preis_grund = 'Altlasten im Kataster'
     and k.firma = 'stimo' and k.vorlage = 'bauland' and k.angebot->>'bindung' = '90', '7j geprüft';
  assert (k.verlauf->1->>'chf')::numeric = 2000000 and k.verlauf->1->>'urteil' = 'zu_hoch', '7k Verlauf mit Urteil';
  begin perform public.kalkulation_schritt(kid, 'speichern', 'Tim', null, null, null, '{"firma":"studer"}'); ok := false; exception when others then ok := sqlerrm like 'Dieser Schritt passt nicht%'; end;
  assert ok, '7l Tim ändert die Firma nicht';

  -- 8 Tim visiert; zurück braucht einen Grund
  begin perform public.kalkulation_schritt(kid, 'zurueck', 'Tim'); ok := false; exception when others then ok := sqlerrm = 'Bitte sagen, was zu ändern ist.'; end;
  assert ok, '8a zurück ohne Grund';
  k := public.kalkulation_schritt(kid, 'zurueck', 'Tim', null, 'Firma Lebensraum');
  assert k.zustand = 'pruefung', '8b zurück zu David';
  k := public.kalkulation_schritt(kid, 'pruefen', 'David', 2160000, 'Empfehlung stimmt mit Inseraten', null, '{"urteil":"passt","firma":"lebensraum"}');
  assert k.zustand = 'visum' and k.preis_chf = 2160000 and k.firma = 'lebensraum' and k.preis_urteil = 'passt', '8c passt';
  begin perform public.kalkulation_schritt(kid, 'visieren', 'Tim', 2100000); ok := false; exception when others then ok := sqlerrm = 'Bitte sagen, warum der Preis ändert.'; end;
  assert ok, '8d Tim ändert ohne Grund';
  k := public.kalkulation_schritt(kid, 'visieren', 'Tim', 2100000, 'Luft für die Verhandlung');
  assert k.zustand = 'kontrolle' and k.preis_chf = 2100000, '8e visiert';

  -- 9 Julian kontrolliert, Tim bestätigt, David sendet
  begin perform public.kalkulation_schritt(kid, 'bestaetigen', 'Tim'); ok := false; exception when others then ok := sqlerrm like 'Dieser Schritt passt nicht%'; end;
  assert ok, '9a bestätigen vor der Kontrolle';
  k := public.kalkulation_schritt(kid, 'kontrollieren', 'Julian', null, null, null, '{"angebot":{"bindung":60}}');
  assert k.zustand = 'bestaetigung' and k.preis_chf = 2100000 and k.angebot->>'bindung' = '60', '9b kontrolliert, Text geändert';
  begin perform public.kalkulation_schritt(kid, 'senden', 'David'); ok := false; exception when others then ok := sqlerrm like 'Dieser Schritt passt nicht%'; end;
  assert ok, '9c senden vor Tims Bestätigung';
  k := public.kalkulation_schritt(kid, 'bestaetigen', 'Tim', null, null, null, '{"angebot":{"bindung":1}}');
  assert k.zustand = 'angebot' and k.angebot->>'bindung' = '60', '9d bestätigt, Tim ändert den Text nicht';
  n := jsonb_array_length(k.verlauf);
  k := public.kalkulation_schritt(kid, 'senden', 'David', null, null, 'Guten Tag');
  assert k.zustand = 'gesendet' and k.gesendet_am is not null and k.angebot_text = 'Guten Tag' and jsonb_array_length(k.verlauf) = n + 1, '9e gesendet';
  assert (select array_agg(v->>'schritt' order by o) from jsonb_array_elements(k.verlauf) with ordinality x(v, o))
       = array['einreichen','pruefen','zurueck','pruefen','visieren','kontrollieren','bestaetigen','senden'], '9f der ganze Weg im Verlauf';
  begin perform public.kalkulation_schritt(kid, 'senden', 'David'); ok := false; exception when others then ok := true; end;
  assert ok, '9g zweimal senden';

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
  perform public.kalkulation_schritt(kid, 'speichern', 'David', null, null, null, '{"firma":"studer","vorlage":"unverbindlich","schrift":"carlito"}');
  perform public.kalkulation_schritt(kid, 'pruefen', 'David', null, 'Vergleich mit Volketswil', null, '{"urteil":"passt"}');
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
  begin perform public.kalkulation_schritt(kid, 'visieren', 'Tim'); ok := false; exception when insufficient_privilege then ok := sqlerrm like 'Diesen Schritt tut%'; end;
  assert ok, '10h ein anderes Konto visiert nicht';
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
  k := public.kalkulation_schritt(kid, 'visieren', 'Tim');
  assert k.zustand = 'kontrolle' and k.preis_chf = 800000, '10i Tims Konto visiert';
  -- Julian hat kein Konto hinterlegt: dann zählt der Name.
  k := public.kalkulation_schritt(kid, 'kontrollieren', 'Julian');
  assert k.zustand = 'bestaetigung', '10j Kontrolle ohne Konto';
  set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
  begin perform public.kalkulation_schritt(kid, 'bestaetigen', 'Tim'); ok := false; exception when insufficient_privilege then ok := true; end;
  assert ok, '10k bestätigen nur mit Tims Konto';
  raise notice 'Rollen: alle Proben bestanden';
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
