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
