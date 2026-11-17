/**
 * Woher CALC YOU LATER seine Zahlen holt (gerechnet wird in calc.ts):
 *
 *   Adresse, Parzelle, Fläche      Suchdienst und Kataster des Bundes
 *   Gebäude (Fläche, Geschosse,    Gebäude- und Wohnungsregister des
 *   Baujahr, Wohnungen)            Bundes, alle Kantone
 *   Zone                           Zonenplan des Kantons Zürich; sonst
 *                                  die eigene Liste oder von Hand
 *   Umriss, bebaubare Fläche       eigener Bestand (ZH, TG)
 *   Preise der Gemeinde            amtliche Statistik (ZH, BL)
 *   Belastete Standorte, ÖV        Bund und geodienste.ch
 *   Baugesuche im Umkreis          eigener Bestand
 *
 * Die Feldnamen des Bundes sind nachgesehen (Dufourstrasse 90, Zürich,
 * 16. November): der Kataster liefert ak, number, egris_egrid; das
 * Register egid, gdekt, ggdenr, ggdename, gstat, gbauj, garea, gastw,
 * ganzwhg; der Suchdienst im Feld detail zuletzt die Nummer der
 * Gemeinde und den Kanton («... 8008 zuerich 261 zuerich ch zh»).
 *
 * Jede Abfrage beim Bund trägt eine Frist: fällt ein Dienst aus, fehlt
 * diese Angabe, und die Rechnung sagt es -- sie wartet nicht.
 */
import { supabase } from '@/integrations/supabase/client';
import { flaecheLv95 } from '@/lib/ortsabfrage';
import { grundlageLaden, ZONEN_FRIST_MS, zoneAusBestand, zoneZh, type Grundlage } from '@/lib/machbarkeit-daten';
import { gemeindePreise, type GemeindePreise } from '@/lib/preise';
import { zusatzAbfragen } from '@/lib/parzelle-zusatz';
import { istVorhanden } from '@/lib/potential';
import type { Gebaeude, ZonenRegeln } from '@/lib/machbarkeit';
import { CALC_ANNAHMEN, hnfPraxis, zuerichKm, type NachbarTeil } from '@/lib/calc';
import { bundParzelle, mitte } from '@/lib/bund-parzelle';

// Die erzeugten Typen kennen Tabelle und Funktion noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

const API = 'https://api3.geo.admin.ch/rest/services';
const FRIST_MS = 8000;
const EGRID = /^CH[0-9A-Z]{12}$/;

async function holen(adresse: string): Promise<unknown> {
  const frist = new AbortController();
  const uhr = setTimeout(() => frist.abort(), FRIST_MS);
  try {
    const r = await fetch(adresse, { signal: frist.signal });
    if (!r.ok) throw new Error(`Der Bund antwortet mit ${r.status}.`);
    return await r.json();
  } finally {
    clearTimeout(uhr);
  }
}

export interface Adresse {
  /** «Dufourstrasse 90 8008 Zürich», wie der Bund sie schreibt. */
  label: string;
  strasse: string; plz: string | null; ort: string | null;
  e: number; n: number;
  kanton: string | null; bfs: string | null;
}

/** Strasse, Postleitzahl und Ort aus der Schreibweise des Bundes; Kanton und Gemeindenummer aus dem Feld detail. */
export function adresseLesen(label: string, detail: string, e: number, n: number): Adresse {
  const sauber = label.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const m = sauber.match(/^(.*?)\s+(\d{4})\s+(.+)$/);
  const kt = detail.match(/\bch ([a-z]{2})$/);
  const bfs = kt ? detail.match(/\b(\d{1,4})\b\D*\bch [a-z]{2}$/) : null;
  return {
    label: sauber, strasse: m ? m[1] : sauber, plz: m ? m[2] : null, ort: m ? m[3] : null, e, n,
    kanton: kt ? kt[1].toUpperCase() : null, bfs: bfs ? bfs[1] : null,
  };
}

/** Vorschläge des Bundes zu einer getippten Adresse. */
export async function adressen(text: string): Promise<Adresse[]> {
  if (text.trim().length < 4) return [];
  const j = await holen(`${API}/ech/SearchServer?type=locations&origins=address&limit=6&sr=2056&lang=de&searchText=${encodeURIComponent(text.trim())}`) as { results?: { attrs?: Record<string, unknown> }[] };
  return (j?.results ?? [])
    // Mit sr=2056 steht der Ostwert in y, der Nordwert in x.
    .map(x => adresseLesen(String(x.attrs?.label ?? ''), String(x.attrs?.detail ?? ''), Number(x.attrs?.y), Number(x.attrs?.x)))
    .filter(a => a.label && Number.isFinite(a.e) && Number.isFinite(a.n));
}

