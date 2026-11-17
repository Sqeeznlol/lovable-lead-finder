/**
 * Der Verkaufspreis je m², hergeleitet aus den Preisen der letzten Jahre,
 * mit Begründung (Julian, 17. November: «Die Preise stimmen nicht ...
 * schaue genau alle Preise an, die letzten paar Jahre, und begründe es
 * auch»).
 *
 * Bis dahin rechnete die Seite in der Stadt Zürich mit dem Mittel der
 * Neubauten der ganzen Stadt und sonst mit einer Annahme (CHF 9'500).
 * Die Quartiere der Stadt liegen aber zwischen CHF 13'300 und 24'400 je
 * m² (2023 bis 2025), und Kilchberg bei über 20'000.
 *
 * Die Zahlen kommen aus public/preise-reihen.json (tools/preise_reihen.py).
 * Wie gerechnet wird, steht in den Sätzen, die diese Datei zurückgibt.
 */

/** [Jahr, Median je Wohnung, Q25, Q75, Verkäufe, Zeitraum] */
export type ObjektJahr = [number, number, number | null, number | null, number | null, string];
/** [Jahr, Median je m², Q25, Q75, Fälle, Zeitraum, «bezahlt» oder «modell»] */
export type LandJahr = [number, number, number | null, number | null, number | null, string, string];
/** [Jahr, Preis je m², Verkäufe] */
export type RaumJahr = [number, number, number];
/** [Jahr, Median, Verkäufe] -- beim Bauland statt des Jahres der Zeitraum («2021-2025»). */
export type RegionJahr = [number | string, number, number | null];

export interface PreisReihen {
  stand: number;
  quellen: { kanton: string; stadt: string; register: string };
  eichung: { faktor: number; verkauft: number; register: number; jahre: string };
  regionen: { stwe: Record<string, RegionJahr[]>; efh: Record<string, RegionJahr[]>; land: Record<string, RegionJahr[]> };
  zuerich: {
    raum: Record<string, RaumJahr[]>;
    /** [Jahr, je m², je Wohnung, Verkäufe] */
    gesamt: [number, number, number, number][];
    neubau: [number, number, number, number][];
  };
  gemeinden: Record<string, {
    name?: string; region?: string;
    /** [Median der Wohnfläche in Mehrfamilienhäusern ab 1980, Anzahl Wohnungen] */
    flaeche?: [number, number];
    stwe?: ObjektJahr[]; efh?: ObjektJahr[]; land?: LandJahr[];
  }>;
}

export interface VerlaufZeile {
  jahr: number;
  /** Median je Wohnung, mit Zeitraum, wenn mehrere Jahre zusammengefasst sind. */
  wohnung?: number | null; wohnungN?: number | null; wohnungZeit?: string;
  /** Preis je m² Wohnfläche: amtlich (Stadt Zürich) oder berechnet. */
  m2?: number | null;
  land?: number | null; landArt?: string;
  haus?: number | null;
}

export interface Herleitung {
  /** Der Verkaufspreis je m², gerundet auf 50. */
  m2: number;
  /** Die mittlere Hälfte der Verkäufe, je m² (nur wo der Kanton Quartile nennt). */
  spanne: [number, number] | null;
  art: 'amtlich' | 'berechnet';
  /** Kurz, für die Zeile unter dem Verkaufserlös. */
  kurz: string;
  /** Die Begründung, Satz für Satz, jede Zahl mit Herkunft. */
  saetze: string[];
  verlauf: VerlaufZeile[];
  /** Überschriften der Tabelle: in der Stadt Zürich gilt der Preis je m² dem Quartier, der Rest der ganzen Stadt. */
  spalten: Spalten;
}
export interface Spalten { m2: string; wohnung: string; land: string; haus?: string }

const de = (n: number, stellen = 0) => n.toLocaleString('de-CH', { maximumFractionDigits: stellen, minimumFractionDigits: stellen });
const chf = (n: number) => `CHF ${de(Math.round(n))}`;
const auf50 = (n: number) => Math.round(n / 50) * 50;
const prozent = (x: number) => de(x * 100, 1);

/**
 * Jährliche Veränderung, aus allen Jahren geschätzt (Gerade durch die
 * Logarithmen): ein einzelnes Jahr reisst sonst den Trend mit. Gemessen am
 * 17. November: die Seegemeinden sprangen von 2024 auf 2025 um 13.6 %, im
 * Schnitt der zehn Jahre um 3.7 % pro Jahr.
 */
