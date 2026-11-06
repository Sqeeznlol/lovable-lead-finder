/**
 * Die Liegenschaftsliste eines Fonds beim Bund auflösen.
 *
 *   node tools/fondsliste_aufloesen.cjs <liste.json> <ausgabeordner>
 *
 * liste.json kommt aus der Excel des Kunden (openpyxl, siehe
 * docs/nacht.md "Erster Kunde"): { kopf: [...], zeilen: [{ zeile, werte:
 * [Nr, Gefäss, Strasse/Nr, PLZ, Ort, Kanton] }] }. Für jede Zeile:
 * Adresse -> Eingänge (SearchServer) -> Gebäude (GWR) -> Parzelle der
 * Amtlichen Vermessung (Mitte, Fläche, Nachbarn). Schreibt ergebnis.json
 * (für tools/fondsliste_migration.cjs) und bericht.txt zum Gegenlesen --
 * den Bericht ganz lesen, nicht nur die Zusammenfassung.
 *
 * Warum so und nicht einfach "Adresse suchen":
 *   * Bereiche wie "18-24" meinen in der Schweiz die eine Strassenseite;
 *     die andere Seite gehört nur dazu, wenn ihr Haus auf derselben
 *     Parzelle steht (Standweg 1-6 ist ein Grundstück, Hof 23 neben
 *     Hof 20-44 ein fremdes Einfamilienhaus).
 *   * Der GWR-Dienst sucht "enthält": 346701 traf zuerst 502346701 in
 *     einem anderen Kanton. Nur der exakte EGID zählt.
 *   * Gleicher Strassenname in zwei Ortschaften derselben PLZ (Erlen und
 *     Engishofen): es zählt die Ortschaft der Liste.
 *   * Fehlt die blanke Nummer, zählen ihre Buchstaben ("Av. Gare 2" steht
 *     beim Bund als 2a und 2b).
 *   * Polygone mit Löchern und mit tausend Ecken lehnt der Dienst ab:
 *     nur Aussenringe, bei Bedarf ausgedünnt.
 *
 * Im Sandkasten läuft fetch nur mit NODE_USE_ENV_PROXY=1 über den Proxy.
 */
const fs = require('fs');
const path = require('path');
const API = 'https://api3.geo.admin.ch/rest/services';
const EBENE = 'ch.kantone.cadastralwebmap-farbe';
const EGRID = /^CH[0-9A-Z]{12}$/;
const [, , listePfad, HIER] = process.argv;
if (!listePfad || !HIER) { console.error('Aufruf: node tools/fondsliste_aufloesen.cjs <liste.json> <ausgabeordner>'); process.exit(1); }
fs.mkdirSync(HIER, { recursive: true });
const liste = JSON.parse(fs.readFileSync(listePfad, 'utf8'));
const KANTON = { 'Bern': 'BE', 'Luzern': 'LU', 'Solothurn': 'SO', 'St. Gallen': 'SG', 'Thurgau': 'TG', 'Aargau': 'AG',
  'Basel-Land': 'BL', 'Basel-Stadt': 'BS', 'Fribourg': 'FR', 'Schaffhausen': 'SH', 'Valais': 'VS', 'Zürich': 'ZH' };

let anfragen = 0;
async function hole(url, versuch = 0, body = null) {
  anfragen++;
  try {
    const r = await fetch(url, body == null ? { signal: AbortSignal.timeout(40000) }
      : { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(40000) });
    if (!r.ok) { if (process.env.LAUT) console.log('FEHLER', r.status, url.slice(0, 160), 'Länge', url.length); throw new Error('HTTP ' + r.status); }
    return await r.json();
  } catch (e) {
    if (versuch < 2 && !/HTTP 4/.test(e.message)) { await new Promise(w => setTimeout(w, 1500 * (versuch + 1))); return hole(url, versuch + 1, body); }
    throw e;
  }
}

