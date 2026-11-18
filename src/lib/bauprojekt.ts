/**
 * Was auf einer Parzelle schon geplant, bewilligt oder im Bau ist, laut
 * Gebäuderegister des Bundes.
 *
 * Julian, 18. November: «Nöd das Aurora rechnet und debi gits es
 * bewilligts Projekt mit anderne Zahle.» Das Register führt jedes
 * eingereichte Gebäude mit Status 1001 (projektiert), 1002 (bewilligt)
 * und 1003 (im Bau), samt Geschossen, Wohnungen und der Fläche jeder
 * Wohnung. Nachgesehen an der Dietlikerstrasse 49 in Kloten: bewilligt,
 * 5 Geschosse, 20 Wohnungen von 60 bis 96 m². Das gilt auch, wenn das
 * Baugesuch älter ist als die geladenen Gesuche (Zürich: ein Jahr) oder
 * das Amtsblatt die Publikation nicht mehr zeigt.
 */

export type ProjektStatus = 'projektiert' | 'bewilligt' | 'im Bau';

const STATUS: Record<number, ProjektStatus> = { 1001: 'projektiert', 1002: 'bewilligt', 1003: 'im Bau' };
const RANG: Record<ProjektStatus, number> = { projektiert: 1, bewilligt: 2, 'im Bau': 3 };

export interface ProjektBau {
  /** Kennung im Kartenviewer des Bundes, z.B. 192104376_0. */
  id: string | null;
  adresse: string | null;
  status: ProjektStatus;
  geschosse: number | null;
  wohnungen: number | null;
  /** Summe der Wohnungsflächen, m². */
  wohnflaeche: number | null;
}

export interface Projekt {
  /** Der weiteste Stand unter den Bauten. */
  status: ProjektStatus;
  bauten: ProjektBau[];
  /** Bauten mit Wohnungen; Tiefgaragen und Nebenbauten zählen nicht. */
  gebaeude: number;
  wohnungen: number;
  /** Summe der Wohnungsflächen, m²; null, wo das Register keine nennt. */
  wohnflaeche: number | null;
  geschosse: number | null;
  /** Stand des Registers, wie es ihn schreibt (TT.MM.JJJJ). */
  stand: string | null;
}

const zahl = (v: unknown): number | null => { const x = Number(v); return v != null && v !== '' && Number.isFinite(x) && x > 0 ? x : null; };

/** Ein Eintrag des Registers als Bau eines Projekts; null, wenn er schon steht, abgebrochen oder verworfen ist. */
export function projektBau(a: Record<string, unknown>, id?: string | null): ProjektBau | null {
  const status = STATUS[Number(a.gstat)];
  if (!status) return null;
  const flaechen = Array.isArray(a.warea) ? a.warea.map(zahl).filter((x): x is number => x != null) : [];
  return {
    id: id ?? (a.egid != null ? `${a.egid}_0` : null),
    adresse: typeof a.strname_deinr === 'string' ? a.strname_deinr : typeof a.label === 'string' ? a.label : null,
    status, geschosse: zahl(a.gastw), wohnungen: zahl(a.ganzwhg),
    wohnflaeche: flaechen.length ? flaechen.reduce((s, x) => s + x, 0) : null,
  };
}

/** Alle geplanten Bauten einer Parzelle zusammen; null, wenn keiner geplant ist. */
export function projektAus(eintraege: { attributes?: Record<string, unknown>; featureId?: string; id?: string }[]): Projekt | null {
  // Das Register liefert ein Gebäude mit mehreren Eingängen mehrfach; es zählt einmal.
  const gesehen = new Set<string>();
  const bauten: ProjektBau[] = [];
  for (const e of eintraege) {
    const a = e.attributes ?? {};
    const egid = String(a.egid ?? '');
    if (egid && gesehen.has(egid)) continue;
    const b = projektBau(a, e.featureId ?? e.id ?? null);
    if (!b) continue;
    if (egid) gesehen.add(egid);
    bauten.push(b);
  }
  if (!bauten.length) return null;
  const mitWohnungen = bauten.filter(b => b.wohnungen);
  const flaechen = mitWohnungen.map(b => b.wohnflaeche).filter((x): x is number => x != null);
  const geschosse = bauten.map(b => b.geschosse).filter((x): x is number => x != null);
  const stand = eintraege.map(e => e.attributes?.gexpdat).find((x): x is string => typeof x === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(x)) ?? null;
  return {
    status: bauten.reduce((s, b) => (RANG[b.status] > RANG[s] ? b.status : s), bauten[0].status),
    bauten, gebaeude: mitWohnungen.length,
    wohnungen: mitWohnungen.reduce((s, b) => s + (b.wohnungen ?? 0), 0),
    // Nur wenn jeder Bau mit Wohnungen seine Flächen nennt: sonst wäre die Summe zu klein.
    wohnflaeche: flaechen.length && flaechen.length === mitWohnungen.length ? flaechen.reduce((s, x) => s + x, 0) : null,
    geschosse: geschosse.length ? Math.max(...geschosse) : null,
    stand,
  };
}