export function trend(reihe: [number, number][], von: number, bis: number): number | null {
  const p = reihe.filter(([j, m]) => j >= von && j <= bis && m > 0).map(([j, m]) => [j, Math.log(m)] as const);
  if (p.length < 4) return null;
  const mx = p.reduce((s, [j]) => s + j, 0) / p.length, my = p.reduce((s, [, y]) => s + y, 0) / p.length;
  const nenner = p.reduce((s, [j]) => s + (j - mx) ** 2, 0);
  return nenner ? Math.exp(p.reduce((s, [j, y]) => s + (j - mx) * (y - my), 0) / nenner) - 1 : null;
}

const zeitraum = (z: string): [number, number] => {
  const j = z.match(/\d{4}/g)?.map(Number) ?? [];
  return [Math.min(...j), Math.max(...j)];
};
const zusammengefasst = (z: string) => /\d{4}\D+\d{4}/.test(z);

/** Die Zahlen der letzten Jahre einer Gemeinde, für die Tabelle auf der Seite. */
export function verlaufGemeinde(r: PreisReihen, bfs: string, geteilt: number | null, von = r.stand - 10): VerlaufZeile[] {
  const g = r.gemeinden[bfs];
  if (!g) return [];
  const aus: VerlaufZeile[] = [];
  for (let j = r.stand; j >= von; j--) {
    const w = g.stwe?.find(x => x[0] === j), l = g.land?.find(x => x[0] === j), h = g.efh?.find(x => x[0] === j);
    if (!w && !l && !h) continue;
    aus.push({
      jahr: j,
      wohnung: w?.[1] ?? null, wohnungN: w?.[4] ?? null, wohnungZeit: w && zusammengefasst(w[5]) ? w[5] : undefined,
      m2: w && geteilt ? auf50(w[1] / geteilt) : null,
      land: l?.[1] ?? null, landArt: l ? (l[6] === 'modell' ? 'Modell' : zusammengefasst(l[5]) ? l[5] : undefined) : undefined,
      haus: h?.[1] ?? null,
    });
  }
  return aus;
}

/**
 * Ausserhalb der Stadt Zürich: Preis je Wohnung (Kanton) geteilt durch die
 * Fläche der verkauften Wohnungen (Register, geeicht an der Stadt).
 */
function gemeinde(r: PreisReihen, bfs: string): Herleitung | null {
  const g = r.gemeinden[bfs];
  if (!g?.stwe?.length || !g.flaeche || !g.region) return null;
  const name = g.name ?? 'der Gemeinde';
  const region = r.regionen.stwe[g.region];
  const t = region ? trend(region.filter((x): x is [number, number, number | null] => typeof x[0] === 'number').map(x => [x[0], x[1]]), r.stand - 10, r.stand) : null;
  if (t == null) return null;
  const frisch = g.stwe.filter(w => w[0] > r.stand - 3);
  const einzeln = frisch.filter(w => !zusammengefasst(w[5]) && (w[4] ?? 0) > 0);
  // Zwei Jahre mit eigenem Median genügen; sonst der jüngste zusammengefasste Wert.
  const teile = einzeln.length >= 2
    ? einzeln.map(w => ({ wert: w[1] * (1 + t) ** (r.stand - w[0]), n: w[4]!, w }))
    : frisch.length ? [frisch[0]].map(w => { const [a, b] = zeitraum(w[5]); return { wert: w[1] * (1 + t) ** (r.stand - (a + b) / 2), n: w[4] ?? 1, w }; }) : [];
  if (!teile.length) return null;
  const n = teile.reduce((s, x) => s + x.n, 0);
  const wohnung = teile.reduce((s, x) => s + x.wert * x.n, 0) / n;
  const flaeche = g.flaeche[0] * r.eichung.faktor;
  const m2 = auf50(wohnung / flaeche);
  const neu = g.stwe[0];
  const spanne: [number, number] | null = neu[2] && neu[3] ? [auf50(neu[2] / flaeche), auf50(neu[3] / flaeche)] : null;
  const liste = teile.map(x => `${x.w[0] === r.stand || !zusammengefasst(x.w[5]) ? x.w[0] : x.w[5]} ${chf(x.w[1])} (${de(x.n)} Verkäufe)`).join(', ');
  const saetze = [
    `Eigentumswohnungen in ${name}, Median je Wohnung laut Handänderungsstatistik des Kantons: ${liste}.`,
    teile.length > 1
      ? `Ein einzelnes Jahr schwankt mit der Grösse der verkauften Wohnungen. Darum zählen ${teile.length} Jahre, jedes mit dem Trend der ${g.region} (${prozent(t)} % pro Jahr seit ${r.stand - 10}) auf ${r.stand} gebracht und nach Verkäufen gewichtet: ${chf(Math.round(wohnung / 1000) * 1000)} je Wohnung.`
      : `Mit dem Trend der ${g.region} (${prozent(t)} % pro Jahr seit ${r.stand - 10}) auf ${r.stand} gebracht: ${chf(Math.round(wohnung / 1000) * 1000)} je Wohnung.`,
    `Eine Wohnung in einem Mehrfamilienhaus ab 1980 hat in ${name} im Median ${de(g.flaeche[0])} m² (${de(g.flaeche[1])} Wohnungen im Gebäuderegister). In der Stadt Zürich, wo Preis je Wohnung und je m² amtlich sind, waren die verkauften Wohnungen ${r.eichung.jahre.replace('-', ' bis ')} ${prozent(r.eichung.faktor - 1)} % grösser als dieser Median: also ${de(flaeche, 1)} m².`,
    `Daraus CHF ${de(m2)} je m² Wohnfläche.${spanne ? ` Die mittlere Hälfte der Verkäufe ${neu[0] === r.stand ? r.stand : neu[5]} lag bei CHF ${de(spanne[0])} bis ${de(spanne[1])} je m².` : ''}`,
    ...neubauSatz(r),
  ];
  return { m2, spanne, art: 'berechnet', kurz: `berechnet aus den Verkäufen in ${name} ${r.stand - 2} bis ${r.stand}`, saetze, verlauf: verlaufGemeinde(r, bfs, flaeche),
    spalten: { wohnung: 'Wohnung, Median', m2: 'je m², berechnet', land: 'Bauland je m²', haus: 'Einfamilienhaus' } };
}