interface BundParzelle { kanton: string | null; nummer: string | null; egrid: string | null; flaeche: number | null }

async function parzelleBund(e: number, n: number): Promise<BundParzelle | null> {
  const q = new URLSearchParams({ geometryType: 'esriGeometryPoint', geometry: `${e},${n}`, sr: '2056', tolerance: '0',
    returnGeometry: 'true', geometryFormat: 'geojson', layers: 'all:ch.kantone.cadastralwebmap-farbe',
    mapExtent: `${e - 100},${n - 100},${e + 100},${n + 100}`, imageDisplay: '400,400,96', lang: 'de' });
  const j = await holen(`${API}/all/MapServer/identify?${q}`) as { results?: { geometry?: { type: string; coordinates: unknown }; attributes?: Record<string, unknown>; properties?: Record<string, unknown> }[] };
  const p = j?.results?.[0];
  if (!p) return null;
  const a = p.attributes ?? p.properties ?? {};
  const egrid = String(a.egris_egrid ?? '');
  return {
    kanton: typeof a.ak === 'string' && /^[A-Z]{2}$/.test(a.ak) ? a.ak : null,
    nummer: a.number ? String(a.number) : null,
    egrid: EGRID.test(egrid) ? egrid : null,
    flaeche: p.geometry ? Math.round(flaecheLv95(p.geometry)) : null,
  };
}

const zahl = (v: unknown): number | null => { const x = Number(v); return v != null && v !== '' && Number.isFinite(x) && x > 0 ? x : null; };

/** Ein Eintrag des Registers als Gebäude der Rechnung; null, wenn das Gebäude nicht (mehr) steht. */
export function gebaeudeAusRegister(a: Record<string, unknown>): Gebaeude | null {
  // 1004: bestehend. Projektierte, abgebrochene und nicht realisierte zählen nicht zum Bestand.
  if (a.gstat != null && Number(a.gstat) !== 1004) return null;
  return { grundflaeche: zahl(a.garea), geschosse: zahl(a.gastw), baujahr: zahl(a.gbauj), wohnungen: zahl(a.ganzwhg) };
}

interface Register { gebaeude: Gebaeude[]; kanton: string | null; bfs: string | null; gemeinde: string | null }

async function registerBund(egrid: string): Promise<Register> {
  const q = new URLSearchParams({ layer: 'ch.bfs.gebaeude_wohnungs_register', searchField: 'egrid', searchText: egrid, contains: 'false', returnGeometry: 'false' });
  const j = await holen(`${API}/all/MapServer/find?${q}`) as { results?: { attributes?: Record<string, unknown> }[] };
  const alle = (j?.results ?? []).map(r => r.attributes ?? {});
  const erster = alle[0] ?? {};
  return {
    gebaeude: alle.map(gebaeudeAusRegister).filter((g): g is Gebaeude => !!g),
    kanton: typeof erster.gdekt === 'string' ? erster.gdekt : null,
    bfs: erster.ggdenr != null ? String(erster.ggdenr) : null,
    gemeinde: typeof erster.ggdename === 'string' ? erster.ggdename : null,
  };
}

/** Alles, was zu einer Adresse gefunden wurde. */
export interface Objekt {
  adresse: Adresse;
  kanton: string | null; bfs: string | null; gemeinde: string | null;
  egrid: string | null; parzelleNr: string | null;
  /** Die Parzelle im eigenen Bestand (ZH, TG); null ausserhalb. */
  parzelleId: string | null;
  flaeche: number | null;
  /** Der Punkt für Umriss und Zone: in der Parzelle, wenn der Bestand ihn kennt. */
  punkt: [number, number];
  grundlage: Grundlage | null;
  zone: ZonenRegeln | null; bauzoneM2: number | null;
  /** Der Zonenplan des Kantons hat nicht geantwortet. */
  zonenplanAus: boolean;
  gebaeude: Gebaeude[]; bestandQuelle: 'register' | 'liste';
  /** Das Register hat geantwortet: «kein Gebäude» heisst dann «unbebaut». */
  registerDa: boolean;
  denkmal: boolean; isos: boolean;
  eigentuemer: string | null;
  preise: GemeindePreise | null;
  /** Was nicht geholt werden konnte, in Worten. */
  luecken: string[];
}

