/**
 * Zwei Tabs, nicht zwanzig.
 *
 * Jeder Aufruf mit "_blank" macht einen neuen Tab auf. Nach zehn
 * Abfragen steht die Leiste voll, und niemand weiss mehr, welcher
 * Thurgau und welcher Bauraum ist.
 *
 * Ein Fenster mit Namen dagegen wird wiederverwendet: derselbe Name
 * landet im selben Tab. Also zwei feste Namen -- einer für die
 * Anwendung, einer für das Portal des Kantons -- und die Leiste bleibt,
 * wie sie ist.
 *
 * Die Namen stehen auch im Lesezeichen; ändert man sie hier, muss man
 * sie dort mitändern (src/lib/lesezeichen.ts).
 */
export const FENSTER = {
  app: 'bauraum-app',
  portal: 'bauraum-portal',
  karte: 'bauraum-karte',
  suche: 'bauraum-suche',
  pipedrive: 'bauraum-pipedrive',
} as const;

export type Fenstername = typeof FENSTER[keyof typeof FENSTER];

/**
 * Der eigene Tab braucht auch einen Namen.
 *
 * Ein Tab heisst nur dann so, wie man ihn genannt hat, wenn er selbst
 * benannt geoeffnet wurde. Der Tab, in dem die Anwendung von Hand
 * aufgemacht wird, hat keinen -- und deshalb landete das Lesezeichen
 * jedes Mal in einem neuen "Bauraum"-Tab statt in diesem hier. Ein Tab
 * darf sich selbst benennen; genau das passiert beim Start.
 */
export function benenneEigenenTab(): void {
  if (typeof window !== 'undefined' && window.name !== FENSTER.app) {
    window.name = FENSTER.app;
  }
}

/**
 * Eine Adresse in ihrem Fenster öffnen.
 *
 * "noopener" fehlt hier mit Absicht: mit ihm gibt der Browser keinen
 * Verweis auf das Fenster zurück, und dann lässt sich nicht erkennen,
 * ob ein Sperrer den Aufruf verhindert hat. Beide Ziele sind eigene
 * Seiten, keine fremden Links.
 */
export function oeffne(adresse: string, name: Fenstername): Window | null {
  return window.open(adresse, name);
}
