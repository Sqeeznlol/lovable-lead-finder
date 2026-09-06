/**
 * Ergebnisse über einen Seitenwechsel hinweg behalten.
 *
 * Die Übersicht liest bis zu vierzigtausend Zeilen und rechnet daraus
 * die Beurteilung. Das dauert, und bisher geschah es bei jedem Aufruf
 * neu -- auch wenn sich in der Zwischenzeit nichts geändert hatte.
 *
 * Abgelegt wird im sessionStorage, nicht im localStorage: die Liste
 * enthält Namen und Telefonnummern von Menschen, und die haben auf
 * einem Rechner nichts verloren, nachdem der Browser geschlossen
 * wurde. Innerhalb einer Sitzung ist der Nutzen gross, darüber hinaus
 * wäre er es nicht wert.
 */
const VORSATZ = 'bauraum.v1.';

/** Wie lange ein abgelegtes Ergebnis noch gilt. */
const HALTBAR = 30 * 60 * 1000;

interface Ablage<T> {
  zeit: number;
  wert: T;
}

export function lesen<T>(schluessel: string): T | undefined {
  try {
    const roh = sessionStorage.getItem(VORSATZ + schluessel);
    if (!roh) return undefined;
    const a = JSON.parse(roh) as Ablage<T>;
    if (Date.now() - a.zeit > HALTBAR) {
      sessionStorage.removeItem(VORSATZ + schluessel);
      return undefined;
    }
    return a.wert;
  } catch {
    // Kein Speicher, volle Ablage oder unlesbarer Inhalt: dann eben
    // ohne. Ein Zwischenspeicher darf nie der Grund sein, dass die
    // Seite nicht lädt.
    return undefined;
  }
}

export function schreiben<T>(schluessel: string, wert: T): void {
  try {
    sessionStorage.setItem(
      VORSATZ + schluessel,
      JSON.stringify({ zeit: Date.now(), wert } satisfies Ablage<T>),
    );
  } catch {
    /* siehe oben */
  }
}