type Zeile = Record<string, unknown>;

export async function objektLaden(a: Adresse, abstand: number): Promise<Objekt> {
  const luecken: string[] = [];
  const bund = await parzelleBund(a.e, a.n).catch(() => null);
  if (!bund) luecken.push('Der Kataster des Bundes hat nicht geantwortet: Parzelle und Fläche fehlen.');
  const egrid = bund?.egrid ?? null;

  const [register, eigen] = await Promise.all([
    egrid ? registerBund(egrid).catch(() => null) : Promise.resolve(null),
    egrid ? db().from('properties').select('*').eq('egrid', egrid).limit(1).maybeSingle().then((r: { data: Zeile | null }) => r.data ?? null, () => null) as Promise<Zeile | null> : Promise.resolve(null),
  ]);
  if (egrid && !register) luecken.push('Das Gebäuderegister des Bundes hat nicht geantwortet.');

  const kanton = bund?.kanton ?? register?.kanton ?? (eigen?.kanton as string | undefined) ?? a.kanton;
  const bfs = eigen?.bfs_nr != null ? String(eigen.bfs_nr) : register?.bfs ?? a.bfs;
  const parzelleId = (eigen?.id as string | undefined) ?? null;

  const grundlage = parzelleId ? await grundlageLaden(parzelleId, abstand).catch(() => null) : null;
  const punkt: [number, number] = grundlage?.punkt ?? [a.e, a.n];

  // Zone: amtlich für Zürich, sonst was die eigene Liste weiss, sonst von Hand.
  const liste = eigen ? zoneAusBestand(eigen as Parameters<typeof zoneAusBestand>[0]) : null;
  let zone: ZonenRegeln | null = null, zonenplanAus = false;
  if (kanton === 'ZH') {
    // Der Dienst des Kantons hängt manchmal einige Sekunden: am 16. November
    // fiel die Hochweidstrasse 9 in Kilchberg auf die eigene Liste zurück
    // (Wohnzone ohne Ziffer), obwohl der Zonenplan eine Minute später in
    // 0.8 s antwortete. Darum ein zweiter Versuch mit längerer Frist.
    for (const frist of [ZONEN_FRIST_MS, 15000]) {
      try { zone = await zoneZh(punkt[0], punkt[1], undefined, frist); zonenplanAus = false; break; } catch { zonenplanAus = true; }
    }
  }
  const [preise] = await Promise.all([gemeindePreise(bfs).catch(() => null)]);

  // Gebäude: das Register des Bundes; fällt es aus, der eigene Bestand.
  const ausBestand = grundlage?.gebaeude?.length ? grundlage.gebaeude : null;
  const ausListe = eigen && zahl(eigen.gebaeudeflaeche) && zahl(eigen.geschosse)
    ? [{ grundflaeche: zahl(eigen.gebaeudeflaeche), geschosse: zahl(eigen.geschosse), baujahr: zahl(eigen.baujahr), wohnungen: zahl(eigen.wohnungen) }] : null;
  const gebaeude = register?.gebaeude ?? ausBestand ?? ausListe ?? [];

  return {
    adresse: a, kanton: kanton ?? null, bfs: bfs ?? null,
    gemeinde: (eigen?.gemeinde as string | undefined) ?? register?.gemeinde ?? a.ort,
    egrid, parzelleNr: bund?.nummer ?? (eigen?.parzelle as string | undefined) ?? null, parzelleId,
    flaeche: zahl(eigen?.area) ?? grundlage?.flaeche_umriss ?? bund?.flaeche ?? null,
    punkt, grundlage,
    zone: zone ?? liste?.regeln ?? null, bauzoneM2: zone ? null : liste?.bauzoneM2 ?? null, zonenplanAus,
    gebaeude, bestandQuelle: register || ausBestand ? 'register' : 'liste', registerDa: !!register,
    denkmal: istVorhanden(eigen?.denkmalschutz as string | undefined), isos: istVorhanden(eigen?.isos as string | undefined),
    eigentuemer: (eigen?.owner_name as string | undefined) ?? null,
    preise, luecken,
  };
}

/**
 * Wie steil das Gelände ist, in Prozent: Höhen des Geländemodells des
 * Bundes (swissALTI3D) je 15 m nördlich, südlich, östlich und westlich
 * des Punktes. Nachgesehen an der Hochweidstrasse 9 in Kilchberg
 * (16. November): 508.2 bis 510.5 m, rund 8 % Steigung.
 */
