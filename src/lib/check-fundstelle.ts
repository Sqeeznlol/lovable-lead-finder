/**
 * Jede Zahl mit Fundstelle (Julian, 19. November, nach dem Vergleich mit
 * baugesuch.prüfer.ch: «mach Punkt 1 und 5 für alle Checker»): woher der
 * Wert kommt, welcher Artikel sagt, wie er gemessen wird, mit Zitat, und
 * die Rechnung, Zahl für Zahl.
 *
 * Zwei Quellen, getrennt gehalten:
 *   * Der Wert (Ausnützungsziffer 0.6 in der Zone W2) steht im Zonenplan
 *     des Kantons, den die Seite abfragt; die Bauordnung der Gemeinde, in
 *     der er beschlossen ist, verlinkt der ÖREB-Kataster.
 *   * Wie die Ziffer gemessen wird, steht im Bau- und Planungsrecht des
 *     Kantons. Diese Artikel sind wörtlich aus der amtlichen
 *     Gesetzessammlung abgeschrieben (Adresse und Stand je Eintrag in
 *     check-gesetze.json; am 19. November 49 Stellen geöffnet und mit dem
 *     Quelltext abgeglichen). Steht für einen Kanton keiner, sagt die Seite
 *     das, statt einen zu nennen.
 *   * In Zürich, Luzern und im Aargau gilt in Gemeinden, die ihre
 *     Bauordnung noch nicht angepasst haben, das bisherige Recht. Welche
 *     Gemeinde das ist, wissen wir nicht: die Seite nennt darum beide
 *     Fassungen und sagt, wann welche gilt.
 *   * Die Ausnützungsziffer ist nicht die Geschossflächenziffer. Kennt ein
 *     Kanton nur die zweite (Solothurn, Thurgau, Schaffhausen), steht die
 *     Ausnützungsziffer in der Bauordnung der Gemeinde, und die Seite
 *     zitiert keinen kantonalen Artikel dafür.
 *
 * Die Artikelnummer in der Bauordnung jeder Gemeinde kennen wir nicht: die
 * Seite nennt sie nicht und verlinkt das Dokument.
 *
 * Julian, 15. November: die Quellen nicht in jeder Zeile. Darum steht die
 * Fundstelle zum Aufklappen unter der Rechnung, nicht neben jeder Zahl.
 */
import gesetze from './check-gesetze.json';
import type { Ziffern } from './check-modell';

export type Begriff = 'az' | 'gfz' | 'bmz' | 'uez' | 'gruen' | 'vollgeschoss';
export interface Gesetz {
  kanton: string; begriff: Begriff;
  /** «Planungs- und Baugesetz (PBG)» */
  erlass: string;
  /** Systematische Nummer, z. B. «LS 700.1». */
  nummer: string;
  /** «§ 255 Abs. 1» */
  artikel: string;
  zitat: string;
  url: string;
  stand: string;
  /** neu: geltendes Recht; bisher: gilt noch in Gemeinden mit nicht angepasster Bauordnung. */
  fassung: 'neu' | 'bisher';
}
export const GESETZE: Gesetz[] = gesetze as Gesetz[];

export const BEGRIFF_TEXT: Record<Begriff, string> = {
  az: 'Ausnützungsziffer', gfz: 'Geschossflächenziffer', bmz: 'Baumassenziffer', uez: 'Überbauungsziffer', gruen: 'Grünflächenziffer', vollgeschoss: 'Vollgeschoss',
};

/**
 * Der Artikel, der im Kanton sagt, wie der Begriff gemessen wird: das
 * geltende Recht, sonst das bisherige; null, wenn keiner nachgelesen ist.
 * Nie ein anderer Begriff an seiner Stelle.
 */
export function gesetzFuer(kanton: string | null | undefined, begriff: Begriff): Gesetz | null {
  if (!kanton) return null;
  return GESETZE.find(g => g.kanton === kanton && g.begriff === begriff && g.fassung === 'neu')
    ?? GESETZE.find(g => g.kanton === kanton && g.begriff === begriff && g.fassung === 'bisher') ?? null;
}
/** Das bisherige Recht neben dem geltenden, wenn es beides gibt. */
export function bisherFuer(kanton: string | null | undefined, begriff: Begriff): Gesetz | null {
  if (!kanton || !GESETZE.some(g => g.kanton === kanton && g.begriff === begriff && g.fassung === 'neu')) return null;
  return GESETZE.find(g => g.kanton === kanton && g.begriff === begriff && g.fassung === 'bisher') ?? null;
}
export const BISHER_SATZ = 'Hat Ihre Gemeinde die Bauordnung noch nicht ans neue Recht angepasst, gilt noch das bisherige:';
export const NUR_BISHER_SATZ = 'Bisheriges Recht; es gilt, bis Ihre Gemeinde die Bauordnung angepasst hat.';

