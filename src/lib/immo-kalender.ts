/**
 * Immo-Kalender: Messen, Kongresse und Foren der Immobilienbranche.
 *
 * Julian (1. November): "ein schöner Kalender, welcher jede Messe von
 * Immobilien anzeigt, wann, wo, Adresse". Recherchiert am 1. November
 * 2026 auf den Seiten der Veranstalter. Steht ein Datum dort noch nicht,
 * bleibt es leer und der Anlass erscheint unter "Datum offen" -- lieber
 * eine Lücke als ein geratenes Datum. `quelle` ist die Seite, auf der
 * das Datum stand; vor einer Reise dort nachsehen.
 *
 * Nachführen: neue Ausgabe eintragen, sobald der Veranstalter sie
 * publiziert, und `stand` setzen.
 */
export const STAND = '2026-11-01';

export type AnlassArt = 'messe' | 'kongress' | 'forum' | 'tagung';
export interface Anlass {
  name: string; art: AnlassArt; von: string | null; bis: string | null;
  ort: string | null; haus: string | null; adresse: string | null; land: string;
  url: string; fuer: string; quelle: string | null; bemerkung: string;
}

export const ANLAESSE: Anlass[] = [
  { name: 'The Swiss Real Estate Conference (Zürcher Kantonalbank)', art: 'kongress', von: '2026-11-03', bis: '2026-11-04', ort: 'Zürich', haus: null, adresse: null, land: 'CH',
    url: 'https://broker.zkb.ch/en/conferences', fuer: 'Institutionelle, Fonds, Anlagestiftungen, kotierte Immobiliengesellschaften', quelle: 'https://broker.zkb.ch/en/conferences',
    bemerkung: 'Nur auf Einladung (Corporate Access). Ort auf der Seite der ZKB nicht genannt.' },
  { name: 'Bauen Wohnen Energie Bern', art: 'messe', von: '2026-11-05', bis: '2026-11-08', ort: 'Bern', haus: 'BERNEXPO-Areal', adresse: 'Mingerstrasse 6, 3014 Bern', land: 'CH',
    url: 'https://bernexpo.ch/de/kalender', fuer: 'Private, Bauherren, Eigentümer', quelle: 'https://bernexpo.ch/de/kalender',
    bemerkung: 'Publikumsmesse Bauen, Sanieren, Wohnen, Energie (23. Ausgabe).' },
  { name: "PwC's Emerging Trends in Real Estate 2027 · Zürich", art: 'tagung', von: '2026-11-25', bis: '2026-11-25', ort: 'Zürich', haus: 'Park Hyatt Zürich', adresse: null, land: 'CH',
    url: 'https://www.pwc.ch/de/veranstaltungen/etre-2027.html', fuer: 'Institutionelle, Fonds, Investoren, Entwickler', quelle: 'https://www.pwc.ch/de/veranstaltungen/etre-2027.html',
    bemerkung: 'Vorstellung der Studie von PwC und ULI für die Schweiz und Europa.' },
  { name: 'Swiss Public Real Estate Forum (SPREF) 2026', art: 'forum', von: '2026-11-26', bis: '2026-11-26', ort: 'Aarau', haus: 'Kultur- und Kongresshaus Aarau', adresse: 'Schlossplatz 9, 5000 Aarau', land: 'CH',
    url: 'https://spref.ch/', fuer: 'Öffentliche Eigentümer (Bund, Kantone, Gemeinden), Portfoliomanager', quelle: 'https://spref.ch/',
    bemerkung: 'Partnerin ist die BFH.' },
  { name: "PwC's Emerging Trends in Real Estate 2027 · Romandie", art: 'tagung', von: '2026-12-02', bis: '2026-12-02', ort: null, haus: null, adresse: null, land: 'CH',
    url: 'https://www.pwc.ch/fr/evenements/etre-2027.html', fuer: 'Institutionelle, Fonds, Investoren', quelle: 'https://www.pwc.ch/fr/evenements/etre-2027.html',
    bemerkung: 'Ort auf der Seite noch nicht genannt.' },
  { name: 'IMMO27 · The Swiss Property Fair for Investors', art: 'messe', von: '2027-01-13', bis: '2027-01-14', ort: 'Zürich', haus: 'Halle 550, Zürich-Oerlikon', adresse: 'Birchstrasse 150, 8050 Zürich', land: 'CH',
    url: 'https://www.swisspropertyfair.ch/', fuer: 'Institutionelle, Fonds, Anlagestiftungen, Pensionskassen, Asset Manager', quelle: 'https://www.swisspropertyfair.ch/',
    bemerkung: 'Mit IMMO Forum. Veranstalter MV Invest und Swiss Circle, SVIT ist Partner. Mittwoch 7.45–18 Uhr, Donnerstag 7.45–17 Uhr. Tickets ab Mitte Dezember.' },
  { name: 'SGKB Immobilienforum 2027', art: 'forum', von: null, bis: null, ort: 'St. Gallen', haus: 'Halle St.Galler Kantonalbank', adresse: null, land: 'CH',
    url: 'https://www.sgkb.ch/de/ueber-uns/medien/mitteilungen', fuer: 'Bau- und Immobilienbranche Ostschweiz, Investoren', quelle: null,
    bemerkung: 'Findet jeweils im Januar statt (rund 1000 Teilnehmende); Datum 2027 noch nicht publiziert.' },
  { name: 'QUO VADIS 2027 (Heuer Dialog)', art: 'kongress', von: null, bis: null, ort: 'Berlin', haus: null, adresse: null, land: 'DE',
    url: 'https://www.heuer-dialog.de/', fuer: 'Führungskräfte der Immobilienwirtschaft, Investoren', quelle: null,
    bemerkung: 'Datum beim Veranstalter noch nicht publiziert; 2026 war es der 9.–11. Februar.' },
  { name: 'Bauen+Wohnen Luzern', art: 'messe', von: '2027-02-26', bis: '2027-02-28', ort: 'Luzern', haus: 'KKL Luzern', adresse: null, land: 'CH',
    url: 'https://www.bauen-wohnen.ch/', fuer: 'Private, Bauherren, Eigentümer', quelle: 'https://www.bauen-wohnen.ch/',
    bemerkung: '26. Ausgabe, ZT Fachmessen.' },
  { name: 'MIPIM 2027', art: 'messe', von: '2027-03-16', bis: '2027-03-19', ort: 'Cannes', haus: 'Palais des Festivals', adresse: '1 Boulevard de la Croisette, 06400 Cannes', land: 'FR',
    url: 'https://www.mipim.com/', fuer: 'Institutionelle, Fonds, Investoren, Entwickler, Städte', quelle: 'https://www.mipim.com/en-gb/practical-information.html',
    bemerkung: 'Swiss Circle organisiert den Schweizer Gemeinschaftsstand.' },
  { name: 'Bauen+Wohnen Aargau', art: 'messe', von: '2027-04-08', bis: '2027-04-11', ort: 'Wettingen', haus: 'Tägi Wettingen', adresse: null, land: 'CH',
    url: 'https://www.fachmessen.ch/de/messetermine', fuer: 'Private, Bauherren, Eigentümer', quelle: 'https://www.fachmessen.ch/de/messetermine',
    bemerkung: '20. Ausgabe, ZT Fachmessen.' },
  { name: 'ImmoAusblick UBS 2027 (SVIT Bern)', art: 'tagung', von: '2027-04-21', bis: '2027-04-21', ort: 'Ittigen', haus: 'Haus des Sports', adresse: null, land: 'CH',
    url: 'https://www.svit.ch/de/svit-bern/event/immoausblick-ubs-ag-2027', fuer: 'SVIT-Mitglieder, Immobilienfachleute Region Bern', quelle: 'https://www.svit.ch/de/svit-bern/event/immoausblick-ubs-ag-2027',
    bemerkung: '17.30–21 Uhr.' },
  { name: 'Konferenz Real Estate Investment und Asset Management 2027 (HSLU/IFZ)', art: 'tagung', von: '2027-05-11', bis: '2027-05-11', ort: null, haus: null, adresse: null, land: 'CH',
    url: 'https://www.hslu.ch/en/lucerne-school-of-business/calendar/events/2027/05/11/konferenz-real-estate-investment-und-asset-management', fuer: 'Pensionskassen, Institutionelle, Asset Manager',
    quelle: 'https://www.hslu.ch/en/lucerne-school-of-business/calendar/events/2027/05/11/konferenz-real-estate-investment-und-asset-management',
    bemerkung: 'Datum aus der Adresse der Veranstaltungsseite, Programm und Ort noch nicht publiziert (2026: IFZ Rotkreuz).' },
  { name: 'Reprogramming Real Estate: Wie AI die Branche neu definiert (HSLU/IFZ)', art: 'tagung', von: '2027-06-07', bis: '2027-06-07', ort: 'Rotkreuz', haus: 'IFZ, Campus Zug-Rotkreuz', adresse: 'Suurstoffi 1, 6343 Rotkreuz', land: 'CH',
    url: 'https://www.hslu.ch/de-ch/wirtschaft/agenda/veranstaltungen/2027/06/07/reprogramming-real-estate-wie-ai-die-branche-neu-definiert/', fuer: 'Immobilienfachleute, Asset Manager, Institutionelle',
    quelle: 'https://www.hslu.ch/de-ch/wirtschaft/agenda/veranstaltungen/2027/06/07/reprogramming-real-estate-wie-ai-die-branche-neu-definiert/',
    bemerkung: '8.50–17 Uhr, CHF 590.' },
  { name: 'Swiss Real Estate Forum (SREF) 2027', art: 'forum', von: '2027-06-17', bis: '2027-06-18', ort: 'Bern', haus: 'BERNEXPO Messezentrum', adresse: 'Mingerstrasse 6, 3014 Bern', land: 'CH',
    url: 'https://www.svit.ch/de/sref', fuer: 'Immobilienwirtschaft, SVIT-Mitglieder, Investoren, Bewirtschafter', quelle: 'https://www.svit.ch/de/event/swiss-real-estate-forum-2027',
    bemerkung: 'Beginn 17. Juni 9.30 Uhr, Ende 18. Juni 13 Uhr; mit der SVIT-Delegiertenversammlung.' },
  { name: 'Swiss Real Estate Research Congress 2027', art: 'kongress', von: '2027-06-24', bis: '2027-06-24', ort: 'Zürich', haus: 'HWZ Hochschule für Wirtschaft Zürich', adresse: 'Lagerstrasse 5, Zürich', land: 'CH',
    url: 'https://www.hslu.ch/de-ch/wirtschaft/agenda/veranstaltungen/2027/06/24/swiss-real-estate-research-congress/', fuer: 'Forschung, Immobilienökonomen, Praxis',
    quelle: 'https://www.hslu.ch/de-ch/wirtschaft/agenda/veranstaltungen/2027/06/24/swiss-real-estate-research-congress/',
    bemerkung: '9–16.30 Uhr, CHF 250. Wissenschaftlich ausgerichtet.' },
  { name: 'Bauen & Modernisieren Zürich', art: 'messe', von: '2027-09-23', bis: '2027-09-26', ort: 'Zürich', haus: 'Messe Zürich', adresse: null, land: 'CH',
    url: 'https://www.bauen-modernisieren.ch/', fuer: 'Private, Bauherren, Eigentümer, Fachbesucher', quelle: 'https://www.fachmessen.ch/de/messetermine',
    bemerkung: '56. Ausgabe. Datum aus dem Messekalender von ZT Fachmessen.' },
  { name: 'EXPO REAL 2027', art: 'messe', von: '2027-10-04', bis: '2027-10-06', ort: 'München', haus: 'Messe München', adresse: 'Am Messesee 2, 81829 München', land: 'DE',
    url: 'https://exporeal.net/', fuer: 'Institutionelle, Fonds, Investoren, Finanzierer, Entwickler', quelle: 'https://exporeal.net/en/trade-fair/plan-your-visit/opening-hours/',
    bemerkung: '4.–5. Oktober 9–19 Uhr, 6. Oktober 9–16 Uhr. Schweizer Gemeinschaftsstand von Swiss Circle, dort auch das Swiss Real Estate Innovation Forum.' },
  { name: 'NZZ Real Estate Days 2027', art: 'kongress', von: '2027-10-28', bis: null, ort: null, haus: null, adresse: null, land: 'CH',
    url: 'https://realestate.nzz.ch/de/real-estate-days/konferenz', fuer: 'Entscheider der Immobilienwirtschaft, Institutionelle, Investoren',
    quelle: 'https://www.nzz.ch/themen-dossiers/red/lorenz-scheibli-pauschalrezepte-funktionieren-nicht-mehr-ld.10048608',
    bemerkung: 'Laut NZZ "vorgesehen"; Ort noch offen (2026 erstmals in Montreux, vorher Davos).' },
  { name: 'Swiss Public Real Estate Forum (SPREF) 2027', art: 'forum', von: '2027-11-25', bis: '2027-11-25', ort: null, haus: null, adresse: null, land: 'CH',
    url: 'https://spref.ch/', fuer: 'Öffentliche Eigentümer, Portfoliomanager', quelle: 'https://spref.ch/',
    bemerkung: '"Save the date"; Ort noch nicht bestätigt (bisher Aarau).' },
  { name: '110. Schweizer Immobiliengespräch', art: 'tagung', von: null, bis: null, ort: null, haus: null, adresse: null, land: 'CH',
    url: 'https://www.bfh.ch/de/aktuell/veranstaltungen/109-schweizer-immobiliengespraeche/', fuer: 'Immobilienwirtschaft, Politik, Wohnbau', quelle: null,
    bemerkung: 'Datum noch nicht publiziert; die 109. Ausgabe war am 5. Mai 2026 im Casino Bern.' },
  { name: 'Eigenheim Thun', art: 'messe', von: null, bis: null, ort: 'Thun', haus: 'Thun-Expo', adresse: null, land: 'CH',
    url: 'https://www.eigenheim-thun.ch/', fuer: 'Private, Bauherren', quelle: null,
    bemerkung: 'Die Seite zeigt noch 2026; Datum 2027 beim Veranstalter noch nicht publiziert.' },
  { name: 'Swissbau 2028', art: 'messe', von: '2028-01-18', bis: '2028-01-21', ort: 'Basel', haus: 'Messe Basel', adresse: null, land: 'CH',
    url: 'https://www.swissbau.ch/de', fuer: 'Bauherren, Planer, Immobilienwirtschaft', quelle: 'https://www.swissbau.ch/de',
    bemerkung: 'Alle zwei Jahre; 2027 keine Ausgabe.' },
];

