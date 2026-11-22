/**
 * Das Kaufangebot aus CALC YOU LATER: wer es bekommt, von welcher Firma,
 * nach welcher Vorlage, und was die Rückmeldungen über die Empfehlung
 * lehren (Julian, 19. November; Migration 20261119120000).
 *
 * Die Vorlagen sind die Briefe, die Julian geschickt hat, auf ihr Gerüst
 * zurückgeführt: was in jedem Angebot gleich ist, steht hier; was je
 * Angebot ändert (Datum, Anrede, Empfänger, Parzellen, Fläche, Zone, Preis,
 * Fristen), kommt aus der Kalkulation oder aus den Feldern, die David und
 * Julian ausfüllen.
 *
 *   bauland          Arbergstrasse 28 (stimo): Bauland im heutigen Zustand
 *   bestand          Glattalstrasse, Oberhasli (stimo): Liegenschaft im heutigen Zustand
 *   bedingt          Meilen Bergstrasse (Lebensraum): unter der Bedingung einer Baubewilligung
 *   bieterverfahren  Niederglatt (Lebensraum): unverbindlich an den Makler, mit Eckwerten
 *   unverbindlich    Volketswil (Studer): unverbindlich, mit Reservationszahlung
 *
 * Personen (Namen, Telefon, E-Mail) stehen nur in der Datenbank: an der
 * Kalkulation (Empfänger) und in angebot_person (wer unterschreibt). Hier
 * stehen nur, was die Firmen selbst auf jeden Brief drucken.
 */

export type FirmaId = 'stimo' | 'lebensraum' | 'studer';
/**
 * Welche Firmen David wählen kann. Lebensraum ist seit dem 20. November
 * keine Vorlage mehr (Julian: «Lebensraum wegnehmen als Vorlage»); die
 * Firma bleibt in FIRMEN, damit frühere Angebote sich weiter zeigen lassen.
 */
export const FIRMEN_WAHL: FirmaId[] = ['stimo', 'studer'];

export type VorlageId = 'bauland' | 'bestand' | 'bedingt' | 'bieterverfahren' | 'unverbindlich';
export type SchriftId = 'nunito' | 'dmsans' | 'carlito' | 'serif' | 'helvetica';
export type Urteil = 'zu_tief' | 'passt' | 'zu_hoch';

// ------------------------------------------------------------- Firmen

export interface Referenz { titel: string; adresse: string; text: string; jahre: string }

export interface Firma {
  id: FirmaId;
  name: string;
  strasse: string;
  plzOrt: string;
  /** Der Ort vor dem Datum: «Kloten, 10.12.2026». */
  ort: string;
  telefon: string;
  web: string;
  /** stimo: Deckblatt im Verlauf, Brief, Über uns, Unterschrift. Lebensraum: dunkles Deckblatt, Brief mit Bedingungen. Studer: Brief. */
  gestaltung: 'stimo' | 'lebensraum' | 'brief';
  schrift: SchriftId;
  /** Farben als RGB: Grund, Akzent, und für stimo das Ende des Verlaufs. */
  farbe: { grund: [number, number, number]; akzent: [number, number, number]; ende?: [number, number, number] };
  /** Wer kaufen kann, wenn nicht die Firma selbst. */
  kaeuferin: string;
  gesellschaften: string[];
  /** Ein Satz über die Firma, im Brief nach dem Dank. */
  vorstellung: string;
  ueberUns?: { satz: string; text: string[]; referenzenTitel: string; referenzen: Referenz[]; fuss: string };
  leitsatz?: { titel: string; text: string };
}

export const FIRMEN: Record<FirmaId, Firma> = {
  stimo: {
    id: 'stimo', name: 'stimo Unternehmungen', strasse: 'Lindengartenstrasse 6', plzOrt: '8302 Kloten', ort: 'Kloten',
    telefon: '+41 44 800 70 80', web: 'www.stimo.ch', gestaltung: 'stimo', schrift: 'nunito',
    farbe: { grund: [41, 47, 120], akzent: [24, 173, 144], ende: [24, 173, 144] },
    kaeuferin: 'stimo Unternehmungen',
    gesellschaften: ['stimo Generalunternehmung AG', 'stimo + partner AG', 'Stieger Immobilien AG'],
    vorstellung: 'stimo Unternehmungen ist ein unabhängiges Schweizer Unternehmen mit Sitz in Kloten und begleitet Immobilienprojekte vom Erwerb des Grundstücks bis zur Vermarktung.',
    ueberUns: {
      satz: 'Seit 2008 entwickeln, bauen und vermarkten wir Wohnraum mit Sorgfalt und Verlässlichkeit.',
      text: [
        'stimo Unternehmungen ist ein unabhängiges Schweizer Unternehmen mit Sitz in Kloten. Wir begleiten Immobilienprojekte ganzheitlich, vom Erwerb des Grundstücks über die Entwicklung und die Realisierung als Totalunternehmer durch die stimo GU AG bis zur Vermarktung durch die meinwohntraum AG. Alles aus einer Hand, mit kurzen Entscheidungswegen und einer eingespielten Abwicklung.',
        'Für Ihr Grundstück sehen wir {zukunft}. Dabei gehen wir mit der gleichen Diskretion und Umsicht vor, die Sie sich für den Verkauf wünschen.',
      ],
      referenzenTitel: 'Referenzen in der Region Winterthur',
      referenzen: [
        { titel: 'Sulz-Rickenbach', adresse: 'Steinler 2a, 8545 Sulz-Rickenbach', text: 'Neubau Mehrfamilienhaus mit 10 Mietwohnungen', jahre: 'Realisiert 2019 bis 2020' },
        { titel: 'SEVIDA, Seuzach', adresse: 'Birchstrasse 29, 8472 Seuzach', text: 'Neubau Mehrfamilienhaus mit 13 Eigentumswohnungen, MINERGIE', jahre: 'Realisiert 2023 bis 2025' },
        { titel: 'Dinhard', adresse: 'Welsikerstrasse 22–30, 8474 Dinhard', text: 'Neubau 3 Mehrfamilienhäuser mit Miet- und Eigentumswohnungen', jahre: 'Realisiert 2016 bis 2018' },
        { titel: 'Riedhof, Winterthur', adresse: 'Riedhofstrasse 104, 8408 Winterthur', text: 'Neubau 2 Mehrfamilienhäuser mit Mietwohnungen', jahre: 'Realisiert 2016 bis 2017' },
      ],
      fuss: 'Totalunternehmer jeweils stimo GU AG. Weitere Referenzen finden Sie auf www.stimo.ch.',
    },
    leitsatz: { titel: '„Wir suchen Bauland“', text: 'Für Rückfragen oder ein persönliches Gespräch stehen wir Ihnen gerne zur Verfügung und freuen uns auf einen vertrauensvollen Austausch.' },
  },
  lebensraum: {
    id: 'lebensraum', name: 'Lebensraum Schweiz AG', strasse: 'Ringstrasse 18a', plzOrt: '8600 Dübendorf', ort: 'Dübendorf',
    telefon: '+41 44 244 03 03', web: 'www.lebensraumag.ch', gestaltung: 'lebensraum', schrift: 'helvetica',
    farbe: { grund: [34, 42, 43], akzent: [159, 214, 180] },
    kaeuferin: 'die Lebensraum Schweiz AG oder die Stimo GU AG',
    gesellschaften: [],
    vorstellung: 'Die Lebensraum Schweiz AG ist spezialisiert auf die Entwicklung von Wohnbaugrundstücken, sowohl erschlossen als auch unerschlossen. Im Grossraum Zürich sind und waren wir bereits in mehreren Entwicklungsprojekten tätig, unter anderem in Oberglatt (zwei Projekte mit rund 14’000 m² und 10’600 m²) sowie in Niederhasli (ca. 8’900 m²). Diese Referenzen geben wir gerne bekannt, damit Sie sich direkt mit diesen Eigentümern austauschen können. Wir pflegen eine Partnerschaft mit der Stimo GU AG aus Kloten, welche an genannten Projekten ebenfalls Partner ist.',
  },
  studer: {
    id: 'studer', name: 'Studer Immobilien Schweiz AG', strasse: 'Sihleggstrasse 23', plzOrt: '8832 Wollerau', ort: 'Wollerau',
    telefon: '+41 44 240 16 62', web: 'www.studer-immo.ch', gestaltung: 'brief', schrift: 'carlito',
    farbe: { grund: [33, 37, 41], akzent: [33, 37, 41] },
    kaeuferin: 'die Studer Immobilien Schweiz AG',
    gesellschaften: [],
    vorstellung: '',
  },
};

