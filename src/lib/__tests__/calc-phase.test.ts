import { describe, expect, it } from 'vitest';
import { phase, phaseText } from '@/lib/calc-ablauf';

/**
 * Julian, 22. November: «man muss auch sehen, in welcher Phase die
 * Rechnung ist ... wo ist sie aktuell?». Die Namen kommen aus «Wer was
 * tut» (angebot_person); hier stehen nur Testnamen.
 */
const personen = [
  { name: 'TEST Entscheid', rollen: ['visum', 'unterschrift'] },
  { name: 'TEST Unterschrift', rollen: ['unterschrift'] },
];
const am = '2026-11-22T10:00:00Z';

describe('Phase einer Kalkulation', () => {
  it('Entwurf liegt bei dem, der ihn angelegt hat', () => {
    const p = phase({ zustand: 'entwurf', verlauf: [], von: 'TEST Ersteller' }, personen);
    expect(p).toEqual({ nr: 1, titel: 'Rechnen und einreichen', bei: 'TEST Ersteller' });
    expect(phaseText(p)).toBe('Phase 1 von 3 · Rechnen und einreichen · bei TEST Ersteller');
  });

  it('Preis festlegen und Verschicken liegen bei wem entscheidet, nicht bei allen Eingetragenen', () => {
    expect(phaseText(phase({ zustand: 'pruefung', verlauf: [] }, personen))).toBe('Phase 2 von 3 · Preis festlegen · bei TEST Entscheid');
    expect(phaseText(phase({ zustand: 'angebot', verlauf: [] }, personen))).toBe('Phase 3 von 3 · Verschicken · bei TEST Entscheid');
  });

  it('Stände des alten Wegs zählen als Phase 2', () => {
    for (const zustand of ['visum', 'kontrolle', 'bestaetigung'] as const) {
      expect(phase({ zustand, verlauf: [] }, personen).nr).toBe(2);
    }
  });

  it('ohne eingetragene Person steht kein erfundener Name', () => {
    expect(phaseText(phase({ zustand: 'pruefung', verlauf: [] }, []))).toBe('Phase 2 von 3 · Preis festlegen');
  });

  it('Verschickt und Abgelehnt nennen, wer es tat', () => {
    const verlauf = [{ schritt: 'einreichen', name: 'TEST Ersteller', am }, { schritt: 'senden', name: 'TEST Entscheid', am }];
    expect(phaseText(phase({ zustand: 'gesendet', verlauf }, personen))).toBe('Verschickt · von TEST Entscheid');
    expect(phaseText(phase({ zustand: 'abgelehnt', verlauf: [{ schritt: 'ablehnen', name: 'TEST Entscheid', am }] }, personen))).toBe('Abgelehnt · von TEST Entscheid');
  });
});
