/**
 * Wie ein Baugesuch aussieht und wo man es nachprüft. Gebraucht von
 * der Seite Baugesuche und von der Objektansicht.
 */
export interface Gesuch {
  id: string; publiziert_am: string; gemeinde: string | null; adresse: string | null; parzelle_nr: string | null;
  egrid: string | null; beschreibung: string | null; bauherrschaft: string | null; parzelle_id: string | null;
  nachbar_egrids: string[] | null; erfasst_am: string; quelle: string;
  publikation_nr?: string | null; publikation_id?: string | null;
  einsprache_bis?: string | null; publiziert_bis?: string | null; quelle_url?: string | null;
}

/**
 * Die Wege zum Nachprüfen eines Gesuchs: die Publikation im Amtsblatt
 * und der Datensatz, aus dem die Zeile stammt. Nur Adressen, die
 * "Auswerten / amtsblatt" mit einer echten Publikation geprüft hat:
 * die Detailseite zeigt die Nummer im Browser (Lauf 64), das PDF kommt
 * als %PDF zurück. Mit amtsblattportal.ch statt amtsblatt.zh.ch bleibt
 * die Seite leer, mit der Nummer statt der Kennung meldet sie Fehler.
 */
const AMTSBLATT_SEITE = (id: string) => `https://amtsblatt.zh.ch/#!/search/publications/detail/${id}`;

export function belege(g: Gesuch): { titel: string; zeile: string; url: string }[] {
  const b: { titel: string; zeile: string; url: string }[] = [];
  if (g.publikation_id) {
    b.push({ titel: 'Publikation im Amtsblatt', zeile: g.publikation_nr ?? 'Amtsblatt des Kantons Zürich', url: AMTSBLATT_SEITE(g.publikation_id) });
    b.push({ titel: 'Publikation als PDF', zeile: 'zum Ablegen oder Weitergeben', url: `https://amtsblatt.zh.ch/api/v1/publications/${g.publikation_id}/pdf` });
  }
  if (g.quelle_url) b.push({ titel: 'Quelle', zeile: 'Baugesuche im Kanton Zürich, Statistisches Amt', url: g.quelle_url });
  return b;
}