export const SCHRIFTEN: Record<SchriftId, { titel: string; datei: string | null; wie: string }> = {
  nunito: { titel: 'Nunito Sans', datei: 'NunitoSans', wie: 'wie Avenir (Arbergstrasse)' },
  dmsans: { titel: 'DM Sans', datei: 'DMSans', wie: 'wie Glattalstrasse' },
  helvetica: { titel: 'Helvetica', datei: null, wie: 'wie Arial (Lebensraum)' },
  carlito: { titel: 'Carlito', datei: 'Carlito', wie: 'wie Calibri (Studer)' },
  serif: { titel: 'Source Serif', datei: 'SourceSerif4', wie: 'mit Serifen, klassisch' },
};

// ------------------------------------------------------------- Personen und Parzellen

export type Rolle = 'eigentuemer' | 'vertreter' | 'makler';
export interface Person {
  art: 'frau' | 'herr' | 'keine';
  vorname: string;
  name: string;
  /** Firma, Erbengemeinschaft oder Kanzlei. */
  firma: string;
  strasse: string;
  plzOrt: string;
  email: string;
  telefon: string;
  rolle: Rolle;
  empfaenger: boolean;
}
export const ROLLE_TEXT: Record<Rolle, string> = { eigentuemer: 'Eigentümer', vertreter: 'Vertretung', makler: 'Makler' };

export const leerePerson = (p: Partial<Person> = {}): Person => ({
  art: 'keine', vorname: '', name: '', firma: '', strasse: '', plzOrt: '', email: '', telefon: '', rolle: 'eigentuemer', empfaenger: false, ...p,
});

export interface Parzelle {
  nummer: string;
  flaeche: number | null;
  egrid?: string | null;
  gbBlatt?: string | null;
  zone?: string | null;
  adresse?: string | null;
}

/**
 * Personen aus dem Feld «Eigentümer» der Kalkulation (Grundbuch, eine Zeile
 * je Eigentümer oder durch Strichpunkt getrennt). Ein Vorschlag: Anrede und
 * Adresse ergänzt der Agent.
 */
export function personenAusEigentuemer(text: string | null | undefined): Person[] {
  if (!text?.trim()) return [];
  return text.split(/\s*(?:;|\n|\s\/\s)\s*/).map(t => t.trim()).filter(Boolean).slice(0, 10).map(t => {
    const firma = /\b(AG|GmbH|Genossenschaft|Stiftung|Erbengemeinschaft|Verein|SA|Sàrl|Gemeinde|Kanton|Stadt)\b/i.test(t);
    if (firma) return leerePerson({ firma: t });
    const teile = t.replace(/,.*$/, '').split(/\s+/);
    // Das Grundbuch schreibt «Muster Hans»: Name zuerst.
    return leerePerson({ name: teile[0] ?? t, vorname: teile.slice(1).join(' ') });
  });
}

// ------------------------------------------------------------- Felder je Angebot

export interface Unterschrift { name: string; titel: string; telefon?: string | null; email?: string | null }

export interface AngebotFelder {
  /** Datum des Briefs, JJJJ-MM-TT. */
  datum: string;
  /** Ortsteil für das Deckblatt («Winterthur-Seen»); leer: die Gemeinde. */
  ortsteil: string;
  /** Der Anlass, mit dem der Brief beginnt. */
  anlass: string;
  /** Was auf dem Grundstück entstehen soll. */
  nutzung: string;
  /** Besitzantritt spätestens, JJJJ-MM-TT; leer: nach Vereinbarung. */
  besitzantritt: string;
  bindungTage: number;
  /** Anzahlung oder Reservationszahlung, CHF; leer: keine. */
  anzahlung: number | null;
  /** Finanzierungsbestätigung einer Bank liegt bei. */
  finanzierungBeilage: boolean;
  /** Ersatzliegenschaft anbieten (Glattalstrasse). */
  ersatz: boolean;
  /** Wer oben rechts als Kontakt steht. */
  kontakt: Unterschrift | null;
  unterschriften: Unterschrift[];
  /** Eigener Wortlaut statt der Vorlage, Absätze durch Leerzeilen getrennt. */
  einleitung?: string;
  punkte?: string;
  schluss?: string;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function felderVorgabe(vorlage: VorlageId, heute = new Date()): AngebotFelder {
  const inDreiJahren = new Date(heute.getFullYear() + 3, 11, 31);
  return {
    datum: iso(heute), ortsteil: '',
    anlass: VORLAGEN[vorlage].anlass,
    nutzung: vorlage === 'bestand' ? 'ein attraktives Wohnbauprojekt' : 'eine hochwertige Wohnüberbauung im Stockwerkeigentum',
    besitzantritt: vorlage === 'bauland' ? iso(inDreiJahren) : '',
    bindungTage: vorlage === 'bauland' ? 90 : vorlage === 'bieterverfahren' ? 0 : 60,
    anzahlung: vorlage === 'bedingt' || vorlage === 'unverbindlich' ? 250_000 : vorlage === 'bieterverfahren' ? 1_000_000 : null,
    finanzierungBeilage: vorlage === 'bauland',
    ersatz: false,
    kontakt: null, unterschriften: [],
  };
}

// ------------------------------------------------------------- Zahlen und Wörter

/** 3’450’000, wie in den Vorlagen (Apostroph U+2019, ohne Rappen). */
export const zahl = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '’');
export const chfText = (n: number) => `CHF ${zahl(n)}`;
export const m2Text = (n: number) => `${zahl(n)} m²`;

