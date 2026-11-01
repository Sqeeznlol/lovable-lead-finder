// Schreibt aus daten/demo-szenarien.json die Migration mit den
// Demo-Fällen der Zentrale. Eine Quelle für Datenbank und
// Darstellungstest -- sonst zeigt der Test andere Fälle als die Seite.
//
// Aufruf: node tools/demo_szenarien.mjs > supabase/migrations/<datei>.sql
import { readFileSync } from 'node:fs';

const { faelle } = JSON.parse(readFileSync(new URL('../daten/demo-szenarien.json', import.meta.url), 'utf8'));
const q = s => s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`;
const arr = a => a && a.length ? `array[${a.map(q).join(', ')}]::text[]` : 'null';

let sql = `-- =====================================================================
-- Demo-Szenarien der Zentrale (${faelle.length} Kundenfälle)
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

`;

for (const f of faelle) {
  sql += `select pg_temp.demo_fall(${[
    q(f.kunde), q(f.kunde_art), q(f.art), q(f.titel), q(f.zustand), f.monate ?? 0,
    arr(f.gemeinden), f.anzahl ?? 0, f.offen ?? 0, f.vollmacht ? 'true' : 'false',
    arr(f.lagen), arr(f.objekttypen), q(f.beschreibung), arr(f.verlauf),
  ].join(', ')});\n`;
}

sql += `
do $$
declare n int; a int;
begin
  select count(*), coalesce(sum(adressen), 0) into n, a from public.vorhaben_liste where kunde like '%(Demo)';
  raise notice 'Demo-Szenarien: % Vorhaben, % Adressen', n, a;
end $$;
`;
process.stdout.write(sql);
