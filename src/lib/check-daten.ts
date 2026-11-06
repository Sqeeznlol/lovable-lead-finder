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
  egid: number; adresse: string | null; status: number | null; klasse: number | null; baujahr: number | null;
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
    label: String(x.attrs?.label ?? '').replace(/<[^>]+>/g, '').trim(), e: Number(x.attrs?.y), n: Number(x.attrs?.x),
  })).filter(v => v.label && Number.isFinite(v.e) && Number.isFinite(v.n));
}

const zahl = (v: unknown) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** Gebäude des Registers auf genau dieser Parzelle; abgebrochene und nicht realisierte zählen nicht. */
export function haeuserAus(attribute: Record<string, unknown>[], egrid: string): Haus[] {
  return attribute
    .filter(a => a.egrid === egrid && ![1007, 1008].includes(Number(a.gstat)))
    .map(a => ({
      egid: Number(a.egid), adresse: typeof a.strname_deinr === 'string' ? a.strname_deinr : null, status: zahl(a.gstat), klasse: zahl(a.gklas),
      baujahr: zahl(a.gbauj), geschosse: zahl(a.gastw), wohnungen: zahl(a.ganzwhg), grundflaeche: zahl(a.garea), energie: zahl(a.genh1),
      kanton: typeof a.gdekt === 'string' ? a.gdekt : null,
    }))
    // Bestehende zuerst, dann Projekte.
    .sort((x, y) => (x.status === 1004 ? 0 : 1) - (y.status === 1004 ? 0 : 1));
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
    projekt: b.haeuser.some(h => h.status === 1001 || h.status === 1002) || null,
    ...o.herkunft,
  };
}
