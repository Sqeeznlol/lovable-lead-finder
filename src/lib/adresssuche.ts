/**
 * Die Adresssuche des Bundes, mit dem Gebäuderegister als zweiter Quelle.
 *
 * Am 18. November fand die Adresssuche (SearchServer, origins=address)
 * keine einzige Schweizer Adresse mehr, nur noch Liechtensteiner:
 * «Bahnhofstrasse 1 Zürich» ergab Schaan, auch auf map.geo.admin.ch. Das
 * Amtliche Gebäudeadressverzeichnis, aus dem sie schöpft, kannte in Vaduz
 * die Landstrasse 90 und in Kloten nichts. Zuletzt gefunden hatte sie am
 * 17. November um 15:43 UTC («Reiter prüfen»). Betroffen waren CALC YOU
 * LATER, die Check-Seiten, die Kartensuche, die 3D-Karte, der
 * Portfolio-Import und das Verorten der Baugesuche.
 *
 * Die Volltextsuche im Gebäuderegister auf demselben Dienst kannte jede
 * Adresse, in derselben Schreibweise («Dietlikerstrasse 54 8302 Kloten»),
 * ohne Rücksicht auf Gross und Klein, mit Ort oder Postleitzahl, in 0.5
 * bis 1.2 s. Darum fragen wir beide gleichzeitig.
 *
 * Ohne «@/»-Pfade: tools/baugesuche_laden.ts lädt diese Datei auf dem Runner.
 */
const API = 'https://api3.geo.admin.ch/rest/services';

export type Attrs = Record<string, unknown>;
type Holen = (adresse: string) => Promise<unknown>;

const holenEinfach: Holen = async adresse => {
  const r = await fetch(adresse);
  if (!r.ok) throw new Error(`Der Bund antwortet mit ${r.status}.`);
  return r.json();
};

/** Ob eine Hausnummer in der Eingabe steht: ohne sie findet das Register nur Zufall. */
export const mitHausnummer = (text: string) => /[A-Za-zÄÖÜäöüÉÈÀéèàâçô.]\s+\d+\s?[a-zA-Z]?(\s|,|$)/.test(text);

/**
 * Ein Treffer der Registersuche in der Form der Adresssuche. Nachgesehen
 * am 18. November: Label «Dietlikerstrasse 54 8302 Kloten», Detail
 * «dietlikerstrasse 54 8302 kloten kloten _zh_ 21389 100029284», der Punkt
 * in LV95 nur in geom_st_box2d. Die Adresssuche schreibt den Ort fett und
 * den Punkt in y (Ost) und x (Nord); so lesen ihn alle Stellen weiter.
 */
export function alsAdressTreffer(a: Attrs): Attrs | null {
  const p = String(a.geom_st_box2d ?? '').match(/BOX\(\s*([\d.]+)\s+([\d.]+)/);
  const m = String(a.label ?? '').replace(/<[^>]+>/g, '').trim().match(/^(.*?)\s+(\d{4})\s+(.+)$/);
  if (!p || !m) return null;
  const kt = String(a.detail ?? '').match(/\s_([a-z]{2})_\s/);
  return { ...a, origin: 'address', label: `${m[1]} <b>${m[2]} ${m[3]}</b>`, y: Number(p[1]), x: Number(p[2]), kanton: kt ? kt[1].toUpperCase() : null, quelle: 'register' };
}

// Ohne Angabe ist ein Treffer der Adresssuche eine Adresse.
const art = (a: Attrs) => String(a.origin ?? 'address');
const schluessel = (a: Attrs) => `${art(a)}|${String(a.label ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase()}`;

/**
 * Treffer zur Eingabe, in der Form der Adresssuche (attrs). `origins: null`
 * fragt alle Arten (Adresse, Parzelle, Ort ...) wie ohne Angabe. Die Treffer
 * des Registers tragen den Punkt immer in LV95 (y, x) und in lat/lon.
 *
 * Meldet die Adresssuche nur Ungefähres (fuzzy), gehen die Adressen des
 * Registers vor, und ihre eigenen ungefähren Adressen fallen weg: sonst
 * stünde Schaan vor Zürich. Antwortet keine Quelle, kommt der Fehler der
 * Adresssuche, damit die Seite «antwortet nicht» sagt statt «nicht gefunden».
 */
export async function adressSuche(text: string, o: { limit: number; origins?: string | null; sr?: string; holen?: Holen }): Promise<Attrs[]> {
  const holen = o.holen ?? holenEinfach;
  const q = new URLSearchParams({ type: 'locations', limit: String(o.limit), lang: 'de', searchText: text });
  if (o.origins !== null) q.set('origins', o.origins ?? 'address');
  if (o.sr) q.set('sr', o.sr);
  const r = new URLSearchParams({ type: 'featuresearch', features: 'ch.bfs.gebaeude_wohnungs_register', timeEnabled: 'false',
    limit: String(o.limit), sr: '2056', lang: 'de', searchText: text });
  const adressenGefragt = o.origins === null || (o.origins ?? 'address').split(',').includes('address');
  const [bund, register] = await Promise.all([
    holen(`${API}/ech/SearchServer?${q}`).then(
      j => ({ treffer: (((j as { results?: { attrs?: Attrs }[] })?.results) ?? []).map(x => x.attrs ?? {}), ungefaehr: String((j as { fuzzy?: unknown })?.fuzzy) === 'true', fehler: null as unknown }),
      (f: unknown) => ({ treffer: [] as Attrs[], ungefaehr: true, fehler: f })),
    adressenGefragt && mitHausnummer(text)
      ? holen(`${API}/ech/SearchServer?${r}`).then(
        j => (((j as { results?: { attrs?: Attrs }[] })?.results) ?? []).map(x => alsAdressTreffer(x.attrs ?? {})).filter((x): x is Attrs => !!x),
        () => [] as Attrs[])
      : Promise.resolve([] as Attrs[]),
  ]);
  if (bund.fehler && !register.length) throw bund.fehler;
  const alle = !bund.ungefaehr ? [...bund.treffer, ...register]
    : register.length ? [...register, ...bund.treffer.filter(a => art(a) !== 'address')]
      : bund.treffer;
  const gesehen = new Set<string>();
  return alle.filter(a => { const k = schluessel(a); if (gesehen.has(k)) return false; gesehen.add(k); return true; }).slice(0, o.limit);
}
