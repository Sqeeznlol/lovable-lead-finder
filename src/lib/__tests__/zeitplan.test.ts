/**
 * 16. November: «Zählen» (Plan 03:47 UTC) und «Reiter prüfen» (05:20)
 * waren am Morgen nicht gelaufen. GitHub startet die geplanten Läufe
 * dieses Repositorys Stunden nach Plan -- «Baugesuche» (05:23) lief vom
 * 4. bis 15. November zwischen 11:47 und 14:00 Uhr. Die «Nachbarschaft»
 * (Plan 23:30) hätte so am Morgen um sieben in die Datenbank der Seite
 * geschrieben statt nachts.
 *
 * Läufe, die eine Tageszeit brauchen, prüfen die Uhr darum selbst
 * (tools/zeitfenster.sh) und haben mehrere Einträge im Zeitplan. Dieser
 * Wächter rechnet nach, dass bei jeder Verspätung einer davon ins
 * Fenster trifft -- sonst bliebe ein Lauf still aus.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const lesen = (name: string) => readFileSync(`.github/workflows/${name}`, 'utf8');
const ohneKommentare = (t: string) => t.replace(/^\s*#.*$/gm, '');
const minuten = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const TAG = 24 * 60;

/** Was die Uhr sagt: 0 im Fenster, 1 ausserhalb, 2 bei falschem Aufruf. */
function uhr(von: string, bis: string, jetzt: string): number {
  try {
    execFileSync('bash', ['tools/zeitfenster.sh', von, bis], { env: { ...process.env, JETZT: jetzt }, stdio: 'pipe' });
    return 0;
  } catch (e) {
    return (e as { status: number }).status;
  }
}

