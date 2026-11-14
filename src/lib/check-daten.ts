/**
 * Was die Check-Seiten beim Bund nachschlagen und wie ein Lead aussieht.
 *
 * Alles kommt von geo.admin.ch, ohne Schlüssel und ohne unseren Bestand:
 * die Seiten stehen ohne Anmeldung offen und dürfen nur eine Anfrage
 * einfügen (20261101240000_anfrage.sql). Die Codes des Gebäuderegisters
 * sind am 6. November in kodes_codes_codici.csv nachgesehen
 * (public.madd.bfs.admin.ch).
 */
import { flaecheLv95 } from '@/lib/ortsabfrage';

const API = 'https://api3.geo.admin.ch/rest/services';

export interface Ort { label: string; e: number; n: number }

export interface Haus {
  egid: number; adresse: string | null; status: number | null; klasse: number | null; baujahr: number | null; periode: number | null;
  geschosse: number | null; wohnungen: number | null; grundflaeche: number | null; energie: number | null; kanton: string | null;
}

export interface Befund {
  adresse: string; nummer: string | null; egrid: string | null; kanton: string | null; gemeinde: string | null;
  zone: string | null; flaeche: number | null;
  /** Umriss in LV95: Teile, jeder mit Ringen. */
  teile: number[][][][];
  haeuser: Haus[];
}

export const HEIZUNG: Record<number, string> = {
  7500: 'keine', 7501: 'Wärmepumpe (Luft)', 7510: 'Erdwärme', 7511: 'Erdwärmesonde', 7512: 'Erdregister', 7513: 'Wärmepumpe (Wasser)',
  7520: 'Gas', 7530: 'Heizöl', 7540: 'Holz', 7541: 'Stückholz', 7542: 'Pellets', 7543: 'Holzschnitzel', 7550: 'Abwärme',
  7560: 'Strom', 7570: 'Sonne', 7580: 'Fernwärme', 7581: 'Fernwärme', 7582: 'Fernwärme', 7598: 'unbestimmt', 7599: 'andere',
};
export const STATUS: Record<number, string> = {
  1001: 'projektiert', 1002: 'bewilligt', 1003: 'im Bau', 1004: 'bestehend', 1005: 'nicht nutzbar', 1007: 'abgebrochen', 1008: 'nicht realisiert',
};
export const GEBAEUDEART: Record<number, string> = {
  1110: 'Einfamilienhaus', 1121: 'Zweifamilienhaus', 1122: 'Mehrfamilienhaus', 1130: 'Wohnheim', 1211: 'Hotel', 1212: 'Beherbergung',
  1220: 'Bürogebäude', 1230: 'Handel', 1231: 'Restaurant', 1241: 'Verkehr', 1242: 'Garage', 1251: 'Industrie', 1252: 'Lager',
  1261: 'Kultur, Freizeit', 1262: 'Museum', 1263: 'Schule', 1264: 'Spital', 1265: 'Sporthalle', 1271: 'Landwirtschaft',
  1272: 'Kirche', 1273: 'Denkmal', 1274: 'Hochbau', 1275: 'Unterkunft', 1276: 'Tierhaltung', 1277: 'Pflanzenbau', 1278: 'Landwirtschaft',
};

export async function vorschlaege(text: string, signal?: AbortSignal): Promise<Ort[]> {
  if (text.trim().length < 3) return [];
  const r = await fetch(`${API}/ech/SearchServer?type=locations&origins=address,parcel&limit=6&sr=2056&lang=de&searchText=${encodeURIComponent(text)}`, { signal });
  const j = await r.json();
  // Mit sr=2056 steht der Ostwert in y, der Nordwert in x.
  return ((j?.results ?? []) as { attrs?: Record<string, unknown> }[]).map(x => ({
    label: vorschlagText(String(x.attrs?.label ?? ''), String(x.attrs?.origin ?? '')) ?? '', e: Number(x.attrs?.y), n: Number(x.attrs?.x),
  })).filter(v => v.label && Number.isFinite(v.e) && Number.isFinite(v.n));
}

