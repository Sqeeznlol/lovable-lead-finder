// Was die Zone erlaubt: Ziffern, Geschosse und Höhen je Zonenfläche.
// Kanton Zürich: OGD-WFS "ogd-0156_arv_basis_np_gn_zonenflaeche_f", ohne
// Anmeldung, die Werte stehen direkt je Fläche (geprüft 14. November 2026,
// Fällanden W1: Baumassenziffer 1.2, 1 Vollgeschoss, Fassadenhöhe 4.5 m).
export const ZH_WFS = 'https://maps.zh.ch/wfs/OGDZHWFS';
export const ZH_EBENE = 'ms:ogd-0156_arv_basis_np_gn_zonenflaeche_f';

const FELDER = {
  az: 'ausnuetzungsziffer_max', bmz: 'baumassenziffer_max', uez: 'ueberbauungsziffer_max', gruen: 'gruenflaechenziffer_min',
  frei: 'freiflaechenziffer_min', vollgeschosse: 'vollgeschosse_max', dachgeschosse: 'dachgeschosse_max', untergeschosse: 'untergeschosse_max',
  attika: 'attikageschosse', gebaeudehoehe: 'gebaeudehoehe_max', fassadenhoehe: 'fassadenhoehe', fassadenhoehe_giebel: 'fassadenhoehe_giebelseitig',
  gesamthoehe: 'gesamthoehe', firsthoehe: 'firsthoehe_max', wohnanteil: 'wohnanteil_min',
};

const PROZENT = new Set(['az', 'uez', 'gruen', 'frei', 'wohnanteil']);

/** Die erste Zonenfläche aus der GML-Antwort des Zürcher WFS, nur gefüllte Werte. */
export function zhZiffernAus(gml) {
  const blk = gml.match(/<ms:ogd-0156_arv_basis_np_gn_zonenflaeche_f\b[\s\S]*?<\/ms:ogd-0156_arv_basis_np_gn_zonenflaeche_f>/);
  if (!blk) return null;
  const f = name => { const m = blk[0].match(new RegExp(`<ms:${name}>([^<]*)</ms:${name}>`)); return m && m[1].trim() ? m[1].trim() : null; };
  const aus = { zone: f('typ_gde_bezeichnung'), kuerzel: f('typ_gde_abkuerzung'), gemeinde: f('typ_gemeindename'), quelle: 'Zonenplan Kanton Zürich' };
  let werte = 0;
  for (const [k, feld] of Object.entries(FELDER)) {
    const v = f(feld);
    const zahl = v == null ? NaN : Number(v.replace(',', '.'));
    // Manche Gemeinden führen Ziffern in Prozent (Uster W3/70G: 70 = 0.70); Baumasse ist m³/m² und bleibt.
    const prozent = PROZENT.has(k) && zahl > 3 ? zahl / 100 : zahl;
    aus[k] = Number.isFinite(prozent) && prozent > 0 ? Math.round(prozent * 1000) / 1000 : null;
    if (aus[k] != null) werte++;
  }
  return werte ? aus : null;
}