function norm(s) {
  return String(s ?? '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// "18-24" -> 18..24; "7a-11b" -> 7,7a,7b,...; "5a-b" -> 5,5a,5b; "16a" -> 16a
function bereich(s) {
  const m = s.match(/^(\d+)([a-z]?)\s*-\s*(?:(\d+))?([a-z]?)$/i);
  if (!m) { const e = s.match(/^(\d+)\s*([a-z]?)$/i); return e ? [{ nr: e[1] + e[2].toLowerCase() }] : []; }
  const von = +m[1], bis = m[3] ? +m[3] : von;
  const ba = m[2].toLowerCase(), bb = m[4].toLowerCase();
  // "18-24" meint in der Schweiz die eine Strassenseite: gleiche Parität
  // wie die Enden. "1-6" (verschiedene Parität) meint alle Nummern.
  const seite = bis > von && (von % 2) === (bis % 2);
  const aus = [];
  for (let i = von; i <= bis; i++) {
    const anderesUfer = seite && (i % 2) !== (von % 2);
    // "7a-11b": die blanke 7 liegt vor dem Anfang.
    if (!(ba && i === von)) aus.push({ nr: String(i), anderesUfer });
    if (ba || bb) {
      const a0 = ba || 'a', b0 = bb || ba;
      for (let c = a0.charCodeAt(0); c <= b0.charCodeAt(0); c++) aus.push({ nr: String(i) + String.fromCharCode(c), anderesUfer });
    }
  }
  const gesehen = new Set();
  return aus.filter(x => !gesehen.has(x.nr) && gesehen.add(x.nr));
}

// "Bahnhofstrasse 36/38/Zelgstrasse 35/37/39" -> [{strasse, nummern}]
function gruppen(feld) {
  const aus = []; let akt = null;
  for (const t of feld.split(/\s*[,/+]\s*/).map(x => x.trim()).filter(Boolean)) {
    const m = t.match(/^(.*?[^\d\s])\s+(\d.*)$/);
    if (m && !/^[a-z]$/i.test(m[1])) {
      akt = { strasse: m[1].trim(), nummern: bereich(m[2]) }; aus.push(akt);
    } else if (/^\d/.test(t)) {
      if (!akt) { akt = { strasse: null, nummern: [] }; aus.push(akt); }
      akt.nummern.push(...bereich(t));
    } else if (/^[a-z]$/i.test(t)) {
      if (akt && akt.nummern.length) {
        const letzte = akt.nummern[akt.nummern.length - 1];
        akt.nummern.push({ nr: letzte.nr.replace(/[a-z]$/i, '') + t.toLowerCase() });
      }
    } else {
      aus.push({ strasse: t, nummern: [], ohneNummer: true }); akt = null;
    }
  }
  return aus;
}

// Strassenname des Kunden gegen den des Bundes: gleich ohne Leerzeichen
// ("Lyss-Strasse" / "Lyssstrasse") oder Wort für Wort als Anfang ("Av. Gare" / "Avenue de la Gare").
function strasseGleich(kunde, bund) {
  const k = norm(kunde), b = norm(bund);
  if (!k || !b) return false;
  if (k.replace(/ /g, '') === b.replace(/ /g, '')) return true;
  const kw = k.split(' '), bw = b.split(' ');
  let j = 0;
  for (const w of kw) {
    while (j < bw.length && !bw[j].startsWith(w)) j++;
    if (j >= bw.length) return false;
    j++;
  }
  return true;
}

async function sucheAdresse(strasse, nr, plz, ort) {
  const text = `${strasse} ${nr} ${plz} ${ort}`;
  const j = await hole(`${API}/ech/SearchServer?type=locations&origins=address&limit=10&sr=2056&lang=de&searchText=${encodeURIComponent(text)}`);
  const treffer = [];
  const lies = (variante) => {
    for (const r of j?.results ?? []) {
      const a = r.attrs ?? {};
      const detail = String(a.detail ?? '');
      // detail: "neubrueckstrasse 18 2555 bruegg be 733 bruegg ch be"
      const m = detail.match(/^(.*?) (\d+[a-z]?) (\d{4}) /);
      if (!m) continue;
      const [, bStrasse, bNr, bPlz] = m;
      const passt = variante ? new RegExp('^' + nr.toLowerCase() + '[a-z]$').test(bNr) : bNr === nr.toLowerCase();
      if (!passt || bPlz !== String(plz)) continue;
      if (!strasseGleich(strasse, bStrasse)) continue;
      const fid = String(a.featureId ?? '');
      const egid = Number(fid.split('_')[0]);
      if (!egid) continue;
      treffer.push({ text: `${strasse} ${nr}`, label: String(a.label ?? '').replace(/<[^>]+>/g, ''), featureId: fid, egid, e: Number(a.y), n: Number(a.x), variante });
    }
  };
  lies(false);
  // Fehlt die blanke Nummer, zählen ihre Buchstaben: "Av. Gare 2" steht beim Bund als 2a und 2b.
  if (!treffer.length && /^\d+$/.test(nr)) lies(true);
  return { text, treffer, roh: (j?.results ?? []).slice(0, 3).map(r => String(r.attrs?.label ?? '').replace(/<[^>]+>/g, '')) };
}

async function gwr(egid) {
  const j = await hole(`${API}/ech/MapServer/find?layer=ch.bfs.gebaeude_wohnungs_register&searchField=egid&searchText=${egid}&contains=false&returnGeometry=false&sr=2056&lang=de`);
  // Der Dienst sucht trotz contains=false gern "enthält": nur der exakte EGID zählt.
  const a = (j?.results ?? []).map(r => r.attributes).find(x => Number(x?.egid) === Number(egid));
  if (!a) return null;
  return { egid, egrid: a.egrid ?? null, gemeinde: a.ggdename ?? null, kanton: a.gdekt ?? null, baujahr: a.gbauj ?? null,
    geschosse: a.gastw ?? null, wohnungen: a.ganzwhg ?? null, grundflaeche: a.garea ?? null, heizung: a.genh1 ?? null,
    waermeerzeuger: a.gwaerzh1 ?? null, e: a.gkode ?? null, n: a.gkodn ?? null, adresse: a.strname_deinr ?? null, plz: a.dplz4 ?? null, ort: a.dplzname ?? null };
}

async function egridAmPunkt(e, n) {
  const p = new URLSearchParams({ geometryType: 'esriGeometryPoint', geometry: `${e},${n}`, sr: '2056', tolerance: '0',
    returnGeometry: 'false', layers: `all:${EBENE}`, mapExtent: `${e - 100},${n - 100},${e + 100},${n + 100}`, imageDisplay: '400,400,96', lang: 'de' });
  const j = await hole(`${API}/all/MapServer/identify?${p}`);
  const g = String(j?.results?.[0]?.attributes?.egris_egrid ?? '');
  return EGRID.test(g) ? g : null;
}

function mitteUndFlaeche(ringe) {
  const r = ringe[0];
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
    a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f;
  }
  // Löcher (weitere Ringe) von der Fläche abziehen
  let loch = 0;
  for (const h of ringe.slice(1)) {
    let b = 0;
    for (let i = 0, j = h.length - 1; i < h.length; j = i++) b += h[j][0] * h[i][1] - h[i][0] * h[j][1];
    loch += Math.abs(b) / 2;
  }
  if (Math.abs(a) < 1e-9) return { e: r.reduce((s, p) => s + p[0], 0) / r.length, n: r.reduce((s, p) => s + p[1], 0) / r.length, flaeche: 0 };
  return { e: cx / (3 * a), n: cy / (3 * a), flaeche: Math.abs(a) / 2 - loch };
}

async function parzelle(egrid) {
  const f = new URLSearchParams({ layer: EBENE, searchField: 'egris_egrid', searchText: egrid, contains: 'false',
    returnGeometry: 'true', geometryFormat: 'geojson', sr: '2056' });
  const j = await hole(`${API}/all/MapServer/find?${f}`);
  const t = j?.results?.[0];
  const g = t?.geometry;
  if (!g) return null;
  const ringe = g.type === 'Polygon' ? g.coordinates : g.coordinates.flat();
  // Bei mehreren Teilflächen (MultiPolygon) zählt die Summe
  let gesamt = 0; let mitte = null;
  const teile = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  const mf = teile.map(mitteUndFlaeche);
  gesamt = mf.reduce((s, x) => s + x.flaeche, 0);
  mitte = mf.reduce((b, x) => (!b || x.flaeche > b.flaeche ? x : b), null);
  const p = ringe.flat(); const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
  let vereinfacht = 0;
  const q = new URLSearchParams({ geometry: JSON.stringify({ rings: ringe }), geometryType: 'esriGeometryPolygon', sr: '2056',
    tolerance: '0', returnGeometry: 'false', layers: `all:${EBENE}`,
    mapExtent: [Math.min(...xs) - 50, Math.min(...ys) - 50, Math.max(...xs) + 50, Math.max(...ys) + 50].join(','),
    imageDisplay: '600,600,96', lang: 'de' });
  // Der Dienst nimmt nur GET; ein Polygon mit tausend Ecken sprengt die
  // Adresse (HTTP 400). Dann jede k-te Ecke behalten -- die Nachbarn
  // berühren den Umriss auch so, bis auf schmale Zwickel.
  // Nur die Aussenringe: mit Löchern antwortet der Dienst "Please provide
  // a valid geometry" (400); die eingeschlossene Parzelle liegt im
  // Umriss und wird so trotzdem als Nachbar gefunden.
  const aussen = teile.map(t => t[0]);
  let ij;
  for (let k = 1; ; k++) {
    const grob = aussen.map(r => { const a = r.filter((_, i) => i % k === 0 || i === r.length - 1); return a.length >= 4 ? a : r; });
    q.set('geometry', JSON.stringify({ rings: grob }));
    const url = `${API}/all/MapServer/identify?${q}`;
    if (url.length > 6000 && k < 50) continue;
    ij = await hole(url);
    if (k > 1) vereinfacht = k;
    break;
  }
  const nachbarn = [...new Set((ij?.results ?? []).map(x => String(x.attributes?.egris_egrid ?? '')).filter(x => EGRID.test(x) && x !== egrid))];
  return { egrid, nummer: t.attributes?.number ?? null, e: Math.round(mitte.e * 10) / 10, n: Math.round(mitte.n * 10) / 10,
    flaeche: Math.round(gesamt), teile: teile.length, ecken: p.length, vereinfacht, nachbarn };
}

async function parallel(liste, n, f) {
  const aus = new Array(liste.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < liste.length) { const k = i++; aus[k] = await f(liste[k], k); } }));
  return aus;
}

