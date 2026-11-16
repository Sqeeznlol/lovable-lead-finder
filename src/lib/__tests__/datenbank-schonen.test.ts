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

  it('Fehlermeldungen der Datenbank erscheinen in «Nachbarschaft» nie im Protokoll', () => {
    const t = ohneKommentare(lesen('nachbarschaft.yml'));
    const aufrufe = t.split('psql "$DB"').slice(1).map(a => a.split(/psql "\$LOKAL"|\n\s*\n/)[0]);
    // Jeder Aufruf leitet die Fehlerausgabe um (in eine Datei oder ins Leere).
    expect(aufrufe.filter(a => !/2>\s*(\/tmp\/db\.err|\/dev\/null)|2>&1/.test(a))).toEqual([]);
  });
});
