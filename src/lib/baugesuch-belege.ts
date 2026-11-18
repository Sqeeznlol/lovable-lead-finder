/**
 * Wie ein Baugesuch aussieht und wo man es nachprüft. Gebraucht von
 * der Seite Baugesuche und von der Objektansicht.
 */
export interface Gesuch {
  id: string; publiziert_am: string; kanton?: string | null; gemeinde: string | null; adresse: string | null; parzelle_nr: string | null;
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

/** Der Tag als JJJJ-MM-TT in der Schweiz, zum Vergleich mit den Daten der Gesuche. */
const tag = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });

/**
 * Das Datum, bis zu dem das Amtsblatt die Publikation zeigte, wenn es
 * vorbei ist; sonst null. Danach antwortet es mit «This publication is no
 * longer publicly accessible via the Internet» (18. November: elf
 * Zürcher Gesuche geprüft, jedes genau bis zu seinem Ablauf erreichbar,
 * also ein Jahr nach der Publikation).
 */
export function nichtMehrOeffentlich(g: Pick<Gesuch, 'publiziert_bis'>, heute = new Date()): string | null {
  return g.publiziert_bis && g.publiziert_bis.slice(0, 10) < tag(heute) ? g.publiziert_bis.slice(0, 10) : null;
}

export function belege(g: Pick<Gesuch, 'publikation_id' | 'publikation_nr' | 'quelle_url' | 'publiziert_bis'> & { quelle?: string }, heute = new Date()): { titel: string; zeile: string; url: string }[] {
  const b: { titel: string; zeile: string; url: string }[] = [];
  // Nach dem Ablauf führen die Links des Amtsblatts nur noch auf eine Fehlermeldung.
  const vorbei = nichtMehrOeffentlich(g, heute) != null;
  // Übrige Kantone (Quelle 'amtsblatt'): quelle_url ist die Publikation im Amtsblatt des Kantons,
  // je Mandant geprüft (src/lib/amtsblatt.ts); das PDF liegt am selben Ort.
  if (g.quelle === 'amtsblatt') {
    if (g.quelle_url && g.publikation_id && !vorbei) {
      b.push({ titel: 'Publikation im Amtsblatt', zeile: g.publikation_nr ?? new URL(g.quelle_url).hostname, url: g.quelle_url });
      b.push({ titel: 'Publikation als PDF', zeile: 'zum Ablegen oder Weitergeben', url: `${new URL(g.quelle_url).origin}/api/v1/publications/${g.publikation_id}/pdf` });
    }
    return b;
  }
  if (g.publikation_id && !vorbei) {
    b.push({ titel: 'Publikation im Amtsblatt', zeile: g.publikation_nr ?? 'Amtsblatt des Kantons Zürich', url: AMTSBLATT_SEITE(g.publikation_id) });
    b.push({ titel: 'Publikation als PDF', zeile: 'zum Ablegen oder Weitergeben', url: `https://amtsblatt.zh.ch/api/v1/publications/${g.publikation_id}/pdf` });
  }
  if (g.quelle_url) b.push({ titel: 'Quelle', zeile: 'Baugesuche im Kanton Zürich, Statistisches Amt', url: g.quelle_url });
  return b;
}

