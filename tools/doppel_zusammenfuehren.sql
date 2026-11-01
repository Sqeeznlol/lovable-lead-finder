-- Doppel einarbeiten und löschen -- je Stück aufgerufen, nach
-- tools/doppel_vorbereiten.sql in derselben Sitzung (braucht paar,
-- spalte, verweis und pg_temp.widerspruch_sql()).
create or replace function pg_temp.zusammenfuehren(p_stueck int) returns text language plpgsql as $f$
declare
  setz text; widerspruch text; r int; maxrang int; v record; z record;
  n_umgehaengt bigint := 0; n_ersetzt bigint := 0; n_weg bigint;
begin
  -- Was K fehlt, kommt von D. Leere Zeichenketten zählen als leer.
  select string_agg(format('%1$I = case when k.%1$I is null or k.%1$I::text = %2$L then d.%1$I else k.%1$I end', name, ''), ', ')
    into setz from spalte where art = 'fach';
  widerspruch := pg_temp.widerspruch_sql();

  select max(rang) into maxrang from paar where stueck = p_stueck;
  for r in 1 .. coalesce(maxrang, 0) loop
    execute format($u$
      update public.properties k set %s,
        -- K ohne Adresse ("Parzelle 12") nimmt die Adresse des Doppels.
        address = case when k.address like 'Parzelle %%' and nullif(d.address, '') is not null then d.address else k.address end,
        -- Im Doppel steht oft die Ortschaft (Nänikon) statt der Gemeinde (Uster).
        ortschaftsname = coalesce(nullif(k.ortschaftsname, ''),
                                  case when d.gemeinde is distinct from k.gemeinde then nullif(d.gemeinde, '') end),
        -- Nichts geht verloren: abweichende Notiz und widersprechende
        -- Werte des Doppels stehen danach in Ks Notiz.
        notes = nullif(concat_ws(' | ',
                  nullif(k.notes, ''),
                  case when nullif(d.notes, '') is not null and d.notes is distinct from k.notes then d.notes end,
                  nullif('Aus Doppel übernommen: ' || nullif(%s, ''), 'Aus Doppel übernommen: ')), '')
      from paar p join public.properties d on d.id = p.did
      where k.id = p.kid and p.stueck = %s and p.rang = %s$u$, setz, widerspruch, p_stueck, r);
  end loop;

  -- Verweise umhängen. Hat K dieselbe Verknüpfung schon (eindeutiger
  -- Schlüssel), ist die des Doppels überzählig und fällt weg.
  for v in select * from verweis loop
    begin
      execute format('update %s t set %I = p.kid from paar p where t.%I = p.did and p.stueck = %s',
                     v.tabelle, v.spalte, v.spalte, p_stueck);
      get diagnostics n_weg = row_count;
      n_umgehaengt := n_umgehaengt + n_weg;
    exception when unique_violation then
      for z in execute format('select t.ctid as zeile, p.kid from %s t join paar p on p.did = t.%I where p.stueck = %s',
                              v.tabelle, v.spalte, p_stueck) loop
        begin
          execute format('update %s set %I = $1 where ctid = $2', v.tabelle, v.spalte) using z.kid, z.zeile;
          n_umgehaengt := n_umgehaengt + 1;
        exception when unique_violation then
          execute format('delete from %s where ctid = $1', v.tabelle) using z.zeile;
          n_ersetzt := n_ersetzt + 1;
        end;
      end loop;
    end;
  end loop;

  delete from public.properties where id in (select did from paar where stueck = p_stueck);
  get diagnostics n_weg = row_count;
  return format('%s Doppel eingearbeitet und gelöscht, %s Verweise umgehängt, %s schon vorhanden', n_weg, n_umgehaengt, n_ersetzt);
end $f$;
