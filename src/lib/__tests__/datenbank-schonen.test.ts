/**
 * Nacht auf den 16. November: die Nachbarschaft der Zürcher Parzellen
 * wurde in der Datenbank gerechnet, die auch die Seite bedient. Von
 * 00:33 bis 00:59 Uhr scheiterte die Anmeldung, und nach dem Abbruch
 * der Läufe rechnete die Datenbank weiter, ohne dass es jemand sah.
 *
 * Seither rechnet der Ablauf «Nachbarschaft» auf dem Runner und spielt
 * nur das Ergebnis ein, in Portionen mit Pause, und die Seite zählt
 * die grossen Tabellen nicht mehr bei jedem Öffnen. Dieser Wächter
 * wird rot, wenn eine dieser Sicherungen wieder verschwindet -- statt
 * dass es die nächste langsame Seite zeigt.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ORDNER = '.github/workflows';
const ablaeufe = readdirSync(ORDNER).filter(n => n.endsWith('.yml'));
const lesen = (name: string) => readFileSync(join(ORDNER, name), 'utf8');
// Kommentare erzählen, was früher war; geprüft wird, was ausgeführt wird.
const ohneKommentare = (t: string) => t.replace(/^\s*#.*$/gm, '');

describe('Die Datenbank bedient die Seite', () => {
  it('kein Ablauf rechnet die Nachbarschaft in der Datenbank der Seite', () => {
    const treffer = ablaeufe.filter(n => {
      const t = ohneKommentare(lesen(n));
      return t.includes('SUPABASE_DB_URL') && /nachbarschaft_rechnen\s*\(/.test(t);
    });
    expect(treffer).toEqual([]);
  });

  it('Läufe, die viel schreiben, laufen nie gleichzeitig', () => {
    const gruppe = (n: string) => /^concurrency:\s*\n\s+group:\s*(\S+)/m.exec(lesen(n))?.[1];
    expect(gruppe('nachbarschaft.yml')).toBe('datenbank-laden');
    expect(gruppe('umrisse.yml')).toBe('datenbank-laden');
  });

  // Ohne Frist rechnet eine Anweisung in der Datenbank weiter, wenn der
  // Lauf abbricht. Die Frist setzt die Datenbank selbst durch.
  it('jede Anweisung von «Nachbarschaft» an die Datenbank der Seite trägt eine Frist', () => {
    const t = ohneKommentare(lesen('nachbarschaft.yml'));
    const aufrufe = t.split('psql "$DB"').slice(1).map(a => a.split(/psql "\$LOKAL"|\n\s*\n/)[0]);
    expect(aufrufe.length).toBeGreaterThanOrEqual(6);
    expect(aufrufe.filter(a => !a.includes('statement_timeout'))).toEqual([]);
  });

  // Die Suche (16. November) liest die Parzellen nur über einen Ort: ohne
  // ihn müsste die Datenbank alle 530'000 lesen, bei jeder Suche.
  it('die Suche verlangt einen Ort und liest über den Index', () => {
    const m = readFileSync('supabase/migrations/20261116080000_suche.sql', 'utf8');
    const funktion = m.slice(m.indexOf('create or replace function public.suche_parzellen('));
    expect(funktion).toMatch(/if cardinality\(v_gemeinden\) = 0 and cardinality\(v_plz\) = 0 then\s+raise exception/);
    expect(funktion).toMatch(/where p\.gemeinde = any\(v_gemeinden\) or p\.plz = any\(v_plz\)/);
    // Höchstens 100 Zeilen je Anfrage, die Umrisse nur für diese.
    expect(funktion).toContain('least(greatest(coalesce(p_grenze, 50), 1), 100)');
  });

  // «Reiter prüfen», Lauf 18: nach dem Reiter «Auswertung» stockte die
  // Datenbank fünf Minuten lang. Er zählte bei jedem Öffnen die grossen
  // Tabellen. Die Zahlen kommen jetzt vorab gezählt (lib/daten-stand).
  it('die Auswertung zählt die grossen Tabellen nicht selbst', () => {
    for (const datei of ['src/components/KennzahlenTim.tsx', 'src/components/Auswertung.tsx']) {
      const t = readFileSync(datei, 'utf8');
      expect(t).not.toMatch(/zaehlen\('(properties|gebaeude|nachbarschaft|parzelle_punkt|lead_gebaeude|parzelle_gebaeude)'/);
      expect(t).toContain('DATEN_STAND');
    }
  });

  it('die Gemeinden der Lead-Listen sind abgelegt und werden nach dem Laden aufgefrischt', () => {
    const migration = readFileSync('supabase/migrations/20261116010000_zaehlungen_vorab.sql', 'utf8');
    expect(migration).toMatch(/create materialized view if not exists public\.lead_gebaeude_gemeinden/);
    expect(ohneKommentare(lesen('lead-listen.yml'))).toContain('refresh materialized view public.lead_gebaeude_gemeinden');
  });

  it('die Zählung läuft jede Nacht und nach dem Einspielen der Nachbarschaft', () => {
    expect(lesen('zaehlen.yml')).toMatch(/schedule:\s*\n(\s*#.*\n)*\s*- cron:/);
    expect(ohneKommentare(lesen('zaehlen.yml'))).toContain('public.daten_zaehlen()');
    expect(ohneKommentare(lesen('nachbarschaft.yml'))).toContain('public.daten_zaehlen()');
  });

  // «Tempo» sollte messen, wie schnell die Seite ist, und zählte dafür
  // die Parzellen ein Dutzend Mal durch. Am 16. November brachte der
  // Messlauf so selbst die Datenbank zum Stocken -- und den Lauf der
  // Nachbarschaft zum Scheitern, der gerade eine Verbindung brauchte.
  it('der Messlauf «Tempo» liest keine grosse Tabelle ganz', () => {
    const t = ohneKommentare(lesen('tempo.yml'));
    expect(t).not.toMatch(/from public\.(properties|gebaeude|nachbarschaft|parzelle_punkt)\b/);
    expect(t).not.toMatch(/"properties\?select=\*[^"]*" zaehlen/);
    expect(t).not.toContain('gebaeude_suchen');
    expect(t).toContain("set statement_timeout = '30s'");
  });

  // Mit leerem Guthaben brachte jeder Lauf von «Reiter prüfen» die Seite
  // für Minuten zum Stehen. Er misst darum zuerst, ob die Datenbank
  // zügig antwortet, und klickt sonst nicht durch.
  it('Reiter prüfen klickt eine träge Datenbank nicht durch', () => {
    const t = readFileSync('tools/reiter-pruefen.cjs', 'utf8');
    const haupt = t.slice(t.lastIndexOf('(async () => {'));
    expect(haupt.indexOf('await puls()')).toBeGreaterThan(-1);
    expect(haupt.indexOf('await puls()')).toBeLessThan(haupt.indexOf('chromium.launch('));
    expect(haupt).toMatch(/ms >= TRAEGE_MS\) \{[\s\S]*?process\.exit\(1\)/);
  });

  it('Fehlermeldungen der Datenbank erscheinen in «Nachbarschaft» nie im Protokoll', () => {
    const t = ohneKommentare(lesen('nachbarschaft.yml'));
    const aufrufe = t.split('psql "$DB"').slice(1).map(a => a.split(/psql "\$LOKAL"|\n\s*\n/)[0]);
    // Jeder Aufruf leitet die Fehlerausgabe um (in eine Datei oder ins Leere).
    expect(aufrufe.filter(a => !/2>\s*(\/tmp\/db\.err|\/dev\/null)|2>&1/.test(a))).toEqual([]);
  });
});