(async () => {
  const start = Date.now();
  const nur = process.env.NUR ? new Set(process.env.NUR.split(',').map(Number)) : null;
  const zeilen = liste.zeilen.filter(z => !nur || nur.has(Number(z.werte[0]))).map(z => ({ nr: z.werte[0], gefaess: z.werte[1], feld: z.werte[2], plz: String(z.werte[3]), ort: z.werte[4], kanton: z.werte[5] }));
  const ergebnis = [];
  for (const z of zeilen) {
   try {
    const gr = gruppen(z.feld);
    const kandidaten = [];
    for (const g of gr) if (g.strasse && !g.ohneNummer) for (const k of g.nummern) kandidaten.push({ strasse: g.strasse, nr: k.nr, anderesUfer: !!k.anderesUfer });
    const suchen = await parallel(kandidaten, 4, k => sucheAdresse(k.strasse, k.nr, z.plz, z.ort));
    let eingaenge = []; const fehl = []; const ausgeschlossen = [];
    suchen.forEach((s, i) => { if (s.treffer.length) eingaenge.push(...s.treffer.map(t => ({ ...t, anderesUfer: kandidaten[i].anderesUfer }))); else fehl.push({ ...kandidaten[i], bund: s.roh }); });
    // Derselbe Strassenname in zwei Ortschaften derselben PLZ (Erlen und
    // Engishofen, beide 8586): es zählt die Ortschaft der Liste, sobald
    // sie bei einem Eingang vorkommt.
    const ortNorm = norm(z.ort).replace(/ (lu|sg|vs|be|zh|tg|ag|so|bl|bs|fr|sh)$/, '');
    const imOrt = e => norm(e.label).includes(ortNorm);
    if (eingaenge.some(imOrt)) {
      for (const e of eingaenge.filter(e => !imOrt(e))) ausgeschlossen.push({ ...e, grund: 'andere Ortschaft' });
      eingaenge = eingaenge.filter(imOrt);
    }
    const egids = [...new Set(eingaenge.map(e => e.egid))];
    let gebaeude = (await parallel(egids, 4, gwr)).filter(Boolean);
    for (const gb of gebaeude) if (!gb.egrid && gb.e && gb.n) { gb.egrid = await egridAmPunkt(gb.e, gb.n); gb.egridHerkunft = 'punkt'; }
    // Das andere Ufer der Strasse gehört nur dazu, wenn sein Haus auf
    // einer Parzelle der eigenen Seite steht (Standweg 1-6: ein Grundstück).
    const egridVon = new Map(gebaeude.map(g => [g.egid, g.egrid]));
    const kern = new Set(eingaenge.filter(e => !e.anderesUfer).map(e => egridVon.get(e.egid)).filter(Boolean));
    for (const e of eingaenge.filter(e => e.anderesUfer && !kern.has(egridVon.get(e.egid)))) ausgeschlossen.push({ ...e, grund: 'andere Strassenseite, eigene Parzelle' });
    eingaenge = eingaenge.filter(e => !e.anderesUfer || kern.has(egridVon.get(e.egid)));
    const bleibt = new Set(eingaenge.map(e => e.egid));
    gebaeude = gebaeude.filter(g => bleibt.has(g.egid));
    const egrids = [...new Set(gebaeude.map(g => g.egrid).filter(x => x && EGRID.test(x)))];
    const parzellen = (await parallel(egrids, 3, parzelle)).filter(Boolean);
    // Hauptparzelle: die mit den meisten Gebäuden der Zeile; bei Gleichstand die des ersten Eingangs
    const zaehl = new Map();
    for (const gb of gebaeude) if (gb.egrid) zaehl.set(gb.egrid, (zaehl.get(gb.egrid) ?? 0) + 1);
    const ersteEgrid = gebaeude.find(gb => gb.egid === eingaenge[0]?.egid)?.egrid ?? null;
    let haupt = null;
    for (const p of parzellen) if (!haupt || zaehl.get(p.egrid) > zaehl.get(haupt.egrid) || (zaehl.get(p.egrid) === zaehl.get(haupt.egrid) && p.egrid === ersteEgrid)) haupt = p;
    const gemeinden = [...new Set(gebaeude.map(g => g.gemeinde).filter(Boolean))];
    const kantone = [...new Set(gebaeude.map(g => g.kanton).filter(Boolean))];
    const plzs = [...new Set(gebaeude.map(g => g.plz).filter(Boolean).map(String))];
    const warnungen = [];
    if (!eingaenge.length) warnungen.push('keine Adresse gefunden');
    if (fehl.length) warnungen.push(`${fehl.length} von ${kandidaten.length} Hausnummern nicht gefunden`);
    if (kantone.length && !kantone.includes(KANTON[z.kanton])) warnungen.push(`Kanton Bund ${kantone.join('/')} statt ${KANTON[z.kanton]}`);
    if (plzs.length && !plzs.includes(z.plz)) warnungen.push(`PLZ Bund ${plzs.join('/')} statt ${z.plz}`);
    if (gr.some(g => g.ohneNummer)) warnungen.push('Strasse ohne Nummer: ' + gr.filter(g => g.ohneNummer).map(g => g.strasse).join(', '));
    if (parzellen.length > 1) warnungen.push(`${parzellen.length} Parzellen`);
    if (ausgeschlossen.length) warnungen.push(`${ausgeschlossen.length} Eingänge ausgeschlossen`);
    const r = { ...z, gruppen: gr, kandidaten: kandidaten.length, eingaenge, fehl, ausgeschlossen, gebaeude, parzellen, haupt: haupt ? haupt.egrid : null,
      gemeinde: gemeinden.join(' / ') || null, kantonBund: kantone.join('/') || null,
      flaeche: parzellen.reduce((s, p) => s + p.flaeche, 0) || null,
      wohnungen: gebaeude.reduce((s, g) => s + (Number(g.wohnungen) || 0), 0) || null,
      baujahr: gebaeude.map(g => Number(g.baujahr)).filter(Boolean).sort((a, b) => a - b)[0] ?? null,
      warnungen };
    ergebnis.push(r);
    console.log(`${String(z.nr).padStart(2)} ${z.feld} | ${z.plz} ${z.ort}: ${eingaenge.length}/${kandidaten.length} Eingänge, ${gebaeude.length} Gebäude, ${parzellen.length} Parzellen${haupt ? ' (' + haupt.egrid + ', ' + haupt.flaeche + ' m²)' : ''}${warnungen.length ? ' !! ' + warnungen.join('; ') : ''}`);
   } catch (e) {
    ergebnis.push({ ...z, fehler: String(e && e.message || e), eingaenge: [], fehl: [], ausgeschlossen: [], gebaeude: [], parzellen: [], haupt: null, warnungen: ['FEHLER ' + String(e && e.message || e)], kandidaten: 0 });
    console.log(`${String(z.nr).padStart(2)} ${z.feld}: FEHLER ${e && e.message}`);
   }
  }
  if (nur) {
    const alt = JSON.parse(fs.readFileSync(path.join(HIER, 'ergebnis.json'), 'utf8'));
    for (const r of ergebnis) { const i = alt.findIndex(x => x.nr === r.nr); if (i >= 0) alt[i] = r; else alt.push(r); }
    alt.sort((a, b) => a.nr - b.nr);
    ergebnis.length = 0; ergebnis.push(...alt);
  }
  fs.writeFileSync(path.join(HIER, 'ergebnis.json'), JSON.stringify(ergebnis, null, 1));
  const bericht = [];
  for (const r of ergebnis) {
    bericht.push(`${r.nr}. ${r.feld}, ${r.plz} ${r.ort} (${r.kanton}) -- ${r.gefaess}`);
    bericht.push(`   Eingänge ${r.eingaenge.length}/${r.kandidaten}: ${r.eingaenge.map(e => e.label).join(' | ')}`);
    if (r.fehl.length) bericht.push(`   nicht gefunden: ${r.fehl.map(f => f.strasse + ' ' + f.nr + ' -> ' + f.bund.join(' / ')).join(' || ')}`);
    if (r.ausgeschlossen?.length) bericht.push(`   ausgeschlossen: ${r.ausgeschlossen.map(a => a.label + ' (' + a.grund + ')').join(' | ')}`);
    bericht.push(`   Gebäude: ${r.gebaeude.map(g => `${g.egid} ${g.adresse ?? ''} ${g.plz ?? ''} ${g.ort ?? ''} (${g.egrid ?? 'ohne EGRID'}${g.egridHerkunft ? '/' + g.egridHerkunft : ''}, Bj ${g.baujahr ?? '?'}, ${g.wohnungen ?? '?'} Whg, ${g.geschosse ?? '?'} Gesch.)`).join(' | ')}`);
    bericht.push(`   Parzellen: ${r.parzellen.map(p => `${p.egrid} Nr. ${p.nummer ?? '?'} ${p.flaeche} m² (${p.e}/${p.n}, ${p.nachbarn.length} Nachbarn${p.teile > 1 ? ', ' + p.teile + ' Teile' : ''})`).join(' | ')}`);
    bericht.push(`   Haupt ${r.haupt ?? '-'}, Gemeinde ${r.gemeinde ?? '-'}, Kanton ${r.kantonBund ?? '-'}, Fläche ${r.flaeche ?? '-'} m², ${r.wohnungen ?? '-'} Whg, Baujahr ab ${r.baujahr ?? '-'}${r.warnungen.length ? '\n   !! ' + r.warnungen.join('; ') : ''}`);
    bericht.push('');
  }
  fs.writeFileSync(path.join(HIER, 'bericht.txt'), bericht.join('\n'));
  console.log(`Fertig: ${ergebnis.length} Zeilen, ${anfragen} Anfragen, ${Math.round((Date.now() - start) / 1000)} s`);
})().catch(e => { console.error('ABBRUCH', e); process.exit(1); });
