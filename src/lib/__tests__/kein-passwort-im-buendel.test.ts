/**
 * Im Admin-Riegel stand ein Passwort -- erst im Klartext, spaeter als
 * SHA-256-Pruefsumme. Die Pruefsumme sah nach Vorsicht aus und war
 * keine: sie lag im ausgelieferten Buendel, und ein kurzes Wort ohne
 * Salz faellt damit in Sekunden. Geschuetzt hat sie nie etwas, sie hat
 * nur so ausgesehen -- und solange sie dastand, kam niemand auf die
 * Idee, den Bereich wirklich zu schuetzen.
 *
 * Dieser Test laesst keine zweite dieser Art mehr durch. Er prueft
 * nicht das Wort "Passwort": Anmeldung.tsx hat ein Passwortfeld, und
 * das gehoert dorthin -- es reicht die Eingabe an Supabase weiter und
 * vergleicht nichts selbst. Geprueft wird das Muster, das schiefging:
 * ein Geheimnis als Konstante, und ein Vergleich, der im Browser
 * entscheidet.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function quellen(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap(e => {
    const pfad = join(ordner, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : quellen(pfad);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [pfad] : [];
  });
}

const dateien = quellen('src').filter(p => !p.includes('/ui/'));

describe('Kein Geheimnis im Buendel', () => {
  it('findet ueberhaupt Quellen', () => {
    expect(dateien.length).toBeGreaterThan(20);
  });

  it('traegt keine Pruefsumme und keinen Schluessel als Konstante', () => {
    // 32 Hex-Zeichen und mehr: dafuer gibt es in einer Oberflaeche
    // keinen Grund. SHA-256 hat 64, MD5 deren 32.
    const schuldige: string[] = [];
    for (const p of dateien) {
      readFileSync(p, 'utf8').split('\n').forEach((z, i) => {
        if (/['"`][0-9a-fA-F]{32,}['"`]/.test(z)) schuldige.push(`${p}:${i + 1}`);
      });
    }
    expect(schuldige).toEqual([]);
  });

  it('laesst den Browser ueber kein Passwort entscheiden', () => {
    // Der alte Fehler in Zeichen: eine Eingabe wird gehasht und gegen
    // eine Konstante gehalten. Wer das wieder einbaut, faellt hier auf.
    const schuldige: string[] = [];
    for (const p of dateien) {
      const t = readFileSync(p, 'utf8');
      if (/crypto\.subtle\.digest/.test(t)) schuldige.push(`${p} (digest)`);
      if (/===\s*(PRUEFSUMME|PASSWORT|PASSWORD|GEHEIMNIS)\b/.test(t)) {
        schuldige.push(`${p} (Vergleich)`);
      }
    }
    expect(schuldige).toEqual([]);
  });

  it('haelt den service_role-Schluessel aus dem Browser heraus', () => {
    // Steht in CLAUDE.md und ist der teuerste Fehler von allen: dieser
    // Schluessel haengt jede Regel der Datenbank aus.
    const schuldige = dateien.filter(p =>
      /service_role|SERVICE_ROLE/.test(readFileSync(p, 'utf8')),
    );
    expect(schuldige).toEqual([]);
  });
});