/**
 * Der Stand, kurz: «Stand 1. Februar 2026» oder «Nachtrag 134». Die lange
 * Angabe aus der Sammlung bleibt in check-gesetze.json.
 */
export function standKurz(g: Pick<Gesetz, 'stand'>): string {
  const m = g.stand.match(/Stand(?: am)? ([^);,]+)/);
  return m ? `Stand ${m[1].trim()}` : g.stand.split(/\s*[(;,]/)[0].trim();
}

/** Kurz für die Zeile: «§ 255 Abs. 1 PBG ZH». */
export const gesetzKurz = (g: Gesetz) => `${g.artikel} ${g.erlass.match(/\(([^)]+)\)/)?.[1] ?? g.erlass} ${g.kanton}`;

const m2 = (x: number) => `${Math.round(x).toLocaleString('de-CH')} m²`;
const m3 = (x: number) => `${Math.round(x).toLocaleString('de-CH')} m³`;
const ziffer = (x: number) => x.toLocaleString('de-CH', { maximumFractionDigits: 2 });

export interface Haus { grundflaeche: number | null; geschosse: number | null }

export interface Fundstelle {
  /** «Ausnützungsziffer 0.6» */
  titel: string;
  /** Woher der Wert kommt. */
  vorgabe: string;
  /** Die Bauordnung der Gemeinde, wenn der ÖREB-Kataster sie nennt. */
  ordnung: { titel: string; url: string } | null;
  gesetz: Gesetz | null;
  /** Das bisherige Recht, wenn es neben dem geltenden noch gelten kann. */
  bisher: Gesetz | null;
  /** Die Rechnung, eine Zeile je Schritt, mit den Zahlen der Parzelle. */
  rechnung: string[];
  /** Gesetzt, wenn eine Zahl nicht amtlich ist (Regler, Schätzung). */
  annahme: string | null;
  /** Möglich, heute und Reserve, in der Einheit der Rechnung. */
  moeglich: number; heute: number | null; reserve: number | null; einheit: 'm²' | 'm³';
}

/**
 * Die Rechnung der Baureserve mit Fundstelle. Mit Baumassenziffer in
 * Volumen (Kubikmeter), sonst in Geschossfläche mit der Ausnützungsziffer.
 * `az` ist der Wert, mit dem gerechnet wird: aus dem Plan oder vom Regler.
 */
