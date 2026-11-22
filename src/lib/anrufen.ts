/**
 * Die Anrufliste im Cockpit (22. November, Julian: «die welche System sagt
 * gut und ich dann Namen gespeichert habe, da soll dann Tim anrufen»).
 *
 * Drin steht ein Objekt, wenn Aurora eine Marge gerechnet hat (das, was
 * das System gut findet; im Cockpit unter «Grösstes Potenzial») und ein
 * Mensch den Eigentümer eingetragen hat: `owner_name` ist die Handeingabe
 * in der Objektansicht, `eigentuemer_name` die Abfrage beim Grundbuch.
 * Hinaus fällt es, sobald ein Gespräch erfasst ist (Tabelle `anruf`).
 */
export interface Anruf {
  id: string;
  address: string | null;
  gemeinde: string | null;
  owner_name: string;
  owner_phone: string | null;
  owner_address?: string | null;
  marge_chf: number | null;
}

/**
 * Wo tel.search die Nummer suchen soll: der Ort aus der Adresse des
 * Eigentümers, wenn eingetragen (er wohnt oft nicht im Haus), sonst die
 * Gemeinde des Objekts.
 */
export function woSuchen(z: Pick<Anruf, 'owner_address' | 'gemeinde'>): string {
  const plzOrt = /\b(\d{4})\s+([^,\d]+)$/.exec((z.owner_address ?? '').trim());
  return plzOrt ? `${plzOrt[1]} ${plzOrt[2].trim()}` : (z.gemeinde ?? '');
}

/** Testdaten tragen TEST im Namen (CLAUDE.md); angerufen werden sie nie. */
const istTest = (name: string) => /\btest\b/i.test(name);

/** Die Zeilen ohne Gespräch, mit Namen, ohne Testdaten; Reihenfolge wie geliefert (grösste Marge zuerst). */
export function anrufListe(zeilen: Anruf[], schonGesprochen: Iterable<string | null>): Anruf[] {
  const gesprochen = new Set(schonGesprochen);
  return zeilen.filter(z => !gesprochen.has(z.id) && !!z.owner_name?.trim() && !istTest(z.owner_name));
}

/**
 * «079 123 45 67» wird zu «tel:0791234567»: das iPhone wählt nur Ziffern
 * und ein führendes +. Die (0) in «+41 (0)79 …» wird nicht gewählt.
 */
export function telLink(nummer: string): string {
  const n = nummer.trim().replace(/\(0\)/g, '');
  return `tel:${n.startsWith('+') ? '+' : ''}${n.replace(/\D/g, '')}`;
}
