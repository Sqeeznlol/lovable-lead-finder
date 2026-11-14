// Baugesuche aus dem Amtsblattportal (amtsblattportal.ch), für die Kantone
// ausser Zürich. Zwei Formate, beide nachgesehen am 14. November 2026 an
// je einer Publikation jeder Unterrubrik:
//   * "BP"-Rubriken (BE, BS, ZG, AR, TI): feste Felder wie projectLocation,
//     projectDescription, districtCadastre, entryDeadline.
//   * "BA"-Rubriken und BL, AM-DA50: allgemeine Elemente unter businessCase,
//     je mit einem key (projectAddress, parcel, buildingContractor ...).
//
// Keine Personendaten: von der Bauherrschaft nur die Rechtsform einer Firma,
// nie ein Name. Der Ablauf läuft ohne npm install, darum ein eigener kleiner
// XML-Leser statt einer Bibliothek.

export interface Knoten { name: string; kinder: Knoten[]; text: string }

const ENTITAET: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
const entschluesseln = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTITAET[e] ?? m);

/** Liest wohlgeformtes XML ohne CDATA in einen Baum; Namensräume fallen weg. */
export function xmlLesen(xml: string): Knoten {
  const wurzel: Knoten = { name: '#', kinder: [], text: '' };
  const stapel = [wurzel];
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(\/?)([\w:.-]+)[^>]*?(\/?)>|([^<]+)/g;
  for (let m = re.exec(xml); m; m = re.exec(xml)) {
    const oben = stapel[stapel.length - 1];
    if (m[4] !== undefined) { oben.text += entschluesseln(m[4]); continue; }
    if (!m[2]) continue;
    const name = m[2].split(':').pop()!;
    if (m[1]) { if (stapel.length > 1) stapel.pop(); continue; }
    const k: Knoten = { name, kinder: [], text: '' };
    oben.kinder.push(k);
    if (!m[3]) stapel.push(k);
  }
  return wurzel;
}

/** Erster Knoten entlang des Pfads (a/b/c), Suche in die Tiefe ab k. */
export function finde(k: Knoten | undefined, pfad: string): Knoten | undefined {
  if (!k) return undefined;
  const [kopf, ...rest] = pfad.split('/');
  for (const c of k.kinder) {
    if (c.name === kopf) {
      const t = rest.length ? finde(c, rest.join('/')) : c;
      if (t) return t;
    }
  }
  for (const c of k.kinder) { const t = finde(c, pfad); if (t) return t; }
  return undefined;
}
const wert = (k: Knoten | undefined, pfad: string) => (finde(k, pfad)?.text ?? '').trim() || null;
/** Mehrsprachiger Text: deutsch, sonst die erste Sprache, die da ist. */
const ohneHtml = (s: string | null) => s ? s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() || null : null;
const sprache = (k: Knoten | undefined) => !k ? null : (wert(k, 'de') ?? k.kinder.map(c => c.text.trim()).find(Boolean) ?? (k.text.trim() || null));

// Rechtsformen nach dem UID-Register; Texte so, wie sie in der Zürcher Quelle
// stehen (alle 30 vorkommenden Codes, gezählt am 14. November 2026).
const RECHTSFORM: Record<number, string> = {
  101: 'Einzelunternehmen', 103: 'Kollektivgesellschaft (KlG)', 104: 'Kommanditgesellschaft (KmG)',
  105: 'Kommanditaktiengesellschaft (KmAG)', 106: 'Aktiengesellschaft (AG)', 107: 'Gesellschaft mit beschränkter Haftung (GmbH)',
  108: 'Genossenschaft', 109: 'Verein', 110: 'Stiftung', 111: 'Zweigniederlassung eines ausländischen Unternehmens',
  113: 'Besondere Rechtsform', 114: 'Kommanditgesellschaft für kollektive Kapitalanlagen (KmGK)',
  115: 'Investmentgesellschaft mit variablem Kapital (SICAV)', 116: 'Investmentgesellschaft mit festem Kapital (SICAF)',
  117: 'Institut des öffentlichen Rechts', 119: 'Haupt von Gemeinderschaft', 151: 'Zweigniederlassung',
  220: 'Verwaltungseinheit des Bundes', 221: 'Verwaltungseinheit des Kantons', 222: 'Verwaltungseinheit des Bezirks',
  223: 'Verwaltungseinheit der Gemeinde', 224: 'Andere öffentlich-rechtliche Verwaltungseinheit',
  230: 'Einrichtung des öffentlichen Rechts des Bundes', 231: 'Einrichtung des öffentlichen Rechts des Kantons',
  233: 'Einrichtung des öffentlichen Rechts der Gemeinde', 234: 'Andere Einrichtung des öffentlichen Rechts',
  302: 'Einfache Gesellschaft', 312: 'Betriebsstätte oder Schweizer Vertretung eines ausländischen Unternehmens',
  329: 'Internationale Organisation', 441: 'Ausländisches Unternehmen',
};
const rechtsform = (k: Knoten | undefined) => { const c = Number(wert(k, 'legalForm')); return c ? RECHTSFORM[c] ?? null : null; };