/** Ob Neubauten mehr kosten, zeigt nur die Stadt Zürich. */
function neubauSatz(r: PreisReihen): string[] {
  const q = r.zuerich.neubau.filter(x => x[0] > r.stand - 5).map(x => {
    const g = r.zuerich.gesamt.find(y => y[0] === x[0]);
    return g ? x[1] / g[1] : null;
  }).filter((x): x is number => x != null);
  if (!q.length) return [];
  return [`Ob Neubauten mehr bringen: in der Stadt Zürich kosteten sie je m² ${r.stand - 4} bis ${r.stand} zwischen ${de(Math.min(...q) * 100)} und ${de(Math.max(...q) * 100)} % des Durchschnitts aller Wohnungen. Darum ohne Zuschlag.`];
}

export interface Quartier { qname: string; knr: number }

function quartierZuKlein(r: PreisReihen, qname: string, statt: string): string {
  const n = Math.round((r.zuerich.raum[qname] ?? []).filter(x => x[0] > r.stand - 3).reduce((s, x) => s + x[2], 0));
  return `Im Quartier ${qname} gab es ${r.stand - 2} bis ${r.stand} ${n ? `nur ${de(n)} Verkäufe` : 'keine Verkäufe'}: zu wenige für einen eigenen Wert, darum ${statt}.`;
}

/** In der Stadt Zürich: das Quartier, sonst der Kreis, sonst die ganze Stadt -- je nachdem, wo genug verkauft wurde. */
function zuerich(r: PreisReihen, q: Quartier | null): Herleitung | null {
  const gesamt = r.zuerich.gesamt;
  const t = trend(gesamt.map(x => [x[0], x[1]]), r.stand - 10, r.stand);
  if (t == null) return null;
  const kandidaten: [string, string][] = [
    ...(q ? [[q.qname, `im Quartier ${q.qname}`] as [string, string], [`Kreis ${q.knr}`, `im Kreis ${q.knr}`] as [string, string]] : []),
    ['Ganze Stadt', 'in der ganzen Stadt'],
  ];
  for (const [raum, wo] of kandidaten) {
    const reihe = (r.zuerich.raum[raum] ?? []).filter(x => x[0] > r.stand - 3);
    const n = reihe.reduce((s, x) => s + x[2], 0);
    if (n < 30 && raum !== 'Ganze Stadt') continue;
    if (!reihe.length) continue;
    const wert = reihe.reduce((s, x) => s + x[1] * (1 + t) ** (r.stand - x[0]) * x[2], 0) / n;
    const m2 = auf50(wert);
    const g = gesamt.find(x => x[0] === r.stand), nb = r.zuerich.neubau.find(x => x[0] === r.stand);
    const saetze = [
      `Stockwerkeigentum ${wo}, Preis je m² Wohnfläche laut Statistik Stadt Zürich: ${reihe.map(x => `${x[0]} ${chf(x[1])} (${de(Math.round(x[2]))} Verkäufe)`).join(', ')}.`,
      `Drei Jahre, jedes mit dem Trend der ganzen Stadt (${prozent(t)} % pro Jahr seit ${r.stand - 10}) auf ${r.stand} gebracht und nach Verkäufen gewichtet: CHF ${de(m2)} je m².`,
      ...(raum !== 'Ganze Stadt' && g ? [`Zum Vergleich die ganze Stadt ${r.stand}: ${chf(g[1])} je m²${nb ? `, Neubauten ${chf(nb[1])}` : ''}.`] : []),
      ...(q && raum !== q.qname ? [quartierZuKlein(r, q.qname, raum === 'Ganze Stadt' ? 'die ganze Stadt' : `der ${raum}`)] : []),
      ...neubauSatz(r),
    ];
    const verlauf: VerlaufZeile[] = (r.zuerich.raum[raum] ?? []).filter(x => x[0] >= r.stand - 10).map(x => {
      const k = r.gemeinden['261']?.land?.find(l => l[0] === x[0]);
      return { jahr: x[0], m2: x[1], wohnungN: Math.round(x[2]), land: k?.[1] ?? null, landArt: k ? (k[6] === 'modell' ? 'Modell' : zusammengefasst(k[5]) ? k[5] : undefined) : undefined,
        wohnung: r.gemeinden['261']?.stwe?.find(w => w[0] === x[0])?.[1] ?? null };
    });
    const kurzOrt = raum === 'Ganze Stadt' ? 'ganze Stadt' : raum;
    return { m2, spanne: null, art: 'amtlich', kurz: `amtlich, Stockwerkeigentum ${wo} ${r.stand - 2} bis ${r.stand}`, saetze, verlauf,
      spalten: { m2: `je m², ${kurzOrt}`, wohnung: 'Wohnung, ganze Stadt', land: 'Bauland je m², Stadt' } };
  }
  return null;
}

