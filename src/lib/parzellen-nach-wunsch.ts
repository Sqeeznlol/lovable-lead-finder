/**
 * Parzellen nach Wunsch: feste Ordner mit Parzellen, die ein Kriterium
 * erfüllen (19. November: über 3000 m², mehrheitlich in der Bauzone, in
 * Sarnen und fünf Nidwaldner Gemeinden). Die Zonenarten sind die
 * harmonisierten des Bundes (Bauzonen Schweiz), nicht die Namen der
 * Gemeinde: nur so lassen sich Gemeinden vergleichen.
 */
export interface WunschOrdner { id: string; name: string; kriterium: string; quelle: string; stand: string }
export interface WunschParzelle {
  egrid: string; kanton: string; bfs: number; gemeinde: string; nummer: string; flaeche: number;
  zone: string; bauzone_anteil: number; e: number; n: number; lat: number; lon: number;
  /** Seit der dritten Lieferung: ob ein Gebäude steht, und womit die Erschliessung belegt ist. */
  bebaut?: boolean | null; nachweis?: string | null;
}

/** Wo gewohnt werden darf: dort sucht Bauraum zuerst. */
export const WOHNEN = new Set(['Wohnzonen', 'Mischzonen', 'Zentrumszonen']);

export const ZONE_KURZ: Record<string, string> = {
  'Wohnzonen': 'Wohnzone',
  'Mischzonen': 'Mischzone',
  'Zentrumszonen': 'Zentrumszone',
  'Arbeitszonen': 'Arbeitszone',
  'Zonen für öffentliche Nutzungen': 'Zone für öffentliche Nutzungen',
  'eingeschränkte Bauzonen': 'eingeschränkte Bauzone',
  'Tourismus- und Freizeitzonen': 'Tourismus- und Freizeitzone',
  'Verkehrszonen innerhalb der Bauzonen': 'Verkehrszone in der Bauzone',
  'weitere Bauzonen': 'weitere Bauzone',
};

/** Die Parzelle auf der Karte des Bundes, mit Grenzen der Vermessung über dem Luftbild. */
export function geoAdminLink(p: Pick<WunschParzelle, 'e' | 'n'>): string {
  return `https://map.geo.admin.ch/?lang=de&E=${Math.round(p.e)}&N=${Math.round(p.n)}&zoom=11&crosshair=marker`
    + '&bgLayer=ch.swisstopo.swissimage&layers=ch.kantone.cadastralwebmap-farbe';
}

const feld = (v: string | number) => {
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Für Excel mit Strichpunkt, wie die Lead-Listen. */
export function wunschCsv(z: WunschParzelle[]): string {
  const kopf = ['Kanton', 'Gemeinde', 'Parzelle', 'EGRID', 'Fläche m²', 'Zone', 'Anteil Bauzone', 'Bebaut', 'Erschliessung', 'Ost', 'Nord', 'Karte'];
  return [kopf, ...z.map(p => [p.kanton, p.gemeinde, p.nummer, p.egrid, p.flaeche, ZONE_KURZ[p.zone] ?? p.zone,
    `${Math.round(p.bauzone_anteil * 100)} %`, p.bebaut == null ? '' : p.bebaut ? 'ja' : 'nein', p.nachweis ?? '', Math.round(p.e), Math.round(p.n), geoAdminLink(p)])]
    .map(r => r.map(feld).join(';')).join('\r\n');
}

// ------------------------------------------------------------- Favoriten

/**
 * Eine Parzelle, die jemand ausfindig machen will (Julian, 20. November:
 * «Button ... ausfindig machen, dann ist es wo, wo man die Daten ausfüllen
 * kann, aber weg von der Filterseite»). Die Angaben der Parzelle sind
 * mitgeschrieben: ein Ordner wird mit jeder Lieferung ersetzt, der Favorit
 * bleibt (Migration 20261120150000).
 */
export type FavoritStand = 'suchen' | 'gefunden' | 'kontaktiert' | 'interesse' | 'kein_interesse';
export const STAND: [FavoritStand, string][] = [
  ['suchen', 'Eigentümer suchen'], ['gefunden', 'Eigentümer gefunden'], ['kontaktiert', 'Kontaktiert'],
  ['interesse', 'Interesse'], ['kein_interesse', 'Kein Interesse'],
];
export interface WunschFavorit {
  egrid: string; erstellt_am: string; geaendert_am: string; von: string | null;
  kanton: string; gemeinde: string; nummer: string; flaeche: number; zone: string; e: number; n: number; lat: number; lon: number;
  stand: FavoritStand; eigentuemer: string | null; adresse: string | null; telefon: string | null; email: string | null; notiz: string | null;
}
export type FavoritAngaben = Pick<WunschFavorit, 'stand' | 'eigentuemer' | 'adresse' | 'telefon' | 'email' | 'notiz'>;

/** Was beim «Ausfindig machen» aus dem Ordner mitgeht. */
export function favoritAus(p: WunschParzelle, von: string): Omit<WunschFavorit, 'erstellt_am' | 'geaendert_am' | 'stand' | 'eigentuemer' | 'adresse' | 'telefon' | 'email' | 'notiz'> {
  return { egrid: p.egrid, von: von.trim() || null, kanton: p.kanton, gemeinde: p.gemeinde, nummer: p.nummer, flaeche: p.flaeche, zone: p.zone, e: p.e, n: p.n, lat: p.lat, lon: p.lon };
}

/** Die Filterliste zeigt, was noch niemand ausfindig macht. */
export function ohneFavoriten<T extends { egrid: string }>(liste: T[], favoriten: { egrid: string }[]): T[] {
  const weg = new Set(favoriten.map(f => f.egrid));
  return liste.filter(p => !weg.has(p.egrid));
}
