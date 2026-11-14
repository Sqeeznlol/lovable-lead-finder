// Energie und Lage einer Adresse für die Check-Seiten (Julian, 14. November:
// "weitere amtliche Angaben öffentlich"). Alles vom Bund (geo.admin.ch):
// Solarpotenzial des Dachs (BFE), nächstes Wärmenetz (BFE), ÖV-Güteklasse
// (ARE), Radon (BAG). Gemessen am 14. November 2026: Die Wärmenetze sind
// Punkte der Zentralen, kein Versorgungsgebiet -- darum nur "in der Nähe".

// Klassen des Solarkatasters (BFE, sonnendach.ch), falls der Text fehlt.
const KLASSE = { 1: 'Gering', 2: 'Mittel', 3: 'Gut', 4: 'Sehr gut', 5: 'Hervorragend' };

/**
 * Solar: gezählt werden die Dachflächen ab «gut» (Klasse 3 von 5); hat das Dach keine, die
 * der besten vorhandenen Klasse. Fällanden, Sängglenstrasse 11, hat nur «mittel» -- auch das
 * ist eine Antwort für den Eigentümer.
 */
export function solarAus(flaechen) {
  const klassen = flaechen.map(a => Number(a.klasse)).filter(Number.isFinite);
  if (!klassen.length) return null;
  const ab = Math.min(3, Math.max(...klassen));
  const gut = flaechen.filter(a => Number(a.klasse) >= ab);
  const beste = gut.reduce((b, a) => (Number(a.klasse) > Number(b.klasse) ? a : b));
  return {
    kwh: Math.round(gut.reduce((s, a) => s + (Number(a.stromertrag) || 0), 0)),
    flaeche: Math.round(gut.reduce((s, a) => s + (Number(a.flaeche) || 0), 0)),
    eignung: String(beste.klasse_text ?? '').split('##')[0] || KLASSE[Number(beste.klasse)] || `Klasse ${beste.klasse}`,
  };
}

/** Das nächste Wärmenetz aus Treffern mit Geometrie (Punkt in LV95). */
export function waermenetzAus(treffer, e, n) {
  const mit = treffer.map(t => {
    const c = t.geometry?.coordinates ?? (t.geometry ? [t.geometry.x, t.geometry.y] : null);
    const a = t.properties ?? t.attributes ?? {};
    return c ? { a, m: Math.round(Math.hypot(c[0] - e, c[1] - n)) } : null;
  }).filter(Boolean).sort((x, y) => x.m - y.m)[0];
  if (!mit) return null;
  return { name: mit.a.name ?? null, betreiber: mit.a.operator ?? null, telefon: mit.a.phone ?? null, web: mit.a.web ?? null, meter: mit.m };
}
