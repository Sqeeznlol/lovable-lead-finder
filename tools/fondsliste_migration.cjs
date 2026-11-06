/**
 * Aus dem Ergebnis von tools/fondsliste_aufloesen.cjs die Migration
 * bauen, die eine Fondsleitung mit ihren Gefässen und Liegenschaften
 * anlegt -- so entstand 20261106110000_fondsleitung_helvetica.sql.
 *
 *   node tools/fondsliste_migration.cjs <ergebnis.json> <migration.sql>
 *
 * Gefässe, Fondsleitung und Namen stehen unten in GEFAESS und im SQL;
 * für den nächsten Kunden anpassen. Die Migration läuft mehrfach ohne
 * Doppel und verknüpft Parzellen im Bestand (Zürich, Thurgau) über die
 * EGRID; die übrigen tragen ihre Lage selbst (20261106100000_position_lage.sql).
 */
const fs = require('fs');
const [, , quelle, ziel] = process.argv;
if (!quelle || !ziel) { console.error('Aufruf: node tools/fondsliste_migration.cjs <ergebnis.json> <migration.sql>'); process.exit(1); }
const erg = JSON.parse(fs.readFileSync(quelle, 'utf8'));

const q = s => `'${String(s).replace(/'/g, "''")}'`;
const GEFAESS = { 'Helvetica Swiss Living Fund (HSL)': 'hsl', 'HL Anlagestiftung – Nachhaltiges Suburbanes Wohnen Schweiz': 'hl' };
const zeilen = [];
const probleme = [];
for (const r of erg) {
  const kurz = GEFAESS[r.gefaess];
  if (!kurz) probleme.push(`${r.nr}: unbekanntes Gefäss ${r.gefaess}`);
  const haupt = r.parzellen.find(p => p.egrid === r.haupt);
  if (!haupt) { probleme.push(`${r.nr}: keine Hauptparzelle`); continue; }
  const eigene = new Set(r.parzellen.map(p => p.egrid));
  const nachbarn = [...new Set(r.parzellen.flatMap(p => p.nachbarn))].filter(x => !eigene.has(x)).sort();
  // "Rickenbach (LU)" -> "Rickenbach": der Kanton steht in der eigenen Spalte.
  const gemeinde = (r.gemeinde ?? '').split(' / ')[0].replace(/ \((LU|SG|VS|BE|ZH|TG|AG|SO|BL|BS|FR|SH|GL|GR|JU|NE|NW|OW|SZ|TI|UR|VD|ZG|AI|AR|GE)\)$/, '') || null;
  const kanton = (r.kantonBund ?? '').split('/')[0] || null;
  zeilen.push({ nr: r.nr, kurz, roh: `${r.feld}, ${r.plz} ${r.ort}`, egrid: haupt.egrid, e: haupt.e, n: haupt.n,
    flaeche: r.flaeche, gemeinde, kanton, nachbarn, gebaeude: r.gebaeude.length, parzellen: r.parzellen.length, wohnungen: r.wohnungen });
}
if (probleme.length) { console.error(probleme.join('\n')); process.exit(1); }

const werte = zeilen.map(z => `    (${z.nr}, ${q(z.kurz)}, ${q(z.roh)}, ${q(z.egrid)}, ${z.e}, ${z.n}, ${z.flaeche ?? 'null'}, ${z.gemeinde ? q(z.gemeinde) : 'null'}, ${z.kanton ? q(z.kanton) : 'null'},\n     array[${z.nachbarn.map(q).join(', ')}]::text[])`).join(',\n');

const kantone = [...new Set(zeilen.map(z => z.kanton))].sort();
const sql = `-- =====================================================================
-- Wohntraums: die erste Fondsleitung -- Helvetica, zwei Gefässe, ${zeilen.length} Liegenschaften
-- =====================================================================
-- Julian, 6. November: "Das ist die erste komplette Liste für einen Fonds
-- Manager ... Das ist unser erster Fondsmanager, unser erster Kunde."
-- Keine Testdaten. Die Liste (Asset_Liste_HSL_HL.xlsx) nennt je Zeile
-- Gefäss, Strasse/Nr., PLZ, Ort und Kanton; die Gefässe heissen wie in
-- der Spalte: "Helvetica Swiss Living Fund (HSL)" (${zeilen.filter(z => z.kurz === 'hsl').length} Liegenschaften)
-- und "HL Anlagestiftung – Nachhaltiges Suburbanes Wohnen Schweiz" (${zeilen.filter(z => z.kurz === 'hl').length}).
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
-- Kantone: ${kantone.join(', ')}. Im Bestand (Zürich, Thurgau) wird die
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
${werte}
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
`;
fs.writeFileSync(ziel, sql);
console.log(`${zeilen.length} Zeilen, ${zeilen.filter(z => z.kurz === 'hsl').length} HSL, ${zeilen.filter(z => z.kurz === 'hl').length} HL, Kantone ${kantone.join(' ')}`);
console.log('Fläche gesamt', zeilen.reduce((s, z) => s + (z.flaeche ?? 0), 0), 'm², Wohnungen', zeilen.reduce((s, z) => s + (z.wohnungen ?? 0), 0), 'Gebäude', zeilen.reduce((s, z) => s + z.gebaeude, 0), 'Parzellen', zeilen.reduce((s, z) => s + z.parzellen, 0));
console.log('ZH/TG:', zeilen.filter(z => ['ZH', 'TG'].includes(z.kanton)).map(z => `${z.nr} ${z.egrid}`).join(', '));
console.log('Nachbarn gesamt', zeilen.reduce((s, z) => s + z.nachbarn.length, 0));