/**
 * Der Verkaufspreis je m² für eine Gemeinde (BFS-Nummer). In der Stadt
 * Zürich mit Quartier, wenn bekannt. Null, wo keine Zahlen vorliegen
 * (ausserhalb des Kantons Zürich): dann bleibt es bei der Annahme.
 */
export function erloesHerleiten(r: PreisReihen | null | undefined, bfs: string | null | undefined, q: Quartier | null = null): Herleitung | null {
  if (!r || !bfs) return null;
  const b = String(Number(bfs));
  return b === '261' ? zuerich(r, q) : gemeinde(r, b);
}

/** Prüft eine Herleitung gegen eine Angabe von Julian (Spanne je m²). */
export function angabePruefen(h: Herleitung, angabe: { von: number; bis: number; gemeinde: string; am: string }): string {
  const drin = h.m2 >= angabe.von && h.m2 <= angabe.bis;
  return `Julian nannte am ${angabe.am} für ${angabe.gemeinde} CHF ${de(angabe.von)} bis ${de(angabe.bis)} je m²: die Herleitung liegt ${drin ? 'darin' : h.m2 < angabe.von ? 'darunter' : 'darüber'}.`;
}

// ------------------------------------------------------------- Laden
let reihen: Promise<PreisReihen | null> | null = null;
/** Einmal je Sitzung: die Datei ist rund 240 kB und ändert sich höchstens monatlich. */
export function reihenLaden(): Promise<PreisReihen | null> {
  reihen ??= fetch('/preise-reihen.json').then(r => (r.ok ? r.json() as Promise<PreisReihen> : null)).catch(() => { reihen = null; return null; });
  return reihen;
}

/**
 * Das statistische Quartier der Stadt Zürich an einem Punkt (LV95). Der
 * Dienst der Stadt erlaubt Abfragen aus dem Browser (am 17. November
 * nachgesehen: Access-Control-Allow-Origin *). Antwortet er nicht, rechnet
 * die Seite mit der ganzen Stadt und sagt das.
 */
export async function quartierLaden(e: number, n: number): Promise<Quartier | null> {
  const p = new URLSearchParams({
    service: 'WFS', version: '1.1.0', request: 'GetFeature', typename: 'adm_statistische_quartiere_map',
    outputFormat: 'GeoJSON', srsName: 'EPSG:2056', propertyName: 'qname,knr', bbox: `${e},${n},${e + 1},${n + 1},EPSG:2056`,
  });
  const frist = new AbortController();
  const uhr = setTimeout(() => frist.abort(), 6000);
  try {
    const r = await fetch(`https://www.ogd.stadt-zuerich.ch/wfs/geoportal/Statistische_Quartiere?${p}`, { signal: frist.signal });
    if (!r.ok) return null;
    const f = (await r.json())?.features?.[0]?.properties;
    return f?.qname && Number.isFinite(Number(f.knr)) ? { qname: String(f.qname), knr: Number(f.knr) } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(uhr);
  }
}