/**
 * Der Text eines Vorschlags, wie ein Besucher ihn lesen soll, oder null.
 * Der Suchdienst des Bundes liefert für eine Strasse ohne Hausnummer
 * "Bahnhofstrasse # 3920 Zermatt" (Julian, 8. November: "wieso kommen da
 * Zeichen wie #"). Ohne Nummer gibt es keine Parzelle, darum fallen diese
 * weg. Parzellen kommen als "Fällanden      2725 (CH 5456 3977 8444)";
 * daraus wird "Parzelle 2725, Fällanden".
 */
export function vorschlagText(roh: string, herkunft: string): string | null {
  const t = roh.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (herkunft === 'parcel') {
    const m = t.match(/^(.+?) (\S+) \(CH[\d ]+\)$/);
    return m ? `Parzelle ${m[2]}, ${m[1]}` : t.replace(/\s*\(CH[\d ]+\)$/, '');
  }
  if (/(^|\s)#(\s|$)/.test(t)) return null;
  // Wie bei Google oder Homegate: Strasse und Nummer, Komma, PLZ und Ort
  // (Julian, 13. November: "ist doch besser mit , dazwischen").
  const m = t.match(/^(.*?\S)\s+(\d{4}\s.+)$/);
  return m ? `${m[1]}, ${m[2]}` : t;
}

/** Ein Vorschlag in zwei Teile: was kräftig steht (Strasse, Parzelle) und den Ort danach. */
export function vorschlagTeile(label: string): [string, string | null] {
  const i = label.indexOf(', ');
  return i > 0 ? [label.slice(0, i), label.slice(i + 2)] : [label, null];
}

const zahl = (v: unknown) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** Gebäude des Registers auf genau dieser Parzelle; abgebrochene und nicht realisierte zählen nicht. */
export function haeuserAus(attribute: Record<string, unknown>[], egrid: string): Haus[] {
  return attribute
    .filter(a => a.egrid === egrid && ![1007, 1008].includes(Number(a.gstat)))
    .map(a => ({
      egid: Number(a.egid), adresse: typeof a.strname_deinr === 'string' ? a.strname_deinr : null, status: zahl(a.gstat), klasse: zahl(a.gklas),
      baujahr: zahl(a.gbauj), periode: zahl(a.gbaup), geschosse: zahl(a.gastw), wohnungen: zahl(a.ganzwhg), grundflaeche: zahl(a.garea), energie: zahl(a.genh1),
      kanton: typeof a.gdekt === 'string' ? a.gdekt : null,
    }))
    // Bestehende zuerst, dann Projekte.
    .sort((x, y) => (x.status === 1004 ? 0 : 1) - (y.status === 1004 ? 0 : 1));
}

/**
 * Bauperioden des Gebäuderegisters. Das genaue Baujahr fehlt oft (gemessen
 * 14. November 2026: Bern 80 %, Aarau 74 %, Fällanden 15 %), die Periode
 * meist nicht. Die Spannen sind an 1'390 Gebäuden mit beidem nachgeprüft.
 */
export const BAUPERIODE: Record<number, string> = {
  8011: 'vor 1919', 8012: '1919–1945', 8013: '1946–1960', 8014: '1961–1970', 8015: '1971–1980', 8016: '1981–1985', 8017: '1986–1990',
  8018: '1991–1995', 8019: '1996–2000', 8020: '2001–2005', 8021: '2006–2010', 8022: '2011–2015', 8023: 'nach 2015',
};
/** Baujahr, sonst die Bauperiode, sonst null. */
export const bauzeit = (h: Pick<Haus, 'baujahr' | 'periode'>): string | null =>
  h.baujahr ? String(h.baujahr) : h.periode ? BAUPERIODE[h.periode] ?? null : null;
/** Das älteste Gebäude: kleinstes Baujahr, sonst früheste Periode; Perioden zählen ab ihrem Anfang. */
export function aeltestes(haeuser: Pick<Haus, 'baujahr' | 'periode'>[]): string | null {
  const anfang = (h: Pick<Haus, 'baujahr' | 'periode'>) => h.baujahr ?? (h.periode && BAUPERIODE[h.periode] ? (h.periode === 8011 ? 0 : Number(BAUPERIODE[h.periode].match(/\d{4}/)?.[0])) : null);
  const mit = haeuser.filter(h => anfang(h) != null).sort((x, y) => anfang(x)! - anfang(y)!);
  return mit.length ? bauzeit(mit[0]) : null;
}

export async function befundAmOrt(ort: Ort, signal?: AbortSignal): Promise<Befund> {
  const frage = async (ebene: string, geometrie: boolean) => {
    const q = new URLSearchParams({ geometryType: 'esriGeometryPoint', geometry: `${ort.e},${ort.n}`, sr: '2056', tolerance: '0',
      returnGeometry: String(geometrie), geometryFormat: 'geojson', layers: `all:${ebene}`,
      mapExtent: `${ort.e - 100},${ort.n - 100},${ort.e + 100},${ort.n + 100}`, imageDisplay: '400,400,96', lang: 'de' });
    const j = await (await fetch(`${API}/all/MapServer/identify?${q}`, { signal })).json();
    return j?.results?.[0] ?? null;
  };
  const [p, z] = await Promise.all([frage('ch.kantone.cadastralwebmap-farbe', true), frage('ch.are.bauzonen', false)]);
  const a = (p?.attributes ?? p?.properties ?? {}) as Record<string, unknown>;
  const za = (z?.attributes ?? z?.properties ?? {}) as Record<string, unknown>;
  const egrid = /^CH[0-9A-Z]{12}$/.test(String(a.egris_egrid ?? '')) ? String(a.egris_egrid) : null;
  const g = p?.geometry as { type: string; coordinates: unknown } | undefined;
  const teile = !g ? [] : g.type === 'Polygon' ? [g.coordinates as number[][][]] : (g.coordinates as number[][][][]);
  let haeuser: Haus[] = [];
  if (egrid) {
    const q = new URLSearchParams({ layer: 'ch.bfs.gebaeude_wohnungs_register', searchField: 'egrid', searchText: egrid,
      contains: 'false', returnGeometry: 'false', lang: 'de' });
    const j = await (await fetch(`${API}/ech/MapServer/find?${q}`, { signal })).json();
    haeuser = haeuserAus(((j?.results ?? []) as { attributes: Record<string, unknown> }[]).map(r => r.attributes), egrid);
  }
  return {
    adresse: ort.label, nummer: a.number ? String(a.number) : null, egrid,
    kanton: typeof a.ak === 'string' ? a.ak : haeuser[0]?.kanton ?? null,
    gemeinde: za.name ? String(za.name) : null, zone: za.ch_bez_d ? String(za.ch_bez_d) : null,
    flaeche: g ? Math.round(flaecheLv95(g)) : null, teile, haeuser,
  };
}

/** Wie dicht die Parzelle heute bebaut ist: Grundfläche bestehender Gebäude durch Parzellenfläche. */
export function ueberbauung(b: Pick<Befund, 'flaeche' | 'haeuser'>): { flaeche: number; anteil: number } | null {
  const f = b.haeuser.filter(h => h.status === 1004 || h.status === 1003).reduce((s, h) => s + (h.grundflaeche ?? 0), 0);
  if (!b.flaeche || !f) return null;
  return { flaeche: f, anteil: Math.min(100, Math.round((f / b.flaeche) * 100)) };
}

// ------------------------------------------------------------------ Lead
export type Eigentum = 'allein' | 'gemeinsam' | 'erbengemeinschaft' | 'vertretung' | 'nein';
export type Absicht = 'verkaufen' | 'bauen' | 'wert' | 'informieren';
export type Zeitraum = '12' | '36' | 'offen';
export interface Antwort { eigentuemer: Eigentum | null; absicht: Absicht | null; zeitraum: Zeitraum | null }

export const ANTWORT_TEXT = {
  eigentuemer: { allein: 'Ja, allein', gemeinsam: 'Ja, gemeinsam mit anderen', erbengemeinschaft: 'Ja, als Erbengemeinschaft',
    vertretung: 'Nein, ich vertrete den Eigentümer', nein: 'Nein' } as Record<Eigentum, string>,
  absicht: { verkaufen: 'Verkaufen', bauen: 'Bauen, aus- oder umbauen', wert: 'Den Wert kennen', informieren: 'Nur informieren' } as Record<Absicht, string>,
  zeitraum: { 12: 'In den nächsten 12 Monaten', 36: 'In 1 bis 3 Jahren', offen: 'Noch offen' } as Record<Zeitraum, string>,
};

/**
 * Heiss: Eigentümer (oder seine Vertretung), will verkaufen oder bauen,
 * innert 12 Monaten -- das Merkmal guter Verkäufer-Leads (RealAdvisor
 * 2026: konkrete Absicht mit Zeithorizont, Telefon, Objektadresse).
 */
export function prioritaet(a: Antwort): 'heiss' | 'warm' | 'normal' {
  const eigen = a.eigentuemer != null && a.eigentuemer !== 'nein';
  if (eigen && (a.absicht === 'verkaufen' || a.absicht === 'bauen') && a.zeitraum === '12') return 'heiss';
  if (eigen && a.absicht != null && a.absicht !== 'informieren') return 'warm';
  return 'normal';
}

/** Werbeherkunft aus der Adresse der Seite: UTM-Werte und Klick-Kennungen von Google und Meta. */
export function herkunft(suche: string): Record<string, string> {
  const u = new URLSearchParams(suche);
  const aus: Record<string, string> = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid']) {
    const v = u.get(k);
    if (v) aus[k] = v.slice(0, 200);
  }
  return aus;
}

