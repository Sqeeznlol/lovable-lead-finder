/**
 * Auskunft des Grundbuchamts über das Portal Objektwesen des Kantons.
 *
 * Das Portal nennt zu einem Grundstück den eingetragenen Eigentümer -- also
 * genau die Angabe, die in den importierten Listen fehlt und ohne die kein
 * Anruf möglich ist. Adressiert wird ein Grundstück über EGRID und
 * Gemeindenummer; beides steht in der Liste, sobald die Gemeindenummer
 * nachgeschlagen ist.
 *
 * Das Portal verlangt eine Identifikation. Führt der Link auf die Anmeldung
 * statt auf das Grundstück, ist das dieser Schritt und kein defekter Link --
 * nach der Anmeldung öffnet dieselbe Adresse die Auskunft.
 */
const PORTAL = 'https://portal.objektwesen.zh.ch/aks/detail/success';

export function grundbuchUrl(
  egrid?: string | null,
  bfsNr?: string | number | null,
): string | null {
  const e = String(egrid ?? '').trim();
  const b = String(bfsNr ?? '').trim();
  if (!e || !b) return null;
  return `${PORTAL}?egrid=${encodeURIComponent(e)}&bfsNr=${encodeURIComponent(b)}`;
}

/**
 * Eigentümer, an die nicht verkauft wird und die deshalb nicht in der
 * Arbeitsliste stehen sollen.
 *
 * Die öffentliche Hand verkauft ihren Grundbesitz praktisch nie -- "Stadt
 * Winterthur, besondere Rechtsform" ist kein Gesprächspartner für einen
 * Ankauf. Wird ein solcher Eigentümer eingetragen, gehört das Objekt ins
 * Archiv statt auf die Anrufliste.
 */
export function verkauftNie(eigentuemer?: string | null): boolean {
  if (!eigentuemer) return false;
  return /\b(stadt|gemeinde|kanton|bund|eidgenossenschaft|kirchgemeinde|kirche|schulgemeinde|zweckverband|spital|universit(ä|ae)t|sbb|post\b|swisscom|armasuisse)\b/i
    .test(eigentuemer);
}

/** Kennzeichen im Bestand, mit dem ein Objekt aus den Listen verschwindet. */
export const ARCHIV_STATUS = 'Ausschliessen';
