import { portalUrl } from '@/lib/portal';

/**
 * Welches Grundstück als Nächstes abgefragt wird.
 *
 * Die Reihenfolge ist nicht beliebig: gefragt ist das grösste
 * ungenutzte Potenzial zuerst. Wer zwanzig Auskünfte am Tag hat, soll
 * sie nicht an das erstbeste Grundstück hängen.
 *
 * Übersprungen wird, was schon einen Eigentümer trägt oder abgefragt
 * ist -- und das eben erledigte, auch wenn die Datenbank noch die alte
 * Zeile liefert.
 */
export interface Abfragbar {
  id: string;
  egrid?: string | null;
  bfsNr?: string | null;
  kanton?: string | null;
  address?: string | null;
  parzelle?: string | null;
  eigentuemer?: string | null;
  marge?: number | null;
}

export function naechsteParzelle(
  objekte: Abfragbar[],
  schonErledigt: string[] = [],
): Abfragbar | null {
  const erledigt = new Set(schonErledigt);
  const offen = objekte.filter(o =>
    o.egrid
    && !erledigt.has(o.id)
    && !String(o.eigentuemer ?? '').trim());
  if (offen.length === 0) return null;
  return offen.reduce((a, b) => ((b.marge ?? 0) > (a.marge ?? 0) ? b : a));
}

/** Die Adresse, an der diese Parzelle nachgeschlagen wird. */
export function naechsteAdresse(o: Abfragbar): string {
  return portalUrl(o.kanton, o.egrid, o.bfsNr);
}