/** Was in anfrage.angaben steht. Klein halten: die Spalte erlaubt weniger als 8 kB. */
export function leadAngaben(o: { marke: string; domain: string; antwort: Antwort; befund: Befund; herkunft: Record<string, string> }): Record<string, unknown> {
  const b = o.befund;
  const bestehend = b.haeuser.filter(h => h.status === 1004 || h.status === 1003);
  const baujahre = bestehend.map(h => h.baujahr).filter((x): x is number => x != null);
  return {
    quelle: 'check', marke: o.marke, domain: o.domain,
    eigentuemer: o.antwort.eigentuemer, absicht: o.antwort.absicht, zeitraum: o.antwort.zeitraum, prioritaet: prioritaet(o.antwort),
    parzelle: b.nummer, flaeche: b.flaeche, zone: b.zone, gemeinde: b.gemeinde, kanton: b.kanton,
    gebaeude: bestehend.length, wohnungen: bestehend.reduce((s, h) => s + (h.wohnungen ?? 0), 0) || null,
    baujahr: baujahre.length ? Math.min(...baujahre) : null,
    // Ohne genaues Jahr wenigstens die Periode, damit der Lead in Pipedrive nicht leer ist.
    bauperiode: baujahre.length ? null : aeltestes(bestehend),
    projekt: b.haeuser.some(h => h.status === 1001 || h.status === 1002) || null,
    ...o.herkunft,
  };
}