/** Zeitplan und Fenster eines Ablaufs, wie sie in der Datei stehen. */
function plan(name: string) {
  const t = ohneKommentare(lesen(name));
  const starts = [...t.matchAll(/- cron: '(\d+) (\d+) \* \* [^']+'/g)].map(m => Number(m[2]) * 60 + Number(m[1]));
  const fenster = /\[ "\$GITHUB_EVENT_NAME" = schedule \] && ! tools\/zeitfenster\.sh (\d\d:\d\d) (\d\d:\d\d);/.exec(t);
  return { text: t, starts, von: fenster?.[1] ?? '', bis: fenster?.[2] ?? '' };
}

const imFenster = (zeit: number, von: string, bis: string) => {
  const [a, b, z] = [minuten(von), minuten(bis), ((zeit % TAG) + TAG) % TAG];
  return a <= b ? z >= a && z < b : z >= a || z < b;
};

describe('Die Uhr der geplanten Läufe', () => {
  it('kennt Anfang, Ende und Mitternacht', () => {
    expect(uhr('22:00', '02:00', '21:59')).toBe(1);
    expect(uhr('22:00', '02:00', '22:00')).toBe(0);
    expect(uhr('22:00', '02:00', '00:08')).toBe(0);
    expect(uhr('22:00', '02:00', '01:59')).toBe(0);
    expect(uhr('22:00', '02:00', '02:00')).toBe(1);
    // Der Start, den GitHub dem alten Eintrag 23:30 gegeben hätte.
    expect(uhr('22:00', '02:00', '07:20')).toBe(1);
    expect(uhr('03:40', '07:40', '03:39')).toBe(1);
    expect(uhr('03:40', '07:40', '05:09')).toBe(0);
    expect(uhr('03:40', '07:40', '12:49')).toBe(1);
  });

  it('lehnt einen falschen Aufruf ab, statt ein Fenster zu erfinden', () => {
    expect(uhr('22', '2', '23:00')).toBe(2);
    expect(uhr('22:00', '26:00', '23:00')).toBe(2);
    expect(uhr('22:00', '', '23:00')).toBe(2);
  });

  // Das Fenster der Rechnung unten ist dasselbe, das die Uhr durchsetzt.
  it('die Rechnung dieses Tests stimmt mit der Uhr überein', () => {
    for (const [von, bis] of [['22:00', '02:00'], ['03:40', '07:40'], ['04:30', '08:30']]) {
      for (let z = 0; z < TAG; z += 7) {
        const hhmm = `${String(Math.floor(z / 60)).padStart(2, '0')}:${String(z % 60).padStart(2, '0')}`;
        expect(uhr(von, bis, hhmm) === 0, `${von} bis ${bis}, ${hhmm}`).toBe(imFenster(z, von, bis));
      }
    }
  });
});

describe('Geplante Läufe treffen ihre Tageszeit, wie spät GitHub auch startet', () => {
  const FAELLE: [string, string, string, string][] = [
    // Ablauf, Fenster von, bis (UTC), erster Schritt eines geplanten Laufs mit Arbeit
    // («Hängende Rechnungen beenden» davor läuft nur von Hand.)
    ['nachbarschaft.yml', '22:00', '02:00', 'name: Ist etwas offen?'],
    ['zaehlen.yml', '03:40', '07:40', 'steps:'],
    ['reiter.yml', '04:30', '08:30', 'steps:'],
  ];

  for (const [name, von, bis, ab] of FAELLE) {
    it(`${name}: prüft die Uhr, bevor etwas geschieht`, () => {
      const p = plan(name);
      expect([p.von, p.bis]).toEqual([von, bis]);
      // Vor der ersten Anfrage an die Datenbank und vor dem Browser.
      expect(p.text.indexOf(ab)).toBeGreaterThan(-1);
      const schritte = p.text.slice(p.text.indexOf(ab));
      const uhr = schritte.indexOf('tools/zeitfenster.sh');
      const arbeit = ['psql "$DB"', 'node tools/'].map(w => schritte.indexOf(w)).filter(i => i >= 0);
      expect(uhr).toBeGreaterThan(-1);
      expect(arbeit.length).toBeGreaterThan(0);
      expect(uhr).toBeLessThan(Math.min(...arbeit));
      // Die Uhr liegt im Repository: ohne Checkout fände der Lauf sie nicht.
      const checkout = p.text.indexOf('actions/checkout');
      expect(checkout).toBeGreaterThan(-1);
      expect(checkout).toBeLessThan(p.text.indexOf('tools/zeitfenster.sh'));
    });

    it(`${name}: bei jeder Verspätung von 0 bis 9½ Stunden trifft ein Eintrag`, () => {
      const p = plan(name);
      expect(p.starts.length).toBeGreaterThanOrEqual(3);
      const ohneTreffer: string[] = [];
      for (let spaet = 0; spaet <= 9.5 * 60; spaet += 5) {
        if (!p.starts.some(s => imFenster(s + spaet, von, bis))) ohneTreffer.push(`${Math.floor(spaet / 60)} h ${spaet % 60} min`);
      }
      expect(ohneTreffer).toEqual([]);
    });

    // Gemessen vom 4. bis 15. November: 6 h 24 bis 8 h 38 nach Plan.
    it(`${name}: im gemessenen Fall trifft ein Eintrag mit einer halben Stunde Luft`, () => {
      const p = plan(name);
      const einer = p.starts.some(s => {
        for (let spaet = 6 * 60 + 24 - 30; spaet <= 8 * 60 + 38 + 30; spaet += 5) if (!imFenster(s + spaet, von, bis)) return false;
        return true;
      });
      expect(einer).toBe(true);
    });
  }

  it('die Nachbarschaft schreibt geplant nie am Tag', () => {
    const p = plan('nachbarschaft.yml');
    // Ausserhalb der Nacht meldet der Schritt «nichts offen», und alle
    // weiteren Schritte hängen an dieser Zahl.
    const wache = p.text.slice(p.text.indexOf('tools/zeitfenster.sh 22:00 02:00'));
    expect(wache.slice(0, 500)).toMatch(/echo "n=0" >> "\$GITHUB_OUTPUT"\s+exit 0/);
    const schritte = p.text.slice(p.text.indexOf('name: Ist etwas offen?'));
    const bedingungen = [...schritte.matchAll(/\n\s+if: \$\{\{ (.*) \}\}/g)].map(m => m[1]).slice(1);
    expect(bedingungen.length).toBeGreaterThanOrEqual(6);
    expect(bedingungen.filter(b => !b.includes("steps.offen.outputs.n != '0'"))).toEqual([]);
    // Das Fenster endet, bevor das Einspielen aufhört (03:30 UTC).
    expect(minuten(p.bis)).toBeLessThan(minuten('03:30'));
  });

  it('Zählen und Reiter prüfen überspringen die Arbeit ausserhalb ihrer Zeit', () => {
    for (const name of ['zaehlen.yml', 'reiter.yml']) {
      const t = ohneKommentare(lesen(name));
      const nachDerUhr = t.slice(t.indexOf('tools/zeitfenster.sh'));
      expect(nachDerUhr).toContain('echo "weiter=nein" >> "$GITHUB_OUTPUT"');
      const schritte = [...nachDerUhr.matchAll(/\n {6}- name: ([^\n]+)\n((?: {8}[^\n]*\n)*)/g)];
      expect(schritte.length).toBeGreaterThanOrEqual(2);
      expect(schritte.filter(s => !s[2].includes("if: ${{ steps.zeit.outputs.weiter != 'nein' }}")).map(s => s[1])).toEqual([]);
    }
  });

  // Die Morgenkontrolle von «Was ist live» löste einen zweiten Durchgang
  // durch alle Reiter aus, zusätzlich zum eigenen Zeitplan.
  it('ein geplanter Lauf von «Was ist live» zieht kein «Reiter prüfen» nach', () => {
    expect(ohneKommentare(lesen('reiter.yml'))).toContain("github.event.workflow_run.event != 'schedule'");
  });

  // Ein geplanter Lauf ausserhalb seiner Zeit tut nichts -- bräche er dabei
  // die laufende Prüfung eines ausgelieferten Standes ab, fehlte sie ganz.
  it('ein geplanter Lauf bricht keine laufende Prüfung ab', () => {
    expect(ohneKommentare(lesen('reiter.yml'))).toMatch(/group: reiter\n\s+cancel-in-progress: \$\{\{ github\.event_name != 'schedule' \}\}/);
  });

  // Nach dem Einspielen zählt «Nachbarschaft» selbst.
  it('Zählen zählt nicht gleich noch einmal', () => {
    const t = ohneKommentare(lesen('zaehlen.yml'));
    expect(t.indexOf('max(gezaehlt_am)')).toBeGreaterThan(-1);
    expect(t.indexOf('max(gezaehlt_am)')).toBeLessThan(t.indexOf('public.daten_zaehlen()'));
  });
});
