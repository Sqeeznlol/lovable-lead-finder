/**
 * Wer in den Akquise-Modus gehört.
 *
 * Die Auswahl stand als Kette von Filtern mitten im Bauteil, und einer
 * davon lautete
 *
 *     p.status === 'Neu' || p.status === 'Offen'
 *
 * Damit fiel jedes Objekt heraus, sobald sein Eigentümer eingetragen
 * war -- der Status heisst dann "Eigentümer ermittelt" oder
 * "Telefonnummer gesucht". Genau diese Objekte sind aber der Grund,
 * warum es den Modus gibt: dort wird die Nummer gesucht.
 *
 * Deshalb steht die Regel jetzt hier, mit Tests. Eine Auswahlregel,
 * die man nicht prüfen kann, ist eine Vermutung.
 */
export interface ListenObjekt {
  status?: string | null;
  owner_name?: string | null;
  owner_phone?: string | null;
  preselection_status?: string | null;
  is_queried?: boolean | null;
}

/** Zustände, in denen an einem Objekt nichts mehr zu tun ist. */
const ERLEDIGT = new Set([
  'Exportiert', 'Archiviert', 'Nicht interessant', 'Kein Interesse',
  'Ausgeblendet', 'Vorausgewählt',
]);

/** Was aus der Vorauswahl heraus als erledigt gilt. */
const ARCHIVIERT = new Set(['Ausschliessen', 'Kein Potenzial']);

export function gehoertInDenAkquiseModus(p: ListenObjekt): boolean {
  if (p.is_queried) return false;
  if (ERLEDIGT.has(String(p.status ?? ''))) return false;
  if (ARCHIVIERT.has(String(p.preselection_status ?? ''))) return false;

  const eigentuemer = String(p.owner_name ?? '').trim();
  const nummer = String(p.owner_phone ?? '').trim();

  // Der Fall, für den der Modus da ist: Eigentümer bekannt, Nummer
  // fehlt. Er gilt unabhängig vom Status -- der sagt nur, wie weit es
  // ist, nicht ob noch etwas zu tun wäre.
  if (eigentuemer && !nummer) return true;

  // Beides da: der Deal ist unterwegs, hier ist nichts mehr zu holen.
  if (eigentuemer && nummer) return false;

  // Ohne Eigentümer nur die unangetasteten -- alles andere steht in
  // der Übersicht und wartet auf die Abfrage.
  return ['Neu', 'Offen', ''].includes(String(p.status ?? ''));
}

/** Vorn steht, wo nur noch die Nummer fehlt. */
export function nurNummerFehlt(p: ListenObjekt): boolean {
  return !!String(p.owner_name ?? '').trim()
    && !String(p.owner_phone ?? '').trim();
}

/**
 * Was aus einer Merkliste noch abzufragen ist: ohne Eigentümer, oder
 * mit Eigentümer, aber ohne Nummer. Anders als oben zählt der Status
 * nicht -- wer eine Liste gespeichert hat, will genau diese Parzellen,
 * auch wenn eine davon schon "Vorausgewählt" heisst. Nur was
 * ausdrücklich erledigt ist, fällt weg.
 */
export function gehoertInMerklistenAbfrage(p: ListenObjekt): boolean {
  if (p.is_queried && String(p.owner_phone ?? '').trim()) return false;
  if (['Exportiert', 'Archiviert', 'Nicht interessant', 'Kein Interesse', 'Ausgeblendet'].includes(String(p.status ?? ''))) return false;
  if (!String(p.owner_name ?? '').trim()) return !p.is_queried;
  return !String(p.owner_phone ?? '').trim();
}