export function neigungAus(h: { n: number; s: number; o: number; w: number }, abstand = 15): number {
  const gx = (h.o - h.w) / (2 * abstand), gy = (h.n - h.s) / (2 * abstand);
  return Math.round(Math.hypot(gx, gy) * 1000) / 10;
}

export async function neigungLaden(e: number, n: number): Promise<number | null> {
  const hoehe = async (x: number, y: number) => {
    const j = await holen(`${API}/height?easting=${Math.round(x)}&northing=${Math.round(y)}&sr=2056`) as { height?: string };
    const h = Number(j?.height);
    if (!Number.isFinite(h)) throw new Error('keine Höhe');
    return h;
  };
  try {
    const [hn, hs, ho, hw] = await Promise.all([hoehe(e, n + 15), hoehe(e, n - 15), hoehe(e + 15, n), hoehe(e - 15, n)]);
    return neigungAus({ n: hn, s: hs, o: ho, w: hw });
  } catch {
    return null;
  }
}

/** Was das Umfeld sagt: belastete Standorte, ÖV, Baugesuche im Umkreis, Gelände und Lage. Jede Lücke bleibt leer. */
export async function umfeldLaden(o: Pick<Objekt, 'egrid' | 'punkt' | 'kanton'>, meter = 300): Promise<{ belastet: number | null; oev: string | null; baugesuche: number | null; baugesucheMeter: number; neigung: number | null; zuerichKm: number }> {
  const [zusatz, bau, neigung] = await Promise.all([
    o.egrid ? zusatzAbfragen(o.egrid, o.punkt[0], o.punkt[1]).catch(() => null) : Promise.resolve(null),
    o.kanton ? db().rpc('baugesuche_umkreis', { p_e: o.punkt[0], p_n: o.punkt[1], p_kanton: o.kanton, p_meter: meter })
      .then((r: { data: { n365?: number } | null; error: unknown }) => (r.error ? null : r.data), () => null) as Promise<{ n365?: number } | null> : Promise.resolve(null),
    neigungLaden(o.punkt[0], o.punkt[1]),
  ]);
  return { belastet: zusatz ? zusatz.belastet.length : null, oev: zusatz?.oev ?? null, baugesuche: bau?.n365 ?? null, baugesucheMeter: meter,
    neigung, zuerichKm: Math.round(zuerichKm(o.punkt[0], o.punkt[1]) * 10) / 10 };
}

// --------------------------------------------------- Portale von Hand

const klein = (s: string) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue');

/**
 * Wo man die Mieten der Nachbarschaft nachsieht. Comparis und Homegate
 * verbieten das automatische Auslesen und sperren Programme aus; darum
 * öffnet die Seite nur die Suche, und ein Mensch überträgt, was er sieht.
 *
 * Die Adressen sind nachgesehen (16. November): Homegate führt
 * /rent/apartment/zip-8008/matching-list, Comparis
 * /immobilien/marktplatz/winterthur/wohnung/mieten. Wie Comparis Orte
 * aus mehreren Wörtern schreibt, ist nicht belegt -- dort sucht Google.
 */
export function portalLinks(a: Pick<Adresse, 'strasse' | 'plz' | 'ort'>, art: 'mieten' | 'kaufen' = 'mieten'): { titel: string; adresse: string }[] {
  const aus: { titel: string; adresse: string }[] = [];
  const google = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
  // Nachgesehen: /rent/apartment/zip-8008/... und /buy/apartment/zip-8802/...
  if (a.plz) aus.push({ titel: `Homegate: Wohnungen in ${a.plz}`, adresse: `https://www.homegate.ch/${art === 'kaufen' ? 'buy' : 'rent'}/apartment/zip-${a.plz}/matching-list` });
  const slug = comparisOrt(a.ort);
  if (slug) aus.push({ titel: `Comparis: Wohnungen in ${a.ort}`, adresse: `https://www.comparis.ch/immobilien/marktplatz/${slug}/wohnung/${art}` });
  else if (a.ort) aus.push({ titel: `Comparis: Wohnungen in ${a.ort}`, adresse: google(`site:comparis.ch Wohnung ${art} ${a.plz ?? ''} ${a.ort}`.replace(/\s+/g, ' ')) });
  aus.push({ titel: 'Inserate an dieser Adresse', adresse: google(`"${a.strasse}" ${a.plz ?? ''} ${a.ort ?? ''} ${art} (site:homegate.ch OR site:comparis.ch OR site:immoscout24.ch)`.replace(/\s+/g, ' ')) });
  return aus;
}

