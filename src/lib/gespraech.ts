/**
 * Ein Gespräch als Daten, nicht als Notiz -- Abschnitt 6 von Tims Text:
 * Verkaufsabsicht, Preisvorstellung, Ablehnungsgrund, weitere Objekte,
 * Wiedervorlage, und ob der Eigentümer selbst kauft.
 *
 * Und Abschnitt 7: Wer nicht verkauft, ist nicht verloren. Aus Absicht
 * und Grund folgt eine Kategorie, und jede Kategorie hat ihren eigenen
 * nächsten Schritt. Die Regel steht hier, an einer Stelle, damit die
 * Erfassung und die Reaktivierungsliste dasselbe meinen.
 */
export type Absicht = 'ja' | 'spaeter' | 'nein' | 'nur bei preis' | 'unklar';

export const ABSICHTEN: [Absicht, string][] = [
  ['ja', 'Will verkaufen'], ['spaeter', 'Später vielleicht'], ['nur bei preis', 'Nur zum richtigen Preis'],
  ['nein', 'Will nicht verkaufen'], ['unklar', 'Unklar'],
];

export const GRUENDE: [string, string][] = [
  ['', '–'],
  ['kein interesse', 'Kein Interesse am Verkauf'],
  ['bewertung', 'Unsere Bewertung zu tief'],
  ['zeitpunkt', 'Jetzt nicht, später'],
  ['makler', 'Lieber mit Makler'],
  ['familie', 'Bleibt in der Familie'],
  ['andere', 'Anderer Grund'],
];

export type Kategorie = 'deal' | 'spaeter' | 'bewertung' | 'makler' | 'investor' | 'kein interesse' | 'offen';

export const KATEGORIEN: Record<Kategorie, { titel: string; schritt: string }> = {
  deal:             { titel: 'Verkaufsbereit',         schritt: 'Deal anlegen und Unterlagen anfordern' },
  spaeter:          { titel: 'Verkauft später',        schritt: 'Zur Wiedervorlage wieder anrufen' },
  bewertung:        { titel: 'Uneins beim Preis',      schritt: 'Kostenlose Bewertung anbieten' },
  makler:           { titel: 'Will einen Makler',      schritt: 'Maklermandat anbieten' },
  investor:         { titel: 'Kauft selbst',           schritt: 'Passende Objekte aus dem Bestand vorschlagen' },
  'kein interesse': { titel: 'Kein Interesse',         schritt: 'In zwölf Monaten per Brief nachfassen' },
  offen:            { titel: 'Noch offen',             schritt: 'Erneut anrufen' },
};

export interface GespraechDaten {
  erreicht: boolean | null;
  verkaufsabsicht: Absicht | null;
  ablehnungsgrund: string | null;
  kauft_selbst: boolean;
}

/** In welche Gruppe ein Gespräch fällt -- und damit, was als Nächstes zu tun ist. */
export function kategorie(g: GespraechDaten): Kategorie {
  if (g.kauft_selbst) return 'investor';
  if (g.erreicht === false || !g.verkaufsabsicht) return 'offen';
  if (g.verkaufsabsicht === 'ja') return 'deal';
  if (g.ablehnungsgrund === 'bewertung' || g.verkaufsabsicht === 'nur bei preis') return 'bewertung';
  if (g.ablehnungsgrund === 'makler') return 'makler';
  if (g.verkaufsabsicht === 'spaeter' || g.ablehnungsgrund === 'zeitpunkt') return 'spaeter';
  if (g.verkaufsabsicht === 'nein') return 'kein interesse';
  return 'offen';
}

/** "1,2 Mio." oder "850'000" aus dem, was jemand im Gespräch eintippt. */
export function betragLesen(s: string): number | null {
  const t = s.trim().toLowerCase().replace(/chf|fr\.?/g, '').replace(/['’\s]/g, '');
  if (!t) return null;
  const mio = /mio|m$/.test(t);
  const n = Number(t.replace(/mio\.?|m$/, '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(mio ? n * 1_000_000 : n);
}