/**
 * Ob die Rechnung mit dem Projekt statt mit der Formel rechnet: nur ein
 * bewilligtes oder begonnenes Projekt mit bekannter Wohnfläche. Ein
 * eingereichtes kann noch scheitern oder schrumpfen.
 */
export function projektZaehlt(p: Projekt | null | undefined): p is Projekt & { wohnflaeche: number } {
  return !!p && p.status !== 'projektiert' && p.wohnflaeche != null && p.wohnflaeche > 0;
}

const de = (n: number) => n.toLocaleString('de-CH', { maximumFractionDigits: 0 });

/** «Bewilligt: 2 Neubauten mit 36 Wohnungen, rund 2'960 m² Wohnfläche, bis 5 Geschosse». */
export function projektSatz(p: Projekt): string {
  const teile: string[] = [];
  if (p.gebaeude) teile.push(`${p.gebaeude === 1 ? 'ein Neubau' : `${p.gebaeude} Neubauten`} mit ${de(p.wohnungen)} ${p.wohnungen === 1 ? 'Wohnung' : 'Wohnungen'}`);
  else teile.push(p.bauten.length === 1 ? 'ein Bau ohne Wohnungen' : `${p.bauten.length} Bauten ohne Wohnungen`);
  if (p.wohnflaeche) teile.push(`rund ${de(Math.round(p.wohnflaeche / 10) * 10)} m² Wohnfläche`);
  if (p.geschosse) teile.push(`${p.geschosse} ${p.geschosse === 1 ? 'Geschoss' : 'Geschosse'}`);
  const titel = p.status === 'im Bau' ? 'Im Bau' : p.status === 'bewilligt' ? 'Bewilligt' : 'Eingereicht';
  return `${titel}: ${teile.join(', ')}`;
}

/** Der Bau im Kartenviewer des Bundes, mit allen Angaben des Registers (geprüft am 18. November). */
export function registerLink(id: string): string {
  return `https://map.geo.admin.ch/#/map?lang=de&z=12&bgLayer=ch.swisstopo.swissimage&layers=ch.bfs.gebaeude_wohnungs_register@features=${encodeURIComponent(id)}&featureInfo=bottomPanel`;
}

/**
 * Die Parzelle im Kartenviewer des Bundes, mit dem Baustand aller Gebäude
 * eingeblendet: der Weg zum Projekt, wenn das Amtsblatt die Publikation
 * nicht mehr zeigt (geprüft am 18. November mit Kloten 6424).
 */
export function parzelleLink(egrid: string): string {
  return `https://map.geo.admin.ch/#/map?lang=de&swisssearch=${encodeURIComponent(egrid)}&layers=ch.bfs.gebaeude_wohnungs_register&bgLayer=ch.swisstopo.swissimage`;
}

const API = 'https://api3.geo.admin.ch/rest/services/all/MapServer/find';

/** Das Projekt einer Parzelle beim Bund; null, wenn keines eingetragen ist. */
export async function projektLaden(egrid: string, signal?: AbortSignal): Promise<Projekt | null> {
  if (!/^CH[0-9A-Z]{12}$/.test(egrid)) return null;
  const q = new URLSearchParams({ layer: 'ch.bfs.gebaeude_wohnungs_register', searchField: 'egrid', searchText: egrid, contains: 'false', returnGeometry: 'false' });
  const r = await fetch(`${API}?${q}`, { signal });
  if (!r.ok) throw new Error(`Das Gebäuderegister antwortet mit ${r.status}.`);
  const j = await r.json() as { results?: { attributes?: Record<string, unknown>; featureId?: string; id?: string }[] };
  return projektAus(j.results ?? []);
}