const LAENDER: Record<string, string> = { CH: 'Schweiz', DE: 'Deutschland', FR: 'Frankreich' };
export const land = (k: string) => LAENDER[k] ?? k;

/** Ab heute (ein laufender Anlass zählt noch), nach Datum; ohne Datum separat. */
export function ordnen(liste: Anlass[], heute: string) {
  const datiert = liste.filter(a => a.von && (a.bis ?? a.von)! >= heute).sort((a, b) => a.von!.localeCompare(b.von!));
  const offen = liste.filter(a => !a.von);
  const monate = new Map<string, Anlass[]>();
  for (const a of datiert) { const m = a.von!.slice(0, 7); monate.set(m, [...(monate.get(m) ?? []), a]); }
  return { datiert, offen, monate };
}

/** "13.–14. Jan. 2027", "28. Okt. 2027", "30. Sept. – 2. Okt. 2027". */
export function zeitraum(a: Anlass): string {
  if (!a.von) return 'Datum offen';
  const v = new Date(a.von + 'T12:00:00'), b = a.bis ? new Date(a.bis + 'T12:00:00') : null;
  const mon = (d: Date) => d.toLocaleDateString('de-CH', { month: 'short' });
  if (!b || a.bis === a.von) return `${v.getDate()}. ${mon(v)} ${v.getFullYear()}`;
  if (v.getMonth() === b.getMonth()) return `${v.getDate()}.–${b.getDate()}. ${mon(b)} ${b.getFullYear()}`;
  return `${v.getDate()}. ${mon(v)} – ${b.getDate()}. ${mon(b)} ${b.getFullYear()}`;
}

