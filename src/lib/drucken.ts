/**
 * Drucken bzw. als PDF sichern. Der Dateiname des PDF ist der Titel der
 * Seite -- darum für den Druck der Name des Berichts, danach wieder der
 * alte. Was gedruckt wird, bestimmt die Klasse .bericht-druck
 * (src/index.css): alles andere ist beim Drucken ausgeblendet.
 */
export function drucken(name: string) {
  const alt = document.title;
  document.title = name.trim() || 'Bericht';
  const zurueck = () => { document.title = alt; window.removeEventListener('afterprint', zurueck); };
  window.addEventListener('afterprint', zurueck);
  window.print();
}