/**
 * Wie Comparis einen Ort in der Adresse schreibt. Belegt sind nur zwei
 * Formen (16. November): ein Wort («winterthur», «zuerich») und ein Wort
 * mit Kanton («kilchberg-zh»). Alles andere geht über die Suche bei Google.
 */
export function comparisOrt(ort: string | null | undefined): string | null {
  const m = ort?.trim().match(/^([A-Za-zÄÖÜäöü]+)(?: ([A-Z]{2}))?$/);
  return m ? [klein(m[1]), m[2]?.toLowerCase()].filter(Boolean).join('-') : null;
}

/** Der Lead der Check-Seiten, von dem aus gerechnet wird: Name und Adresse zum Vorbelegen. */
export async function leadLaden(id: string): Promise<{ id: string; name: string | null; adresse: string | null } | null> {
  const r = await db().from('anfrage').select('id, name, adresse').eq('id', id).maybeSingle();
  return r.error ? null : r.data ?? null;
}

// ------------------------------------------------- Nachbarn dazukaufen

/** Eine Nachbarparzelle mit allem, was die gemeinsame Rechnung braucht. */
export interface NachbarDaten extends NachbarTeil {
  kanton: string | null;
  /** Ob die Praxisformel hier rechnen kann (Bauzone mit Ziffer und Geschossen). */
  bebaubar: boolean;
}

/** Ein Ort aus dem eigenen Bestand: die Zone, wo kein amtlicher Zonenplan angebunden ist. */
async function zoneAusListe(egrid: string): Promise<ZonenRegeln | null> {
  const r = await db().from('properties').select('zone, ausnuetzung, vollgeschosse_zulaessig, gemeinde').eq('egrid', egrid).limit(1).maybeSingle();
  return r.data ? zoneAusBestand(r.data)?.regeln ?? null : null;
}

async function nachbarLaden(egrid: string): Promise<NachbarDaten | null> {
  const q = new URLSearchParams({ layer: 'ch.kantone.cadastralwebmap-farbe', searchField: 'egris_egrid', searchText: egrid, contains: 'false',
    returnGeometry: 'true', geometryFormat: 'geojson', sr: '2056' });
  const j = await holen(`${API}/all/MapServer/find?${q}`).catch(() => null) as { results?: { geometry?: { type: string; coordinates: number[][][] | number[][][][] }; attributes?: Record<string, unknown>; properties?: Record<string, unknown> }[] } | null;
  const r = j?.results?.[0];
  if (!r?.geometry) return null;
  const g = r.geometry;
  const ringe = (g.type === 'Polygon' ? g.coordinates : (g.coordinates as number[][][][]).flat()) as number[][][];
  const { e, n } = mitte(ringe);
  const flaeche = Math.round(flaecheLv95(g));
  const a = r.attributes ?? r.properties ?? {};
  const kanton = typeof a.ak === 'string' && /^[A-Z]{2}$/.test(a.ak) ? a.ak : null;
  // Die Zone am Schwerpunkt der Parzelle; bei sehr verwinkelten Parzellen kann er daneben liegen.
  const [register, zone] = await Promise.all([
    registerBund(egrid).catch(() => null),
    kanton === 'ZH' ? zoneZh(e, n, undefined, 12000).catch(() => null) : zoneAusListe(egrid).catch(() => null),
  ]);
  return {
    egrid, nummer: a.number ? String(a.number) : null, flaeche, zone, gebaeude: register?.gebaeude ?? [], kanton,
    bebaubar: !!hnfPraxis(flaeche, zone, CALC_ANNAHMEN),
  };
}

/**
 * Die Nachbarparzellen beim Bund: wer an die Parzelle grenzt (Kataster),
 * mit Fläche, Zone und Gebäuden. Strassen und Parzellen ohne Bauzone
 * kommen mit, sind aber nicht bebaubar. Höchstens zwölf.
 */
export async function nachbarnLaden(egrid: string): Promise<NachbarDaten[]> {
  const b = await bundParzelle(egrid);
  if (!b) throw new Error('Der Kataster des Bundes hat nicht geantwortet.');
  const alle = await Promise.all(b.nachbarn.slice(0, 12).map(nachbarLaden));
  return alle.filter((x): x is NachbarDaten => !!x).sort((x, y) => Number(y.bebaubar) - Number(x.bebaubar) || y.flaeche - x.flaeche);
}