// ------------------------------------------------------------- Prüfungen
/**
 * Eine echte Schweizer Nummer, schön geschrieben (+41 79 412 58 36), oder
 * null. Julian, 6. November: "eine richtige Schweizer Nummer, also +41
 * oder 076, 079 usw., dass die Leute nicht einfach wilde Zahlen
 * eintippen". Mobil 075 bis 079, Festnetz mit den Vorwahlen der Schweiz;
 * keine Gratis- und Mehrwertnummern (0800, 084x, 090x), keine
 * Zahlenreihen wie 000 00 00 oder 123 45 67.
 */
const VORWAHLEN = ['75', '76', '77', '78', '79', '21', '22', '24', '26', '27', '31', '32', '33', '34', '41', '43', '44', '52', '55', '56', '58', '61', '62', '71', '81', '91'];
export function schweizerNummer(roh: string | null | undefined): string | null {
  let s = String(roh ?? '').replace(/[\s\-/().]/g, '');
  if (s.startsWith('0041')) s = '+41' + s.slice(4);
  else if (s.startsWith('0')) s = '+41' + s.slice(1);
  if (!/^\+41\d{9}$/.test(s)) return null;
  const nat = s.slice(3), teil = nat.slice(2);
  if (!VORWAHLEN.includes(nat.slice(0, 2))) return null;
  if (/^(\d)\1+$/.test(teil) || '0123456789'.includes(teil) || '9876543210'.includes(teil)) return null;
  return `+41 ${nat.slice(0, 2)} ${nat.slice(2, 5)} ${nat.slice(5, 7)} ${nat.slice(7)}`;
}

const WEGWERF = ['mailinator.com', 'yopmail.com', 'trashmail.com', 'guerrillamail.com', '10minutemail.com', 'tempmail.com', 'wegwerfemail.de'];
export const mailOk = (m: string) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(m.trim()) && !WEGWERF.includes(m.trim().split('@')[1].toLowerCase());
export const nameOk = (t: string) => /^\p{L}[\p{L}' .-]{1,59}$/u.test(t.trim());