export function datumLang(isoDatum: string): string {
  const d = new Date(`${isoDatum}T12:00:00`);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' }) : isoDatum;
}
export function datumKurz(isoDatum: string): string {
  const m = isoDatum.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : isoDatum;
}

const EINER = ['', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const ZEHNER = ['', '', 'zwanzig', 'dreissig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];
function unterTausend(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  const hundert = h ? `${EINER[h]}hundert` : '';
  if (r < 20) return hundert + EINER[r];
  const z = Math.floor(r / 10), e = r % 10;
  return hundert + (e ? `${EINER[e]}und` : '') + ZEHNER[z];
}
/** 10’200’000 → «zehn Millionen zweihunderttausend» (Volketswil). */
export function inWorten(betrag: number): string {
  const n = Math.round(betrag);
  if (!Number.isFinite(n) || n <= 0 || n >= 1e12) return '';
  const mrd = Math.floor(n / 1e9), mio = Math.floor((n % 1e9) / 1e6), tsd = Math.floor((n % 1e6) / 1e3), rest = n % 1e3;
  const teile: string[] = [];
  if (mrd) teile.push(mrd === 1 ? 'eine Milliarde' : `${unterTausend(mrd)} Milliarden`);
  if (mio) teile.push(mio === 1 ? 'eine Million' : `${unterTausend(mio)} Millionen`);
  const klein = (tsd ? `${unterTausend(tsd)}tausend` : '') + (rest ? unterTausend(rest) : '');
  if (klein) teile.push(klein === 'ein' ? 'eins' : klein);
  return teile.join(' ');
}

// ------------------------------------------------------------- Empfänger und Anrede

const anredeWort = (p: Person) => (p.art === 'frau' ? 'Frau' : p.art === 'herr' ? 'Herr' : '');
const voll = (p: Person) => [p.vorname.trim(), p.name.trim()].filter(Boolean).join(' ');

/** Wer das Angebot bekommt, in der Reihenfolge, in der der Agent sie erfasst hat. */
export const empfaenger = (personen: Person[]) => personen.filter(p => p.empfaenger);

/**
 * Die Anrede aus den Empfängern: «Sehr geehrte Frau Muster, sehr geehrter
 * Herr Muster». Ohne Namen mit Anrede «Sehr geehrte Damen und Herren».
 */
export function anrede(personen: Person[]): string {
  const an = empfaenger(personen).filter(p => p.art !== 'keine' && p.name.trim());
  if (!an.length) return 'Sehr geehrte Damen und Herren';
  return an.map((p, i) => {
    const s = `${p.art === 'frau' ? 'sehr geehrte' : 'sehr geehrter'} ${anredeWort(p)} ${p.name.trim()}`;
    return i === 0 ? s[0].toUpperCase() + s.slice(1) : s;
  }).join(', ');
}

/**
 * Die Adresse im Fenster, je Haushalt ein Block. Zwei Menschen mit gleichem
 * Namen und gleicher Adresse werden eine Zeile («Anna & Peter Muster»);
 * ein Makler bekommt den Brief über die Firma («Z. Hd. Herrn ...»), eine
 * Vertretung mit ihrer Kanzlei darunter, eine Erbengemeinschaft zuerst.
 */
export function adressbloecke(personen: Person[]): string[][] {
  const an = empfaenger(personen);
  if (!an.length) return [['An die Eigentümerschaft']];
  const bloecke: { schluessel: string; leute: Person[] }[] = [];
  for (const p of an) {
    const schluessel = `${p.strasse.trim().toLowerCase()}|${p.plzOrt.trim().toLowerCase()}|${p.firma.trim().toLowerCase()}`;
    const b = bloecke.find(x => x.schluessel === schluessel && (p.strasse.trim() || p.firma.trim()));
    if (b) b.leute.push(p); else bloecke.push({ schluessel, leute: [p] });
  }
  return bloecke.map(({ leute }) => {
    const p = leute[0];
    const zeilen: string[] = [];
    const namen = leute.filter(x => voll(x));
    const gleicherName = namen.length > 1 && namen.every(x => x.name.trim() === namen[0].name.trim());
    const personZeile = gleicherName
      ? `${namen.map(x => x.vorname.trim()).filter(Boolean).join(' & ')} ${namen[0].name.trim()}`
      : namen.map(voll).join(' und ');
    const herrn = (x: Person) => (x.art === 'herr' ? 'Herrn ' : x.art === 'frau' ? 'Frau ' : '');
    if (p.rolle === 'makler' && p.firma.trim()) {
      zeilen.push(p.firma.trim());
      if (namen.length) zeilen.push(`Z. Hd. ${namen.map(x => herrn(x) + voll(x)).join(' und ')}`);
    } else if (p.rolle === 'vertreter') {
      if (personZeile) zeilen.push(personZeile);
      if (p.firma.trim()) zeilen.push(p.firma.trim());
    } else {
      if (p.firma.trim()) zeilen.push(p.firma.trim());
      if (personZeile) zeilen.push(p.firma.trim() ? namen.map(x => `${anredeWort(x)} ${voll(x)}`.trim()).join(' und ') : personZeile);
    }
    if (p.strasse.trim()) zeilen.push(p.strasse.trim());
    if (p.plzOrt.trim()) zeilen.push(p.plzOrt.trim());
    return zeilen.length ? zeilen : ['An die Eigentümerschaft'];
  });
}

// ------------------------------------------------------------- Parzellen im Text

export function parzellenText(parzellen: Parzelle[], gemeinde: string | null): string {
  const mit = parzellen.filter(p => p.nummer.trim());
  const wo = gemeinde ? ` in der Gemeinde ${gemeinde}` : '';
  if (!mit.length) return `das Grundstück${wo}`;
  if (mit.length === 1) {
    const p = mit[0];
    return `das Grundstück Kat.-Nr. ${p.nummer.trim()}${p.flaeche ? ` mit einer Fläche von ${m2Text(p.flaeche)}` : ''}${p.gbBlatt ? ` (GB Blatt ${p.gbBlatt})` : ''} gemäss Grundbuchauszug${wo}`;
  }
  const teile = mit.map(p => `Kat.-Nr. ${p.nummer.trim()}${p.flaeche || p.gbBlatt ? ` (${[p.flaeche ? m2Text(p.flaeche) : '', p.gbBlatt ? `GB Blatt ${p.gbBlatt}` : ''].filter(Boolean).join(', ')})` : ''}`);
  const summe = mit.every(p => p.flaeche) ? mit.reduce((s, p) => s + (p.flaeche ?? 0), 0) : null;
  return `die Grundstücke ${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}${summe ? `, total ${m2Text(summe)}` : ''}${wo}`;
}

export const katNummern = (parzellen: Parzelle[]) => parzellen.map(p => p.nummer.trim()).filter(Boolean);

// ------------------------------------------------------------- Vorlagen

export interface Kontext {
  firma: Firma;
  felder: AngebotFelder;
  preis: number;
  adresse: string;
  plzOrt: string;
  gemeinde: string | null;
  kanton: string | null;
  zone: string | null;
  parzellen: Parzelle[];
  personen: Person[];
}

export interface Punkt { titel?: string; text: string }
export interface Brief {
  /** Über dem Betreff, gesperrt: «KAUFANGEBOT». */
  art: string;
  /** Der Betreff: «Bergstrasse, 8706 Meilen – Kat.-Nr. 9259 und 9261». */
  betreff: string;
  einleitung: string[];
  /** Zwischen Einleitung und Betrag, z. B. «Gerne unterbreiten wir Ihnen ...». */
  betragZeile: string;
  /** Unter dem Betrag, klein. */
  betragUnter: string;
  punkteTitel: string;
  /** Nummeriert (01, 02, ...) mit Titel wie bei Lebensraum, sonst als Aufzählung. */
  nummeriert: boolean;
  punkte: Punkt[];
  zahlung: { titel: string; betrag: number; text: string }[] | null;
  schluss: string[];
}

interface Vorlage {
  titel: string;
  wann: string;
  art: string;
  anlass: string;
  brief: (k: Kontext) => Omit<Brief, 'art'>;
}

const absaetze = (t: string) => t.split(/\n\s*\n/).map(s => s.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
const gemeindeName = (k: Kontext) => k.gemeinde ?? k.plzOrt.replace(/^\d{4}\s*/, '');
const ortsteil = (k: Kontext) => k.felder.ortsteil.trim() || gemeindeName(k);
const gesellschaften = (f: Firma) => f.gesellschaften.length
  ? `Der Erwerb kann direkt oder über eine der folgenden Gesellschaften innerhalb der Unternehmensgruppe der Käuferin erfolgen: ${f.gesellschaften.join(', ')}.`
  : 'Der Erwerb kann direkt oder über eine Gesellschaft innerhalb der Unternehmensgruppe der Käuferin erfolgen.';
const bindung = (k: Kontext) => (k.felder.bindungTage > 0 ? [`Wir halten uns während ${k.felder.bindungTage} Tagen ab Eingabe an dieses Angebot gebunden.`] : []);
const besitz = (k: Kontext) => (k.felder.besitzantritt
  ? `Eigentumsübertragung und Besitzantritt erfolgen nach Vereinbarung, spätestens bis zum ${datumKurz(k.felder.besitzantritt)}.`
  : 'Eigentumsübertragung und Besitzantritt erfolgen nach Vereinbarung.');
const betreffMitKat = (k: Kontext) => {
  const kat = katNummern(k.parzellen);
  return `${k.adresse}, ${k.plzOrt}${kat.length ? ` – Kat.-Nr. ${kat.length > 1 ? `${kat.slice(0, -1).join(', ')} und ${kat[kat.length - 1]}` : kat[0]}` : ''}`;
};
const zahlungStufen = (k: Kontext, rest: string): Brief['zahlung'] => (k.felder.anzahlung && k.felder.anzahlung < k.preis
  ? [
      { titel: 'Anzahlung', betrag: k.felder.anzahlung, text: 'Sofort bei Beurkundung des Kaufvertrags, Anrechnung an den Kaufpreis' },
      { titel: 'Restkaufpreis', betrag: k.preis - k.felder.anzahlung, text: rest },
      { titel: 'Total Kaufpreis', betrag: k.preis, text: '' },
    ]
  : null);

export const VORLAGEN: Record<VorlageId, Vorlage> = {
  bauland: {
    titel: 'Bauland', wann: 'Bauland im heutigen Zustand, vor Machbarkeitsstudie (Arbergstrasse)', art: 'Kaufangebot',
    anlass: 'Herzlichen Dank für Ihre vertrauliche Einladung zur Angebotsabgabe',
    brief: k => ({
      betreff: 'Kaufangebot',
      einleitung: [
        `${k.felder.anlass.trim().replace(/\.$/, '')} für Ihre Liegenschaft an der ${k.adresse} in ${ortsteil(k)}. Wir haben Ihre Unterlagen sorgfältig geprüft und sehen in Ihrem Grundstück ein ausgezeichnetes Potenzial für ${k.felder.nutzung}. Gerne unterbreiten wir Ihnen hiermit unser Kaufangebot über`,
      ],
      betragZeile: '', betragUnter: '',
      punkteTitel: 'Gerne möchten wir zu unserem Angebot Folgendes festhalten:', nummeriert: false,
      punkte: [
        `Der Kaufpreis bezieht sich auf ${parzellenText(k.parzellen, null)}${k.zone ? `, ${k.zone}` : ''}, ${k.adresse}, ${k.plzOrt}.`,
        'Der Kauf erfolgt als Bauland im heutigen Zustand. Die Gewährleistung wird im gesetzlich zulässigen Umfang wegbedungen.',
        `Das Angebot gilt vor Erstellung einer Machbarkeitsstudie und vor Abklärungen mit der Gemeinde ${gemeindeName(k)}. Bei einem Kauf mit rechtskräftiger Baubewilligung sind wir bereit, einen höheren Kaufpreis zu bezahlen. Gerne erläutern wir Ihnen diese Variante in einem persönlichen Gespräch.`,
        'Notariats- und Grundbuchgebühren werden hälftig getragen, die Grundstückgewinnsteuer trägt die Verkäuferschaft. Vermittler- oder Maklerprovisionen fallen keine an.',
        besitz(k),
        k.felder.finanzierungBeilage
          ? 'Die Finanzierung des Erwerbs ist sichergestellt. Die Finanzierungsbestätigung einer Schweizer Bank liegt diesem Angebot bei.'
          : 'Die Finanzierung des Erwerbs ist sichergestellt. Ein Finanzierungsnachweis wird bei Bedarf vorgelegt.',
        ...bindung(k),
        'Ihre Unterlagen und den beabsichtigten Verkauf behandeln wir streng vertraulich.',
        gesellschaften(k.firma),
      ].map(text => ({ text })),
      zahlung: null,
      schluss: [],
    }),
  },
  bestand: {
    titel: 'Bestandsliegenschaft', wann: 'Liegenschaft mit Bauten im heutigen Zustand (Glattalstrasse, Oberhasli)', art: 'Kaufangebot',
    anlass: 'Besten Dank für Ihre Zeit und die bisherigen Gespräche zu Ihrem Grundstück',
    brief: k => ({
      betreff: 'Kaufangebot',
      einleitung: [
        `${k.felder.anlass.trim().replace(/\.$/, '')} an der ${k.adresse} in ${ortsteil(k)}.`,
        `Wir haben uns eingehend mit ${k.parzellen.length > 1 ? 'den Parzellen' : 'der Parzelle'} und den damit verbundenen Entwicklungsmöglichkeiten auseinandergesetzt. Aufgrund der Lage, der Grundstücksgrösse sowie des vorhandenen Entwicklungspotenzials sind wir überzeugt, dass sich hier eine interessante Möglichkeit für ${k.felder.nutzung} bietet.`,
        `Gerne unterbreiten wir Ihnen deshalb nachfolgend unser Kaufangebot für ${k.parzellen.length > 1 ? 'die entsprechenden Grundstücke' : 'das entsprechende Grundstück'}. Unser Ziel ist es, auf dieser Grundlage eine für alle Parteien überzeugende Lösung zu finden und das weitere Vorgehen gemeinsam und partnerschaftlich zu gestalten.`,
      ],
      betragZeile: '', betragUnter: '',
      punkteTitel: '', nummeriert: false,
      punkte: [
        `Der angebotene Kaufpreis bezieht sich auf die Liegenschaft ${k.adresse}, ${parzellenText(k.parzellen, gemeindeName(k)).replace(/^das |^die /, '')}.`,
        'Die Übernahme erfolgt im heutigen Zustand. Massgeblich ist der Zustand im Zeitpunkt der Beurkundung bzw. des Eigentumsübergangs.',
        'Eine Übernahme bestehender Finanzierungen oder Hypotheken kann im Rahmen der weiteren Prüfung besprochen werden.',
        'Notariats-, Grundbuch- und weitere Handänderungskosten werden von den Parteien je hälftig getragen, sofern nichts anderes vereinbart wird.',
        'Eine allfällige Grundstückgewinnsteuer wird von der Verkäuferschaft getragen.',
        'Die Finanzierung des Erwerbs ist sichergestellt. Ein Zahlungsversprechen bzw. Finanzierungsnachweis wird bei Bedarf im Rahmen des Vollzugs vorgelegt.',
        'Allfällige Dienstbarkeiten, Anmerkungen und Grundlasten sind vor Vertragsabschluss vollständig offenzulegen und gemeinsam zu bereinigen.',
        'Nutzen und Gefahr gehen nach gemeinsamer Abstimmung über, spätestens jedoch per Eigentumsübertragung.',
        ...bindung(k),
        gesellschaften(k.firma),
      ].map(text => ({ text })),
      zahlung: null,
      schluss: k.felder.ersatz
        ? ['Wie von Ihnen gewünscht, bieten wir Ihnen zudem gerne für den Erlös aus diesem Verkauf eine passende Liegenschaft zum Kauf an. Das entsprechende Angebot unterbreiten wir Ihnen separat.']
        : [],
    }),
  },
  bedingt: {
    titel: 'Mit Baubewilligung', wann: 'Kaufvertrag unter der Bedingung einer Baubewilligung, Anzahlung und Rest (Meilen)', art: 'Kaufangebot',
    anlass: 'Besten Dank für die Zustellung der Unterlagen und für die Möglichkeit, uns an diesem Verkaufsprozess zu beteiligen.',
    brief: k => ({
      betreff: betreffMitKat(k),
      einleitung: [
        k.felder.anlass.trim(),
        ...(k.firma.vorstellung ? [k.firma.vorstellung] : []),
        `Auf Basis der uns zur Verfügung gestellten Informationen sowie unserer Analyse der planungsrechtlichen und wirtschaftlichen Rahmenbedingungen unterbreiten wir Ihnen nachfolgend unser Kaufangebot.`,
      ],
      betragZeile: 'Mit diesem Kaufangebot bekräftigen wir unsere feste Absicht. Nachdem wir das Potenzial Ihrer Grundstücke sorgfältig geprüft haben, unterbreiten wir Ihnen ein konkretes Kaufangebot unter den folgenden Bedingungen:',
      betragUnter: '',
      punkteTitel: 'Bedingungen', nummeriert: true,
      punkte: [
        { titel: 'Kaufobjekt', text: `Der Kaufpreis versteht sich für ${parzellenText(k.parzellen, null)}.` },
        { titel: 'Käuferin', text: `Als Käuferin tritt ${k.firma.kaeuferin} auf. Die Bezeichnung der Käuferin erfolgt spätestens bei der Beurkundung des Kaufvertrags.` },
        { titel: 'Zustand', text: `${k.parzellen.length > 1 ? 'Die Grundstücke werden' : 'Das Grundstück wird'} im aktuellen Zustand übernommen.` },
        { titel: 'Hypotheken', text: 'Es werden keine Hypotheken übernommen.' },
        { titel: 'Kosten', text: 'Die Handänderungskosten (Notar- und Grundbuchkosten) werden je zur Hälfte getragen.' },
        { titel: 'Steuern', text: 'Eine allfällige Grundstückgewinnsteuer geht zu Lasten der Verkäuferin.' },
        { titel: 'Finanzierung', text: 'Die Finanzierung ist gesichert, beim Eigentumsübertrag wird ein Zahlungsversprechen vorgelegt.' },
        { titel: 'Bedingung', text: `Der Kaufvertrag wird unter der aufschiebenden Bedingung einer rechtskräftigen Baubewilligung für ${k.felder.nutzung} abgeschlossen. Diese umfasst auch die rechtlich gesicherte Erschliessung.` },
        { titel: 'Mitwirkung', text: 'Die Verkäuferin unterzeichnet das Baugesuch als Grundeigentümerin und wirkt bei den zur Sicherung der Erschliessung nötigen Verfahren und Dienstbarkeiten mit.' },
        { titel: 'Dienstbarkeiten', text: 'Vollständige Klärung der Dienstbarkeiten und Grundlasten (Grundbuch) vor Vertragsabschluss.' },
        { titel: 'Nutzen & Gefahr', text: 'Übergang von Nutzen und Gefahren nach Absprache.' },
        ...bindung(k).map(text => ({ titel: 'Bindung', text })),
      ],
      zahlung: zahlungStufen(k, 'Bei Eigentumsübertrag innert 30 Tagen nach Rechtskraft der Baubewilligung'),
      schluss: ['Wir sehen dieses Angebot als solide Grundlage für die weiteren Schritte und sind sehr daran interessiert, im nächsten Schritt eine vertiefte Prüfung vorzunehmen. In diesem Zusammenhang würden wir die Grundstücke gerne vor Ort besichtigen.'],
    }),
  },
  bieterverfahren: {
    titel: 'Bieterverfahren', wann: 'Unverbindlich an einen Makler, mit Eckwerten und Vorbehalten (Niederglatt)', art: 'Unverbindliches Kaufangebot',
    anlass: 'Besten Dank für die Zustellung der Verkaufsunterlagen. Hiermit erklären wir formell unser Interesse am Erwerb und unterbreiten Ihnen fristgerecht unser unverbindliches Angebot.',
    brief: k => ({
      betreff: betreffMitKat(k),
      einleitung: [k.felder.anlass.trim(), ...(k.firma.vorstellung ? [k.firma.vorstellung] : []), 'Gestützt auf die zur Verfügung gestellten Unterlagen unterbreiten wir Ihnen folgendes Angebot:'],
      betragZeile: '',
      betragUnter: [katNummern(k.parzellen).length ? `Kat.-Nr. ${katNummern(k.parzellen).join(', ')}` : '', k.parzellen.every(p => p.flaeche) && k.parzellen.length ? m2Text(k.parzellen.reduce((s, p) => s + (p.flaeche ?? 0), 0)) : '', k.felder.anzahlung ? `${chfText(k.felder.anzahlung)} bei Beurkundung` : '', 'Asset Deal'].filter(Boolean).join(' · '),
      punkteTitel: 'Eckwerte', nummeriert: true,
      punkte: [
        { titel: 'Kaufobjekt', text: `${parzellenText(k.parzellen, null).replace(/^das |^die /, '').replace(/^g/, 'G')}, ${k.adresse}, ${k.plzOrt}, inklusive der bestehenden Bauten.` },
        { titel: 'Struktur', text: 'Asset Deal. Das Angebot wird für eigene Rechnung und nicht für Rechnung Dritter abgegeben.' },
        { titel: 'Erwerberin', text: `${k.firma.kaeuferin.replace(/^die /, 'Die ')}. Die Bezeichnung der Erwerberin erfolgt spätestens bei der Beurkundung des Kaufvertrags. Die Erwerberin ist schweizerisch beherrscht.` },
        { titel: 'Kaufpreis', text: chfText(k.preis) },
        { titel: 'Transaktionskosten', text: `Notariats- und Grundbuchgebühren werden gemäss Usanz${k.kanton ? ` im Kanton ${k.kanton}` : ''} hälftig geteilt. Eine allfällige Grundstückgewinnsteuer geht zu Lasten der Verkäuferin.` },
        { titel: 'Finanzierung', text: 'Die Finanzierung erfolgt aus Eigenmitteln und Bankfinanzierung. Der Finanzierungsnachweis wird mit dem verbindlichen Angebot eingereicht.' },
        { titel: 'Baubewilligung', text: `Der Kaufvertrag wird unter der aufschiebenden Bedingung einer rechtskräftigen Baubewilligung für ${k.felder.nutzung} abgeschlossen.` },
        { titel: 'Mitwirkung', text: 'Die Verkäuferin unterzeichnet Gestaltungsplan und Baugesuch als Grundeigentümerin und wirkt bei den erforderlichen Verfahren mit. Die Planungskosten trägt die Käuferin.' },
        { titel: 'Altlasten', text: 'Sämtliche Kosten für Untersuchung, Überwachung und Sanierung allfälliger Altlasten sowie für die Entsorgung der Gebäudeschadstoffe gehen zu Lasten der Verkäuferin.' },
        { titel: 'Mehrwertabgabe', text: 'Eine allfällige Mehrwertabgabe aus einer Um- oder Aufzonung geht zu Lasten der Verkäuferin.' },
        { titel: 'Grundbuch', text: 'Übertragung frei von Grundpfandrechten. Klärung der Dienstbarkeiten und Anmerkungen vor Vertragsabschluss.' },
        { titel: 'Due Diligence', text: 'Bestätigende Due Diligence ohne wesentliche neue Erkenntnisse.' },
      ],
      zahlung: zahlungStufen(k, 'Bei Eigentumsübertrag innert 30 Tagen nach Rechtskraft der Baubewilligung'),
      schluss: [
        ...(k.felder.anzahlung && k.felder.anzahlung < k.preis ? ['Die Rückerstattung der Anzahlung für den Fall, dass keine rechtskräftige Baubewilligung erteilt wird, regeln wir im Kaufvertrag.'] : []),
        'Das Angebot ist intern genehmigt. Es ist unverbindlich und steht unter dem Vorbehalt der Due Diligence sowie eines beidseitig unterzeichneten, öffentlich beurkundeten Kaufvertrags. Wir freuen uns auf die Einladung zur nächsten Phase.',
      ],
    }),
  },
  unverbindlich: {
    titel: 'Unverbindlich mit Reservation', wann: 'Unverbindlich, Reservationszahlung, Preis in Worten (Volketswil)', art: 'Unverbindliches Kaufangebot',
    anlass: 'Wir bedanken uns herzlich für Ihren Besuch vor Ort sowie das freundliche Gespräch',
    brief: k => ({
      betreff: 'Unverbindliches Kaufangebot',
      einleitung: [
        `${k.felder.anlass.trim().replace(/\.$/, '')} über ${parzellenText(k.parzellen, null).replace(/ gemäss Grundbuchauszug/, '')} an der ${k.adresse} in ${k.plzOrt}. Wir sind sehr an ${k.parzellen.length > 1 ? 'den Grundstücken' : 'der Parzelle'} interessiert und würden uns freuen, mit Ihnen ins Geschäft zu kommen, mit einer reibungslosen Abwicklung für alle Beteiligten. Gerne unterbreiten wir Ihnen folgendes Kaufangebot.`,
      ],
      betragZeile: '',
      betragUnter: `(${inWorten(k.preis)} Franken)`,
      punkteTitel: 'Bedingungen des Angebots', nummeriert: false,
      punkte: [
        ...(k.felder.anzahlung ? [`Anzahlung bzw. Reservationszahlung von ${chfText(k.felder.anzahlung)} bei Unterzeichnung der Reservations- bzw. Absichtserklärung. Die Anzahlung wird bei der öffentlichen Beurkundung vollumfänglich an den Kaufpreis angerechnet.`] : []),
        'Öffentliche Beurkundung so rasch als möglich, Eigentumsübertragung nach Absprache.',
        'Der Erwerb erfolgt im aktuellen Zustand, vorbehältlich der Prüfung der Mietverhältnisse und der Dienstbarkeiten.',
        `Der vereinbarte Kaufpreis umfasst ${parzellenText(k.parzellen, null).replace(/ gemäss Grundbuchauszug/, '')} (${k.adresse}, ${k.plzOrt}).`,
        'Die mit dem Eigentumsübergang verbundenen Kosten, insbesondere Notariats- und Grundbuchgebühren, werden von Käufer und Verkäufer zu gleichen Teilen getragen. Eine allfällige Grundstückgewinnsteuer geht zulasten des Verkäufers.',
        'Vor Abschluss des Kaufvertrags wird eine umfassende Prüfung sämtlicher im Grundbuch eingetragener Dienstbarkeiten vorgenommen. Der Zeitpunkt des Übergangs von Nutzen und Gefahr wird einvernehmlich zwischen den Parteien festgelegt.',
        ...bindung(k),
        'Dieses Angebot ist unverbindlich und begründet keinen Anspruch auf Abschluss eines Kaufvertrags. Die verbindlichen Regelungen werden im öffentlich beurkundeten Kaufvertrag festgehalten.',
      ].map(text => ({ text })),
      zahlung: null,
      schluss: ['Wir freuen uns sehr auf eine positive Rückmeldung und stehen für ein weiteres persönliches Gespräch jederzeit gerne zur Verfügung.'],
    }),
  },
};

/** Welche Vorlage zur Kalkulation passt: mit Bauten Bestand, ohne Bauland. */
export function vorlageVorschlag(o: { gebaeude: number; massgebend: 'neubau' | 'miete' | 'bestand' | null; empfaenger: Person[] }): VorlageId {
  if (o.empfaenger.some(p => p.rolle === 'makler')) return 'bieterverfahren';
  if (o.massgebend === 'bestand') return 'bestand';
  return o.gebaeude > 0 ? 'bestand' : 'bauland';
}

/** Der fertige Wortlaut: die Vorlage, wo nichts Eigenes steht, sonst das Eigene. */
export function brief(vorlage: VorlageId, k: Kontext): Brief {
  const v = VORLAGEN[vorlage];
  const b = v.brief(k);
  const eigen = (t: string | undefined) => (t?.trim() ? absaetze(t) : null);
  const punkteEigen = eigen(k.felder.punkte);
  return {
    ...b,
    art: v.art,
    einleitung: eigen(k.felder.einleitung) ?? b.einleitung,
    punkte: punkteEigen
      ? punkteEigen.map(t => {
          // «Titel: Text» bleibt bei nummerierten Bedingungen ein Titel.
          const m = b.nummeriert ? t.match(/^([^:]{2,30}):\s+(.+)$/) : null;
          return m ? { titel: m[1], text: m[2] } : { text: t };
        })
      : b.punkte,
    schluss: eigen(k.felder.schluss) ?? b.schluss,
  };
}

/** Die Punkte als bearbeitbarer Text, ein Absatz je Punkt (für das Feld «Bedingungen»). */
export const punkteAlsText = (b: Pick<Brief, 'punkte' | 'nummeriert'>) =>
  b.punkte.map(p => (b.nummeriert && p.titel ? `${p.titel}: ${p.text}` : p.text)).join('\n\n');

/** Was dem Angebot noch fehlt, bevor David es weitergibt. Leer heisst vollständig. */
export function luecken(k: Pick<Kontext, 'personen' | 'parzellen'> & { felder: AngebotFelder; firma: FirmaId | null; vorlage: VorlageId | null }): string[] {
  const l: string[] = [];
  const an = empfaenger(k.personen);
  if (!an.length) l.push('Kein Empfänger gewählt.');
  if (an.length && !an.some(p => p.strasse.trim() && p.plzOrt.trim())) l.push('Dem Empfänger fehlt die Adresse.');
  if (!katNummern(k.parzellen).length) l.push('Keine Kataster-Nummer.');
  if (!k.firma) l.push('Keine Firma gewählt.');
  if (!k.vorlage) l.push('Keine Vorlage gewählt.');
  if (!k.felder.unterschriften.length) l.push('Niemand unterschreibt.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k.felder.datum)) l.push('Das Datum fehlt.');
  return l;
}

// ------------------------------------------------------------- Lernen aus den Rückmeldungen

export interface Rueckmeldung {
  empfehlung: number;
  /** Was am Ende geboten wird: nach Davids Prüfung, Tims Visum und Julians Kontrolle. */
  preis: number;
  urteil: Urteil | null;
  grund: string | null;
  kanton: string | null;
  vorlage: VorlageId | null;
  am: string;
  /** Wer geurteilt hat und zu welcher Adresse (22. November, Julian: «ist das vom System oder von Tim?»). */
  wer?: string | null;
  adresse?: string | null;
}

export interface Gelernt {
  n: number;
  /** Median von Preis ÷ Empfehlung. */
  faktor: number;
  /** Viertel darunter und darüber. */
  von: number;
  bis: number;
  /** Ob nur Rückmeldungen aus demselben Kanton zählen. */
  kanton: string | null;
  zuTief: number; passt: number; zuHoch: number;
  gruende: { urteil: Urteil; grund: string; am: string; wer?: string | null; adresse?: string | null }[];
}

const quantil = (sortiert: number[], q: number) => {
  const i = (sortiert.length - 1) * q, u = Math.floor(i), o = Math.ceil(i);
  return sortiert[u] + (sortiert[o] - sortiert[u]) * (i - u);
};

/** Ab so vielen Rückmeldungen steht ein Vorschlag neben der Empfehlung; darunter nur die Gründe. */
export const LERNEN_AB = 3;

/**
 * Was die Rückmeldungen lehren: um wie viel David, Tim und Julian die
 * Empfehlung am Ende verändern. Gibt es im selben Kanton genug, zählen
 * nur diese. Julians Formel ändert sich dadurch nicht (CLAUDE.md: seine
 * Vorgaben nicht eigenmächtig ändern); der Vorschlag steht daneben.
 */
export function lernen(alle: Rueckmeldung[], kanton: string | null): Gelernt | null {
  const gut = alle.filter(r => r.empfehlung > 0 && r.preis > 0 && r.preis / r.empfehlung > 0.2 && r.preis / r.empfehlung < 5);
  const hier = kanton ? gut.filter(r => r.kanton === kanton) : [];
  const basis = hier.length >= LERNEN_AB ? hier : gut;
  if (!basis.length) return null;
  const q = basis.map(r => r.preis / r.empfehlung).sort((a, b) => a - b);
  return {
    n: basis.length, faktor: quantil(q, 0.5), von: quantil(q, 0.25), bis: quantil(q, 0.75),
    kanton: hier.length >= LERNEN_AB ? kanton : null,
    zuTief: basis.filter(r => r.urteil === 'zu_tief').length,
    passt: basis.filter(r => r.urteil === 'passt').length,
    zuHoch: basis.filter(r => r.urteil === 'zu_hoch').length,
    gruende: basis.filter(r => r.urteil && r.grund).sort((a, b) => b.am.localeCompare(a.am)).slice(0, 4)
      .map(r => ({ urteil: r.urteil!, grund: r.grund!, am: r.am, wer: r.wer ?? null, adresse: r.adresse ?? null })),
  };
}

/** Der Vorschlag aus den Rückmeldungen, auf 10’000 gerundet; null unter LERNEN_AB. */
export function vorschlag(empfehlung: number | null, g: Gelernt | null): number | null {
  if (!empfehlung || !g || g.n < LERNEN_AB) return null;
  return Math.round((empfehlung * g.faktor) / 10_000) * 10_000;
}

export const URTEIL_TEXT: Record<Urteil, string> = { zu_tief: 'Empfehlung zu tief', passt: 'Empfehlung passt', zu_hoch: 'Empfehlung zu hoch' };

// ------------------------------------------------------------- Nachricht an die nächste Hand

export type AblaufRolle = 'preis' | 'visum' | 'kontrolle' | 'versand' | 'unterschrift';
export interface AblaufPerson { id: string; name: string; titel: string | null; email: string | null; telefon: string | null; firma: FirmaId | null; rollen: AblaufRolle[]; user_id: string | null; reihe: number }

/** Wer nach diesem Stand am Zug ist. */
export const AM_ZUG: Partial<Record<string, AblaufRolle>> = { pruefung: 'preis', visum: 'visum', kontrolle: 'kontrolle', bestaetigung: 'visum', angebot: 'versand' };
export const AUFGABE: Partial<Record<string, string>> = {
  pruefung: 'den Kaufpreis prüfen und Firma, Vorlage und Schrift wählen',
  visum: 'den Kaufpreis visieren',
  kontrolle: 'das Angebot kontrollieren',
  bestaetigung: 'das Angebot noch einmal bestätigen',
  angebot: 'das Angebot verschicken',
};

/**
 * Eine Nachricht an den, der jetzt am Zug ist: als E-Mail und für
 * WhatsApp. Aurora verschickt selbst keine Mails (kein Versanddienst);
 * der Knopf öffnet das Mailprogramm mit Empfänger, Betreff und Link.
 */
export function nachricht(o: { zustand: string; adresse: string; ort: string; preis: number | null; link: string; von: string; an: AblaufPerson[] }): { mail: string; whatsapp: string | null; text: string } | null {
  const aufgabe = AUFGABE[o.zustand];
  if (!aufgabe) return null;
  const namen = o.an.map(p => p.name.split(/\s+/)[0]).join(' und ');
  const text = [
    `Hallo${namen ? ` ${namen}` : ''}`,
    `Bitte ${aufgabe}: ${o.adresse}${o.ort ? `, ${o.ort}` : ''}${o.preis ? ` (${chfText(o.preis)})` : ''}.`,
    o.link,
    `Die Frist von 24 Stunden läuft.${o.von ? `\n\n${o.von}` : ''}`,
  ].join('\n\n');
  const betreff = `CALC: ${aufgabe[0].toUpperCase()}${aufgabe.slice(1)} – ${o.adresse}`;
  const mails = o.an.map(p => p.email).filter(Boolean).join(',');
  const nummer = o.an.map(p => p.telefon?.replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^0(?=\d{9}$)/, '41')).find(Boolean);
  return {
    text,
    mail: `mailto:${encodeURIComponent(mails).replace(/%2C/g, ',')}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(text)}`,
    whatsapp: nummer ? `https://wa.me/${nummer}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`,
  };
}

/**
 * Wie breit der Ausschnitt des Deckblatts ist, in Metern: viermal die Seite
 * des Grundstücks, mindestens 80 m, höchstens 160 m wie bisher. Verglichen
 * an der Schöneggstrasse 18: bei 160 m ist das Haus eines unter vielen, bei
 * 45 m liefert der Bund ein dunkles, unscharfes Bild; bei 80 m füllt das
 * Haus die Mitte und ist scharf.
 */
export function deckblattBreite(k: { parzellen?: Parzelle[] | null; eingaben: { eingabe: { grundlage: { flaeche: number } } } }): number {
  const flaeche = (k.parzellen ?? []).reduce((s, p) => s + (p.flaeche ?? 0), 0) || k.eingaben.eingabe.grundlage.flaeche || 0;
  return Math.round(Math.min(160, Math.max(80, Math.sqrt(flaeche) * 4)));
}

