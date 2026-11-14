// Liest ÖREB-Auszüge (Version 2) der Kantone und kürzt sie auf das, was die
// Check-Seiten zeigen. Die Kantone liefern nicht gleich: die meisten das
// JSON nach Weisung ("GetExtractByIdResponse"), Nidwalden und Obwalden
// (gis-daten.ch) ein aus XML übersetztes JSON mit "LocalisedText" und
// GML-Koordinaten, Zürich "Extract" statt "extract". Gemessen am
// 13. November 2026 an Bern, St. Gallen, Stans, Aarau, Bellinzona, Chur,
// Schwyz und Fällanden.

const liste = v => (v == null ? [] : Array.isArray(v) ? v : [v]);

/** Text in Deutsch, sonst der erste vorhandene. */
export function text(v) {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    const de = v.find(x => (x?.Language ?? x?.LocalisedText?.Language) === 'de');
    return text(de ?? v[0]);
  }
  if (v.LocalisedText) return text(v.LocalisedText);
  if ('Text' in v) return text(v.Text);
  return null;
}

/** Linien aus GeoJSON oder aus GML ("geo:polyline" mit "geo:coord"). */
export function linien(g) {
  if (!g) return [];
  if (g.type === 'LineString') return [g.coordinates];
  if (g.type === 'MultiLineString') return g.coordinates;
  // Nidwalden: die Punkte stehen direkt unter "Line", ohne "polyline".
  const pl = g['geo:polyline'] ?? g.polyline ?? (g['geo:coord'] || g.coord ? g : null);
  if (pl) {
    const c = liste(pl['geo:coord'] ?? pl.coord);
    return [c.map(p => [Number(p['geo:c1'] ?? p.c1 ?? p.C1), Number(p['geo:c2'] ?? p.c2 ?? p.C2)])];
  }
  return [];
}

const ZONE = /grundnutzung|zonenplan|nutzungszonen|zonenfl|piano zone|zone d.affectation/i;
const NEBEN = /plan\b|pläne|pflicht|baulinie|gefahr|erschliess|festlegung|perimeter|comparto|leitung|wasserversorgung|gewässerraum|^keine/i;
const ORDNUNG_TITEL = /^(bau.?(und.?zonen)?ordnung|bau.?(und.?zonen)?reglement|baureglement|zonenreglement|regolamento edilizio|règlement (communal )?(sur les constructions|d.urbanisme))/i;
const ORDNUNG = /bau.?(und.?zonen)?ordnung|baureglement|zonenreglement|\bBZO\b|\bBO\b|regolamento edilizio|règlement/i;

/**
 * Der gekürzte Auszug. e, n: Punkt der Adresse in LV95; Baulinien werden
 * nur bis 150 m davon mitgegeben, sie laufen sonst durchs halbe Quartier.
 */
export function auszugKurz(json, e, n) {
  const x = json?.GetExtractByIdResponse?.extract ?? json?.GetExtractByIdResponse?.Extract ?? json?.Extract ?? json?.extract;
  if (!x) return null;
  const re = x.RealEstate ?? x.realEstate ?? {};
  const b = liste(re.RestrictionOnLandownership).map(r => ({
    code: String(r.Theme?.Code ?? r.Theme?.code ?? ''), sub: String(r.Theme?.SubCode ?? r.Theme?.subCode ?? ''), thema: text(r.Theme?.Text) ?? '',
    legende: text(r.LegendText) ?? '', flaeche: Number(r.AreaShare ?? NaN), laenge: Number(r.LengthShare ?? NaN),
    anteil: Number(r.PartInPercent ?? NaN), typ: String(r.TypeCode ?? r.typeCode ?? ''), roh: r,
  }));
  const nutzung = b.filter(r => /nutzungsplanung/i.test(r.code) && Number.isFinite(r.flaeche) && r.flaeche > 0);
  // Pläne, Pflichten und Linien decken oft auch 100 % der Parzelle (Aarau: "Erschliessungspläne",
  // Haldenstein: "Quartierplanpflicht"); die Zone erkennt man am Namen.
  // Den Ausschlag gibt der Typcode, wo er dem Bundesmodell folgt: Hauptnutzung 11 bis 49 ist
  // Grundnutzung, 5x bis 9x überlagert. Lenzburg nannte sonst die überlagernde
  // "Quartiererhaltungszone" (692401) statt "Wohnzone W2a" (112101); Zürich schreibt C110111.
  const grund = r => /^[A-Z]?[1-4][1-9]\d{2,}$/i.test(r.typ);
  const wertung = r => (ZONE.test(`${r.sub} ${r.thema}`) ? 2 : 0) + (/zone|zona\b|^grundnutzung/i.test(r.legende) ? 4 : 0)
    - (NEBEN.test(r.legende) ? 8 : 0) + (grund(r) ? 6 : 0);
  const zone = nutzung.slice().sort((u, v) => wertung(v) - wertung(u) || (v.anteil || 0) - (u.anteil || 0))[0] ?? null;
  const weitere = [...new Set(nutzung.filter(r => r !== zone && !/^keine/i.test(r.legende) && !/baulinie/i.test(r.legende)).map(r => r.legende).filter(Boolean))]
    .filter(t => t !== zone?.legende).slice(0, 4);
  const es = b.find(r => /laermempfindlichkeit/i.test(r.code))?.legende ?? null;
  const bl = b.filter(r => /baulinie/i.test(`${r.code} ${r.sub} ${r.thema} ${r.legende}`));
  const nah = p => Math.hypot(p[0] - e, p[1] - n) < 150;
  const blLinien = bl.flatMap(r => liste(r.roh.Geometry).flatMap(g => linien(g.Line ?? g.line)))
    .map(l => l.filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1])))
    .filter(l => l.some(nah))
    .map(l => l.map(([u, v]) => [Math.round(u * 10) / 10, Math.round(v * 10) / 10]));
  const doks = (zone ? liste(zone.roh.LegalProvisions) : [])
    .map(d => ({ titel: text(d.Title) ?? '', url: text(d.TextAtWeb) ?? '' }))
    .filter(d => d.url.startsWith('http'));
  // Die Ordnung selbst vor Genehmigungen, die sie nur erwähnen (Fällanden: "Genehmigung … (Teilrevision BZO)").
  const ordnung = doks.find(d => ORDNUNG_TITEL.test(d.titel)) ?? doks.find(d => ORDNUNG.test(d.titel)) ?? null;
  // Zürich schreibt "code" klein, die anderen "Code".
  const themen = k => liste(x[k]).map(t => ({ code: String(t.Code ?? t.code ?? ''), text: text(t.Text) ?? '' }));
  return {
    stand: x.CreationDate ?? null,
    zone: zone ? { text: zone.legende, anteil: Number.isFinite(zone.anteil) ? zone.anteil : null } : null,
    weitere, es,
    baulinien: bl.length ? { laenge: Math.round(bl.reduce((s, r) => s + (Number.isFinite(r.laenge) ? r.laenge : 0), 0)), linien: blLinien } : null,
    ordnung,
    betroffen: themen('ConcernedTheme'), nichtBetroffen: themen('NotConcernedTheme'),
  };
}

/** Basisadresse des Dienstes; Zug trägt dort einen ganzen Beispielaufruf ein. */
export function dienstBasis(url) {
  return String(url ?? '').replace(/\/extract.*$/, '').replace(/\/+$/, '');
}