export function fundstelle(o: {
  kanton: string | null; ziffern: Ziffern | null; flaeche: number; az: number;
  haeuser: Haus[]; volumenHeute: number | null; ordnung?: { titel: string; url: string } | null;
}): Fundstelle {
  const z = o.ziffern;
  const zone = z ? [z.zone, z.kuerzel && z.zone && !z.zone.includes(z.kuerzel) ? `(${z.kuerzel})` : null].filter(Boolean).join(' ') : null;
  const quelle = z?.quelle ?? null;
  const ordnung = o.ordnung ?? null;

  if (z?.az == null && z?.bmz != null) {
    const moeglich = Math.round(z.bmz * o.flaeche);
    const reserve = o.volumenHeute != null ? Math.max(0, moeglich - o.volumenHeute) : null;
    return {
      titel: `Baumassenziffer ${ziffer(z.bmz)}`,
      vorgabe: `${quelle ?? 'Zonenplan des Kantons'}${zone ? `, Zone ${zone}` : ''}: Baumassenziffer ${ziffer(z.bmz)}`,
      ordnung, gesetz: gesetzFuer(o.kanton, 'bmz'), bisher: bisherFuer(o.kanton, 'bmz'),
      rechnung: [
        `Möglich: ${m2(o.flaeche)} Grundstück × ${ziffer(z.bmz)} = ${m3(moeglich)} Bauvolumen über dem Boden`,
        o.volumenHeute != null ? `Heute: ${m3(o.volumenHeute)} Gebäudevolumen laut Gebäuderegister` : 'Heute: das Gebäuderegister führt kein Volumen; wir messen es in der Analyse',
        ...(reserve != null ? [`Baureserve: ${m3(moeglich)} − ${m3(o.volumenHeute!)} = ${reserve > 0 ? m3(reserve) : 'keine'}`] : []),
      ],
      annahme: null, moeglich, heute: o.volumenHeute, reserve, einheit: 'm³',
    };
  }

  const ausPlan = z?.az != null && Math.abs(z.az - o.az) < 0.005;
  const moeglich = Math.round(o.az * o.flaeche);
  const mitWert = o.haeuser.filter(h => h.grundflaeche);
  const heute = Math.round(mitWert.reduce((s, h) => s + (h.grundflaeche ?? 0) * (h.geschosse ?? 1), 0));
  const heuteZeile = !mitWert.length
    ? 'Heute: kein Gebäude im Register, also 0 m²'
    : mitWert.length === 1
      ? `Heute: ${m2(mitWert[0].grundflaeche!)} Grundfläche × ${mitWert[0].geschosse ?? 1} Geschoss${(mitWert[0].geschosse ?? 1) === 1 ? '' : 'e'} = ${m2(heute)} (Gebäuderegister)`
      : `Heute: ${mitWert.length} Gebäude, je Grundfläche × Geschosse, zusammen ${m2(heute)} (Gebäuderegister)`;
  const reserve = Math.max(0, moeglich - heute);
  return {
    titel: `Ausnützungsziffer ${ziffer(o.az)}`,
    vorgabe: ausPlan
      ? `${quelle ?? 'Zonenplan des Kantons'}${zone ? `, Zone ${zone}` : ''}: Ausnützungsziffer ${ziffer(z!.az!)}`
      : z?.az != null
        ? `Zonenplan: Ausnützungsziffer ${ziffer(z.az)}; gerechnet mit Ihrem Wert ${ziffer(o.az)}`
        : `Der Zonenplan des Kantons nennt für diese Stelle keine Ausnützungsziffer; gerechnet mit ${ziffer(o.az)}`,
    ordnung, gesetz: gesetzFuer(o.kanton, 'az'), bisher: bisherFuer(o.kanton, 'az'),
    rechnung: [
      `Möglich: ${m2(o.flaeche)} Grundstück × ${ziffer(o.az)} = ${m2(moeglich)} Geschossfläche`,
      heuteZeile,
      `Baureserve: ${m2(moeglich)} − ${m2(heute)} = ${reserve > 0 ? m2(reserve) : 'keine'}`,
    ],
    annahme: ausPlan ? null : z?.az != null ? 'Mit dem Regler eingestellt, nicht der Wert des Zonenplans.' : 'Annahme: den gültigen Wert Ihrer Zone prüfen wir in der Analyse.',
    moeglich, heute, reserve, einheit: 'm²',
  };
}

/** Die Fundstelle als Zeilen für den Bericht (PDF): Vorgabe, Gesetz mit Zitat, Rechnung. */
export function fundstelleZeilen(f: Fundstelle): { titel: string; wert: string; zusatz?: string }[] {
  return [
    { titel: 'Vorgabe', wert: f.vorgabe, zusatz: f.ordnung ? `Beschlossen in: ${f.ordnung.titel}` : undefined },
    f.gesetz
      ? { titel: 'Gesetz', wert: `${f.gesetz.artikel} ${f.gesetz.erlass}, Kanton ${f.gesetz.kanton}`,
          zusatz: `«${f.gesetz.zitat}»${f.gesetz.fassung === 'bisher' ? ` ${NUR_BISHER_SATZ}` : ''} ${standKurz(f.gesetz)}` }
      : { titel: 'Gesetz', wert: 'Wie die Ziffer gemessen wird, regelt das Baurecht des Kantons oder die Bauordnung der Gemeinde; diese Stelle prüfen wir in der Analyse.' },
    ...(f.bisher ? [{ titel: '', wert: `${BISHER_SATZ} ${f.bisher.artikel} ${f.bisher.erlass}`, zusatz: `«${f.bisher.zitat}»` }] : []),
    ...f.rechnung.map((r, i) => ({ titel: i === 0 ? 'Rechnung' : '', wert: r })),
    ...(f.annahme ? [{ titel: 'Hinweis', wert: f.annahme }] : []),
  ];
}

/** Wie das Haus heute steht und was die Zone erlaubt, für den Schnitt. Null, wenn die Zone keine Geschosse nennt. */
export function schnittDaten(z: Ziffern | null, heuteGeschosse: number | null): { heute: number; erlaubt: number; dach: 'attika' | 'dach' | null; hoehe: number | null } | null {
  if (!z?.vollgeschosse) return null;
  return {
    heute: Math.max(0, Math.min(12, heuteGeschosse ?? 0)),
    erlaubt: Math.min(12, z.vollgeschosse),
    dach: z.attika ? 'attika' : z.dachgeschosse ? 'dach' : null,
    hoehe: z.gesamthoehe ?? z.gebaeudehoehe ?? null,
  };
}
