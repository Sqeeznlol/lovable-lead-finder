// map.geo.tg.ch — die Eigentumsauskunft des Thurgaus
//
// Parzelle suchen, Mobilnummer, SMS-Code, dann das Fenster mit den
// Eigentümern; rund zwanzig Auskünfte am Tag. Wie die Karte im
// Einzelnen gebaut ist, sieht man von aussen nicht -- deshalb keine
// Automatik, sondern der Balken aus uebernehmen.js: ein Klick, sobald
// die Auskunft offen ist.

(function () {
  const start = () => window.akquiseBalken?.(
    'Bauraum — Eigentümer übernehmen, sobald die Auskunft offen ist.');
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
  chrome.runtime.sendMessage({ type: 'PORTAL_OPENED' });
})();