/** Tage bis zum Beginn; negativ, wenn er schon läuft. */
export const inTagen = (a: Anlass, heute: string) =>
  a.von ? Math.round((Date.parse(a.von + 'T12:00:00') - Date.parse(heute + 'T12:00:00')) / 864e5) : null;

/** Für einen Termin im eigenen Kalender (iCal, ganztägig). */
export function ical(a: Anlass): string {
  const d = (s: string) => s.replace(/-/g, '');
  const ende = new Date((a.bis ?? a.von!) + 'T12:00:00'); ende.setDate(ende.getDate() + 1);
  const wo = [a.haus, a.adresse ?? a.ort].filter(Boolean).join(', ');
  const esc = (s: string) => s.replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bauraum//Immo-Kalender//DE', 'BEGIN:VEVENT',
    `UID:${d(a.von!)}-${a.name.replace(/[^a-z0-9]/gi, '').slice(0, 40)}@bauraum`,
    `DTSTART;VALUE=DATE:${d(a.von!)}`, `DTEND;VALUE=DATE:${ende.toISOString().slice(0, 10).replace(/-/g, '')}`,
    `SUMMARY:${esc(a.name)}`, wo ? `LOCATION:${esc(wo)}` : '', `URL:${a.url}`, `DESCRIPTION:${esc(a.bemerkung)}`,
    'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
}
