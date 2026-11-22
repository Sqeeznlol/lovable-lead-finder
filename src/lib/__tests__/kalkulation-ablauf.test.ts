import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Der Ablauf von CALC YOU LATER (prüfen, freigeben, anbieten, senden in
 * einem Tag) hält nur, wenn ihn die Datenbank erzwingt: eine Seite kann
 * man umgehen. Diese Tests werden rot, wenn eine der Sicherungen aus der
 * Migration verschwindet.
 */
// Die Tabelle (16. November) und der Weg des Angebots durch vier Hände (19. November).
const dateien = readdirSync('supabase/migrations').filter(d => d.endsWith('_kalkulation.sql') || d.endsWith('_angebot.sql')).sort();
const sql = dateien.map(d => readFileSync(`supabase/migrations/${d}`, 'utf8')).join('\n');
const neueste = readFileSync(`supabase/migrations/${dateien[dateien.length - 1]}`, 'utf8');
// Was nur kalkulation_schritt schreibt: der Weg und alles, was David, Tim und Julian entscheiden.
const ABLAUF = ['zustand', 'preis_chf', 'eingereicht_am', 'frist_am', 'gesendet_am', 'angebot_text', 'verlauf',
  'firma', 'vorlage', 'schrift', 'angebot', 'preis_urteil', 'preis_grund'];

describe('CALC YOU LATER: der Ablauf liegt in der Datenbank', () => {
  it('die Spalten des Ablaufs lassen sich von aussen nicht schreiben', () => {
    expect(sql).toMatch(/revoke all on public\.kalkulation from public, anon, authenticated;/);
    const rechte = [...sql.matchAll(/grant (insert|update) \(([^)]+)\)\s+on public\.kalkulation to authenticated;/g)];
    expect(rechte.map(r => r[1]).sort()).toEqual(['insert', 'insert', 'update', 'update']);
    for (const [, , spalten] of rechte) {
      const liste = spalten.split(',').map(s => s.trim());
      for (const s of ABLAUF) expect(liste).not.toContain(s);
      // Wer angelegt hat und wann, setzt die Datenbank.
      expect(liste).not.toContain('erstellt_von');
      expect(liste).not.toContain('erstellt_am');
    }
  });

  it('Fondsleitungen und Unangemeldete kommen nicht an die Tabelle', () => {
    expect(sql).toMatch(/alter table public\.kalkulation enable row level security;/);
    const regeln = [...sql.matchAll(/create policy (\w+) on public\.kalkulation[\s\S]*?;/g)];
    expect(regeln).toHaveLength(4);
    for (const [text] of regeln) {
      expect(text).toMatch(/to authenticated/);
      expect(text).toMatch(/not public\.ist_fondsmanager\(\)/);
    }
    expect(sql).not.toMatch(/to anon/);
    expect(sql).toMatch(/revoke all on function public\.kalkulation_schritt\([^)]*\) from public, anon;/);
  });

  it('ändern und löschen lässt sich nur ein Entwurf', () => {
    expect(sql).toMatch(/create policy kalkulation_entwurf[\s\S]*?using \(not public\.ist_fondsmanager\(\) and zustand = 'entwurf'\)/);
    expect(sql).toMatch(/create policy kalkulation_loeschen[\s\S]*?using \(not public\.ist_fondsmanager\(\) and zustand = 'entwurf'\)/);
  });

  it('Tim muss sein Urteil über die Empfehlung begründen: daraus lernt die Rechnung', () => {
    expect(neueste).toMatch(/urteil not in \('zu_tief', 'passt', 'zu_hoch'\)/);
    expect(neueste).toMatch(/if notiz is null or length\(notiz\) < 10 then\s+raise exception 'Bitte begründen/);
  });

  it('Tim entscheidet und verschickt (22. November: «Tim entscheidet immer schlussendlich»)', () => {
    const weg = [...neueste.matchAll(/k\.zustand := '(\w+)';/g)].map(m => m[1]);
    for (const z of ['pruefung', 'angebot', 'gesendet']) expect(weg).toContain(z);
    // Kein Visum, keine Kontrolle, keine zweite Bestätigung mehr.
    expect(weg).not.toContain('visum');
    expect(weg).not.toContain('kontrolle');
    expect(weg).not.toContain('bestaetigung');
    expect(neueste).toMatch(/rolle := case when k\.zustand in \('pruefung', 'angebot'\) then 'visum' end;/);
    expect(neueste).toMatch(/p_schritt = 'senden' and k\.zustand = 'angebot'/);
    // Die Schrift gehört zur Firma.
    expect(neueste).toMatch(/k\.schrift := case k\.firma when 'studer' then 'carlito'/);
    // Wer eine Rolle mit Konto hat, tut sie allein; Rollen legt nur ein Admin fest.
    expect(neueste).toMatch(/not public\.angebot_darf\(rolle\)/);
    expect(sql).toMatch(/create policy angebot_person_pflegen[\s\S]*?public\.has_role\(auth\.uid\(\), 'admin'\)/);
  });

  it('die Uhr stellt die Datenbank: ein Tag ab dem Einreichen', () => {
    expect(sql).toMatch(/k\.eingereicht_am := now\(\);\s+k\.frist_am := now\(\) \+ interval '24 hours';/);
    expect(sql).toMatch(/k\.gesendet_am := now\(\);/);
  });

  it('jede Anweisung trägt eine Frist', () => {
    expect(sql).toMatch(/create or replace function public\.kalkulation_schritt[\s\S]*?set statement_timeout to '5s'/);
    expect(neueste).toMatch(/create or replace function public\.kalkulation_schritt[\s\S]*?set statement_timeout to '5s'/);
  });

  // Was der Text nicht zeigt, zeigt die Probe: die Migration in einer
  // Wegwerf-Datenbank, mit jedem Schritt in und ausser der Reihe.
  it('Reihenfolge, Uhr und Rechte halten in einer echten Datenbank', () => {
    const lauf = spawnSync('bash', ['tools/kalkulation-probe.sh'], { encoding: 'utf8', timeout: 110_000 });
    if (lauf.status === 77) {
      console.warn(`Probe ausgelassen: ${lauf.stdout.trim()}`);
      return;
    }
    expect(`${lauf.stdout}${lauf.stderr}`.trim()).toBe('Reihenfolge, Uhr und Rechte: alle Proben bestanden.');
    expect(lauf.status).toBe(0);
  }, 120_000);
});