/**
 * Punkt in LV95 aus den Schreibweisen der Kantone: "2'739'576 / 1'242'457" (AR),
 * "2'647'793 1'137'497" (VS), "2609737,073 / 1212345,1" (BE). Sechsstellig (LV03)
 * wird umgerechnet. Nur Punkte in der Schweiz; Bern schrieb einmal zweimal Ost.
 */
export function punktAus(text: string | null): { e: number; n: number } | null {
  const z = [...(text ?? '').matchAll(/\d[\d'’]*(?:[.,]\d+)?/g)].map(m => Number(m[0].replace(/['’]/g, '').replace(',', '.')));
  if (z.length !== 2) return null;
  let [e, n] = z;
  if (e < 1e6 && n < 1e6) { e += 2e6; n += 1e6; }
  return e > 2480000 && e < 2840000 && n > 1070000 && n < 1300000 ? { e, n } : null;
}

/**
 * Wo die Publikation lesbar ist: im Amtsblatt des Kantons, nicht auf
 * amtsblattportal.ch (dort bleibt die Detailseite leer). Je Mandant geprüft
 * am 14. November 2026 an einer echten Publikation jeder Rubrik: die Seite
 * zeigt die Nummer, /api/v1/publications/{id}/pdf liefert %PDF.
 */
export const AMTSBLATT: Record<string, string> = {
  kabbe: 'https://amtsblatt.be.ch', kabda: 'https://epublikation.ch', kabbs: 'https://kantonsblatt.ch', kabbl: 'https://amtsblatt.bl.ch',
  kabzg: 'https://amtsblatt.zg.ch', kabar: 'https://amtsblatt.ar.ch', kabti: 'https://foglioufficiale.ti.ch', kabsz: 'https://amtsblatt.sz.ch',
  kabso: 'https://amtsblatt.so.ch', kabsh: 'https://amtsblatt.sh.ch', kabow: 'https://amtsblatt.ow.ch', kabnw: 'https://amtsblatt.nw.ch',
  kabvs: 'https://amtsblatt.vs.ch',
};
export const publikationSeite = (g: Pick<Gesuch, 'id' | 'mandant'>) =>
  g.mandant && AMTSBLATT[g.mandant] ? `${AMTSBLATT[g.mandant]}/#!/search/publications/detail/${g.id}` : null;

export interface Gesuch {
  id: string; nummer: string | null; datum: string; kanton: string | null; bfs: string | null; gemeinde: string | null;
  strasse: string | null; plz: string | null; ort: string | null; parzelle: string | null; beschreibung: string | null;
  bauherrschaft: string | null; einspracheBis: string | null; publiziertBis: string | null; punkt: { e: number; n: number } | null;
  /** Titel der Publikation; nur zum Suchen, er kann einen Namen enthalten. */
  titel: string | null;
  /** Herausgeber (primaryTenantCode), bestimmt die Adresse der Publikation. */
  mandant: string | null;
}

