/**
 * Fremde Seiten öffnen in einem neuen Tab, und zwar jedes Mal.
 *
 * Seit September trugen sie feste Namen ("bauraum-portal",
 * "bauraum-karte", ...), damit die Leiste nicht volläuft. Am
 * 18. November nachgemessen: nur der erste Klick öffnete einen Tab. Jeder
 * weitere Klick lud still in diesem Tab im Hintergrund, und vorne
 * geschah nichts (Julian: «uf die andere Buttons genauso nüt»). Google
 * Maps war nicht betroffen, weil Google den Namen des Tabs löscht. Ein
 * neuer Tab dagegen erscheint sofort, auf dem Computer wie auf dem
 * iPhone.
 *
 * Die Rollen bleiben als Schlüssel, damit jede Stelle sagt, was sie
 * öffnet; alle zeigen auf einen neuen Tab. Moderne Browser geben einem
 * Link mit "_blank" von selbst kein window.opener mit.
 */
export const FENSTER = {
  // Der eigene Tab behält seinen Namen (benenneEigenenTab).
  app: 'bauraum-app',
  portal: '_blank',
  karte: '_blank',
  suche: '_blank',
  // Seiten von Veranstaltern und anderen Fremden (Immo-Kalender).
  extern: '_blank',
} as const;

/**
 * Der eigene Tab bekommt einen Namen, damit ihn ein Lesezeichen der
 * Akquise wiederfindet. Ein Tab darf sich selbst benennen; genau das
 * passiert beim Start.
 */
export function benenneEigenenTab(): void {
  if (typeof window !== 'undefined' && window.name !== FENSTER.app) {
    window.name = FENSTER.app;
  }
}

/** Eine fremde Adresse aus einem Knopf heraus öffnen: neuer Tab, ohne Rückgriff auf diese Seite. */
export function oeffne(adresse: string): void {
  window.open(adresse, '_blank', 'noopener');
}
