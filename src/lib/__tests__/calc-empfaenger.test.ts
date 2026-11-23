import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { empfaenger, personenAusEigentuemer } from '@/lib/angebot';

/**
 * Julian, 23. November, nach «Zur Prüfung einreichen»: «wo muss ich das
 * eingeben?». Die Meldung stand nur unten beim Knopf, das Kästchen
 * «Bekommt das Angebot» weit oben unter «Für das Angebot».
 */
const rechnung = readFileSync('src/components/calc/Rechnung.tsx', 'utf8');
const feld = readFileSync('src/components/calc/Empfaenger.tsx', 'utf8');

describe('Wer das Angebot bekommt', () => {
  it('ein einziger Eigentümer ist schon gewählt, bei mehreren entscheidet ein Mensch', () => {
    expect(empfaenger(personenAusEigentuemer('Muster Anna'))).toHaveLength(1);
    expect(empfaenger(personenAusEigentuemer('Muster Anna; Beispiel Beat'))).toHaveLength(0);
  });

  it('Einreichen ohne Empfänger springt zum Kästchen', () => {
    expect(feld).toContain('id="calc-empfaenger"');
    expect(rechnung).toContain("document.getElementById('calc-empfaenger')?.scrollIntoView(");
    expect(rechnung).toContain('fehlt={empfaengerFehlt}');
  });

  it('dort steht, was zu tun ist, und verschwindet nach dem Ankreuzen', () => {
    expect(feld).toContain('«Bekommt das Angebot» ankreuzen.');
    expect(feld).toMatch(/\{fehlt && !an && \(/);
  });
});