export function gesuchAus(xml: string): Gesuch | null {
  const w = xmlLesen(xml), meta = finde(w, 'meta'), inhalt = finde(w, 'content');
  const id = wert(meta, 'id'), datum = wert(meta, 'publicationDate');
  if (!id || !datum || !inhalt) return null;
  const g: Gesuch = {
    id, nummer: wert(meta, 'publicationNumber'), datum: datum.slice(0, 10), kanton: wert(meta, 'cantons'),
    bfs: wert(inhalt, 'localization/municipalityId/key'), gemeinde: sprache(finde(inhalt, 'localization/municipalityId/term')),
    strasse: null, plz: null, ort: null, parzelle: null, beschreibung: null, bauherrschaft: null,
    einspracheBis: wert(inhalt, 'entryDeadline') ?? wert(inhalt, 'reaction/element/deadline/date'),
    publiziertBis: wert(meta, 'expirationDate')?.slice(0, 10) ?? null, punkt: null,
    titel: sprache(finde(meta, 'title')), mandant: wert(meta, 'primaryTenantCode'),
  };
  const adresse = (a: Knoten | undefined) => {
    if (!a) return;
    g.strasse = [wert(a, 'street'), wert(a, 'houseNumber')].filter(Boolean).join(' ') || null;
    g.plz = wert(a, 'swissZipCode'); g.ort = wert(a, 'town');
  };
  const fall = finde(inhalt, 'businessCase');
  if (!fall) {
    adresse(finde(inhalt, 'projectLocation/address'));
    g.beschreibung = wert(inhalt, 'projectDescription');
    const kat = finde(inhalt, 'districtCadastre/relation');
    g.parzelle = wert(kat, 'plot') ?? wert(kat, 'property') ?? wert(kat, 'parcel');
    g.punkt = punktAus(wert(kat, 'coordinate'));
    const bh = finde(inhalt, 'buildingContractor');
    g.bauherrschaft = wert(bh, 'legalEntity/selectType') === 'person' ? null : rechtsform(bh);
  } else {
    g.beschreibung = sprache(finde(finde(fall, 'primary'), 'valueText/term'));
    // Jedes Element steckt in einem eigenen <secondary> (Amtsblatt Bern: sieben Stück).
    const elemente = fall.kinder.filter(k => k.name === 'secondary').flatMap(s => s.kinder.filter(k => k.name === 'element'));
    for (const el of elemente) {
      const key = wert(el, 'key'), titel = sprache(finde(el, 'term')) ?? '';
      const neutral = wert(el, 'valueTextNeutral') ?? sprache(finde(el, 'valueText/term'));
      if (key === 'projectAddress') adresse(finde(el, 'address'));
      // Der Titel zuerst: in Schwyz nennt die Beschreibung den Projektverfasser.
      else if (key === 'projectDescription') g.beschreibung ??= ohneHtml(sprache(finde(el, 'valueRichText')));
      else if (key === 'parcel' && neutral) {
        // Basel-Landschaft: "899 - Allmendweg 38", Parzelle und Strasse in einem Feld.
        const [nr, str] = neutral.split(/\s+-\s+/);
        g.parzelle = nr.trim() || null;
        // Wallis: "Parzellen-Nr 503, Plan Nr 6, Im Orte genannt Alpmatte".
        const vs = /^Parzellen?-?Nr\.?\s*([\d, ]+\d)/i.exec(g.parzelle ?? '');
        if (vs) g.parzelle = vs[1];
        if (!g.strasse && str) g.strasse = str.trim();
      } else if (key === 'coordinates') g.punkt ??= punktAus(neutral);
      else if (key === 'geoview') {
        const u = wert(el, 'url/de') ?? '', x = /map_x=(\d+)/.exec(u)?.[1], y = /map_y=(\d+)/.exec(u)?.[1];
        g.punkt ??= punktAus(x && y ? `${x}/${y}` : null);
      } else if ((key === 'buildingContractor' || key === 'applicantParty') && !g.bauherrschaft)
        g.bauherrschaft = wert(el, 'subject/selectType') === 'legalPerson' ? rechtsform(finde(el, 'subject/legalPerson')) : null;
      else if (/projektgemeinde/i.test(titel) && neutral && !g.ort) {
        const m = /^(\d{4})\s+(.+)$/.exec(neutral);
        if (m) { g.plz = m[1]; g.ort = m[2]; }
      }
    }
  }
  return g;
}

/** Erste Hausnummer: "26a und 26b", "17, 19 und 21", "86 & 88", "3-5", "22f bis 22q". */
export const ersteNummer = (strasse: string) => strasse.replace(/^(.*?\d+\s?[a-z]?)(?:\s*(?:und|&|bis|,|\/|-|\+)\s*\d.*)$/i, '$1').trim();

/** Die Adresse so, wie sie die Adresssuche des Bundes am besten findet. */
export const adresseText = (g: Gesuch) => [g.strasse && ersteNummer(g.strasse), [g.plz, g.ort ?? g.gemeinde].filter(Boolean).join(' ')].filter(Boolean).join(', ');

/**
 * Eingaben für die Adresssuche, die beste zuerst. Ortsteil und Gemeinde
 * weichen ab (Zug: "Alosen" in Oberägeri); Bern nennt die Adresse teils
 * nur im Titel ("Baugesuch – Hühnerbühlstrasse 163, Bolligen").
 */
export function suchtexte(g: Gesuch): { text: string; ausTitel: boolean }[] {
  const aus: { text: string; ausTitel: boolean }[] = [];
  if (g.strasse) {
    const s = ersteNummer(g.strasse);
    aus.push({ text: adresseText(g), ausTitel: false });
    if (g.gemeinde) aus.push({ text: `${s}, ${g.gemeinde.replace(/\s*\(\w{2}\)$/, '')}`, ausTitel: false });
  } else if (g.titel) {
    const t = g.titel.replace(/^[^:–-]*(?:baugesuch|demande[^:–-]*|domanda[^:–-]*)\s*[:–-]\s*/i, '').trim();
    if (t && t !== g.titel && /\d/.test(t)) aus.push({ text: ersteNummer(t.split(',')[0]) + (t.includes(',') ? `, ${t.split(',').slice(1).join(',').trim()}` : ''), ausTitel: true });
  }
  return [...new Map(aus.map(a => [a.text, a])).values()];
}
