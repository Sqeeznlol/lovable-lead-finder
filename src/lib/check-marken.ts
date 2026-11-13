/**
 * Die Marken der Eigentümer-Checks: ein System, viele Domains.
 *
 * Julian, 6. November: "Wir brauchen ganz viele Landingpages wie den
 * Parzellenchecker ... dass die ganzen Leads bei uns automatisch
 * generiert werden." Statt vieler Webseiten gibt es eine Seite, die am
 * Hostnamen erkennt, welche Marke sie ist. Eine neue Domain ist damit
 * keine neue Software: Domain kaufen, bei Vercel dem Projekt hinzufügen,
 * hier in `domains` eintragen -- fertig. Jeder Lead trägt Marke und
 * Domain, damit sich zeigt, welche Seite und welche Anzeige Eigentümer
 * bringt.
 *
 * Julian, 7. November: "20 verschiedene Designs und andere Namen, nur
 * Landingpages". Jede Marke trägt darum eine eigene Gestaltung: Aufbau
 * der Bühne, Schrift, Farben, Hintergrund, Wortzeichen. Der Ablauf
 * dahinter bleibt derselbe -- so misst der Vergleich die Gestaltung und
 * den Namen, nicht verschiedene Formulare.
 *
 * Alle Domains hier waren am 7. November laut Registry (rdap.nic.ch:
 * 404) frei; gekauft sind seit dem 13. November 23 (siehe GEKAUFT). Vergeben waren grundstueckwert.ch,
 * meineparzelle.ch und mfhcheck.ch -- darum stehen sie nicht hier.
 */
// Wer die Seiten betreibt -- gehört ins Impressum, in die Einwilligung und
// unter jeden Ratgeber. Rechtlicher Name, Adresse und UID trägt Julian nach
// (docs/werbeplan-eigentuemer.md, Abschnitt 8).
export const BETREIBER = 'Bauraum';

export type Schwerpunkt = 'parzelle' | 'haus' | 'bauen' | 'reserve' | 'wert' | 'erbe' | 'alter' | 'mfh';

/**
 * Wie die Bühne (der erste Bildschirm) aufgebaut ist:
 *   karte    Text links, Beispielauswertung rechts
 *   mitte    alles mittig, Beispiel als breites Band darunter
 *   luftbild Luftbild der Region als Hintergrund, Text hell darauf
 *   geteilt  links Text, rechts ein Luftbild mit dem Beispiel darauf
 *   zeitung  wie ein Ratgeber: Serifen, Linien, keine Schatten
 */
export type Buehne = 'karte' | 'mitte' | 'luftbild' | 'geteilt' | 'zeitung';
export type Muster = 'kataster' | 'raster' | 'keins';
export type Zeichen = 'raute' | 'punkt' | 'linie' | 'keins';

export interface Gestaltung {
  buehne: Buehne;
  /** Google-Schrift für die ganze Seite. */
  schrift: string;
  /** Eigene Schrift nur für Titel und Wortmarke, z. B. eine Serife. */
  titelSchrift?: string;
  muster: Muster;
  zeichen: Zeichen;
  /** Rundung der Tafeln in px; 0 bis 2 heisst eckig, auch die Etiketten. */
  radius: number;
  /** Ganze Seite dunkel. */
  dunkel?: boolean;
  /** Etwas grössere Schrift, für ältere Leser. */
  gross?: boolean;
  /** Grundton der hellen Seite, sonst #FAF9F7. */
  papier?: string;
  /** LV95 (Ost, Nord) des Luftbilds für "luftbild" und "geteilt". */
  ort?: [number, number];
}

export interface Marke {
  id: string;
  /** Hostnamen ohne "www.", für die diese Marke gilt. */
  domains: string[];
  /** Name, wie er oben links steht -- zweiteilig für die Wortmarke; ein Leerzeichen gehört ans Ende des ersten Teils. */
  name: [string, string];
  /** Hauptfarbe: Knöpfe, Umriss der Parzelle. */
  farbe: string;
  /** Hellere Fassung der Farbe für Flächen (bei dunklen Marken eine dunkle). */
  hell: string;
  /** Schrift auf der Hauptfarbe; weiss, ausser bei hellen Farben auf dunklen Seiten. */
  aufFarbe?: string;
  schwerpunkt: Schwerpunkt;
  ueber: string;
  /** Kleine Zeile über dem Titel. */
  etikett: string;
  titel: string;
  satz: string;
  /** Was hinter der Anfrage liegt -- der Grund, die Angaben zu hinterlassen. */
  analyse: string;
  vorteile: string[];
  /** Der Satz im Band vor dem Fuss. */
  aufruf: string;
  design: Gestaltung;
}

const VORTEILE_PARZELLE = [
  'Ausnützung und Reserve nach der Bau- und Zonenordnung Ihrer Gemeinde',
  'Was sich anbauen, aufstocken oder neu bauen liesse',
  'Eine Einschätzung des Werts von Grundstück und Gebäude',
  'Persönlich geprüft von Fachleuten, nicht nur gerechnet',
];
const VORTEILE_HAUS = [
  'Eine Einschätzung des heutigen Werts',
  'Was Sanierung, Heizungsersatz oder Ausbau bringen',
  'Ob auf dem Grundstück mehr möglich wäre',
  'Persönlich geprüft von Fachleuten, nicht nur gerechnet',
];
const VORTEILE_WERT = [
  'Eine Einschätzung des Werts von Grundstück und Gebäude',
  'Welche Reserve den Wert erhöht',
  'Was ein Verkauf heute bringen könnte',
  'Persönlich geprüft von Fachleuten, nicht nur gerechnet',
];
const STANDARD_ETIKETT = 'Kostenlos · amtliche Daten · in Sekunden';

// Orte der Luftbilder, LV95; geprüft am 7. November auf Wohnquartiere
// (Abruf bei wms.geo.admin.ch, Blick aufs Bild).
const ORT = {
  frauenfeld: [2708779, 1267879] as [number, number],
  hoengg: [2679000, 1251200] as [number, number],
  meggen: [2671744, 1211547] as [number, number],
  duebendorf: [2690500, 1245900] as [number, number],
  allenwinden: [2684620, 1224353] as [number, number],
  kuesnacht: [2685710, 1242957] as [number, number],
};

export const MARKEN: Marke[] = [
  {
    id: 'parzellenchecker',
    domains: ['parzellenchecker.ch', 'parzellenchecker24.ch', 'parzellen-checker.ch'],
    name: ['Parzellen', 'Checker'], farbe: '#0E5A4E', hell: '#E7F1EE', schwerpunkt: 'parzelle',
    etikett: STANDARD_ETIKETT, aufruf: 'Wissen Sie, was in Ihrem Grundstück steckt?',
    ueber: 'Grundstück & Baupotenzial', titel: 'Was ist auf Ihrer Parzelle möglich?',
    satz: 'Adresse eingeben und in Sekunden sehen, was die amtlichen Daten über Ihr Grundstück sagen: Fläche, Bauzone, Gebäude.',
    analyse: 'Ihre ausführliche Parzellenanalyse', vorteile: VORTEILE_PARZELLE,
    // Julian, 7. November: "PERFEKT" -- bleibt, wie sie ist.
    design: { buehne: 'karte', schrift: 'Urbanist', muster: 'kataster', zeichen: 'raute', radius: 12 },
  },
  {
    id: 'hauschecker',
    domains: ['hauschecker.ch', 'haus-checker.ch', 'immowert-check.ch'],
    name: ['Haus', 'Checker'], farbe: '#1F4E8C', hell: '#E8EEF7', schwerpunkt: 'haus',
    etikett: STANDARD_ETIKETT, aufruf: 'Wie viel ist Ihr Haus heute wert?',
    ueber: 'Haus & Liegenschaft', titel: 'Was steckt in Ihrem Haus?',
    satz: 'Baujahr, Wohnungen, Heizung, Grundstück: Ihre Liegenschaft im Überblick, direkt aus den amtlichen Registern.',
    analyse: 'Ihre ausführliche Hausanalyse', vorteile: VORTEILE_HAUS,
    design: { buehne: 'geteilt', schrift: 'Figtree', muster: 'keins', zeichen: 'punkt', radius: 14, ort: ORT.frauenfeld },
  },
  {
    id: 'wasdarfichbauen',
    // Gekauft ist was-kann-ich-bauen.ch (13. November): die Marke heisst wie ihre Domain; die Kennung bleibt für bestehende Leads.
    domains: ['was-kann-ich-bauen.ch', 'waskannichbauen.ch'],
    name: ['Was kann ich ', 'bauen?'], farbe: '#9A3B28', hell: '#F6EAE6', schwerpunkt: 'bauen',
    etikett: STANDARD_ETIKETT, aufruf: 'Anbauen, aufstocken oder neu bauen?',
    ueber: 'Bauzone & Bauregeln', titel: 'Was können Sie auf Ihrem Grundstück bauen?',
    satz: 'Bauzone und Parzelle sofort sehen. Was die Gemeinde konkret erlaubt, klären wir für Sie ab.',
    analyse: 'Ihre ausführliche Bauabklärung', vorteile: VORTEILE_PARZELLE,
    design: { buehne: 'mitte', schrift: 'Manrope', muster: 'raster', zeichen: 'linie', radius: 6 },
  },
  {
    id: 'ausbaupotenzial',
    domains: ['ausbaupotenzial.ch', 'anbaupotenzial.ch'],
    name: ['Ausbau', 'Potenzial'], farbe: '#B7A6FF', hell: '#2A2547', aufFarbe: '#14121F', schwerpunkt: 'reserve',
    etikett: STANDARD_ETIKETT, aufruf: 'Mehr Wohnraum beginnt mit der richtigen Zahl.',
    ueber: 'Anbau & Aufstockung', titel: 'Wie viel mehr Wohnraum ist möglich?',
    satz: 'Anbau, Aufstockung oder ein zweites Haus im Garten: Sehen Sie zuerst, wie dicht Ihre Parzelle heute bebaut ist.',
    analyse: 'Ihre ausführliche Reserveanalyse', vorteile: VORTEILE_PARZELLE,
    design: { buehne: 'karte', schrift: 'Sora', muster: 'kataster', zeichen: 'raute', radius: 10, dunkel: true },
  },
  {
    id: 'grundstueckwert',
    domains: ['grundstueck-wert.ch', 'grundstueckchecker.ch', 'grundstuecks-check.ch', 'grundstueck-potenzial.ch'],
    name: ['Grundstück', 'Wert'], farbe: '#7A5418', hell: '#F6EFE4', schwerpunkt: 'wert',
    etikett: 'Amtliche Daten · kostenlos', aufruf: 'Kennen Sie den Wert Ihres Grundstücks?',
    ueber: 'Grundstück & Wert', titel: 'Was ist Ihr Grundstück wert?',
    satz: 'Fläche, Bauzone und Bebauung aus den amtlichen Daten: die Grundlage jeder Bewertung, in Sekunden.',
    analyse: 'Ihre persönliche Wertschätzung', vorteile: VORTEILE_WERT,
    design: { buehne: 'zeitung', schrift: 'Public Sans', titelSchrift: 'Newsreader', muster: 'keins', zeichen: 'keins', radius: 2, papier: '#F7F4EE' },
  },
  {
    id: 'erbliegenschaft',
    domains: ['erbliegenschaft.ch', 'erbschaft-liegenschaft.ch', 'erbhaus-check.ch'],
    name: ['Erb', 'Liegenschaft'], farbe: '#2F5446', hell: '#E8EFEB', schwerpunkt: 'erbe',
    etikett: 'Vertraulich · kostenlos · unverbindlich', aufruf: 'Eine gute Entscheidung beginnt mit den richtigen Zahlen.',
    ueber: 'Liegenschaft geerbt?', titel: 'Eine Liegenschaft geerbt. Und jetzt?',
    satz: 'Behalten, vermieten oder verkaufen: Der erste Schritt ist zu wissen, was die Liegenschaft ist und kann.',
    analyse: 'Ihre Entscheidungsgrundlage',
    vorteile: ['Eine Einschätzung des Werts für die Erbteilung', 'Was Behalten, Vermieten oder Verkaufen bedeutet', 'Ob auf dem Grundstück mehr möglich wäre', 'Persönlich und vertraulich, ohne Verpflichtung'],
    design: { buehne: 'mitte', schrift: 'Albert Sans', titelSchrift: 'Fraunces', muster: 'keins', zeichen: 'punkt', radius: 16, papier: '#F6F7F4' },
  },
  {
    id: 'hauszugross',
    domains: ['hauszugross.ch', 'haus-zu-gross.ch'],
    name: ['Haus zu ', 'gross?'], farbe: '#8A4B2A', hell: '#F5ECE6', schwerpunkt: 'alter',
    etikett: 'Kostenlos · vertraulich · ohne Verpflichtung', aufruf: 'In Ruhe entscheiden, mit den richtigen Zahlen.',
    ueber: 'Wohnen im Alter', titel: 'Ist Ihr Haus zu gross geworden?',
    satz: 'Bevor Sie entscheiden, ob Sie bleiben, umbauen oder verkaufen: Sehen Sie in einer Minute, was Ihr Grundstück laut den amtlichen Daten hergibt.',
    analyse: 'Ihre persönliche Auslegeordnung',
    vorteile: ['Was Bleiben, Umbauen oder Verkaufen bedeuten', 'Ob sich eine Einliegerwohnung oder ein Anbau lohnt', 'Eine Einschätzung des Werts von Haus und Grundstück', 'Persönlich und in Ruhe besprochen, ohne Verpflichtung'],
    design: { buehne: 'zeitung', schrift: 'Source Sans 3', titelSchrift: 'Lora', muster: 'keins', zeichen: 'keins', radius: 4, gross: true, papier: '#FBF8F3' },
  },
  {
    id: 'reserverechner',
    // Gekauft ist ausnuetzung-check.ch (13. November).
    domains: ['ausnuetzung-check.ch'],
    name: ['Ausnützung', 'Check'], farbe: '#0F6E7A', hell: '#E3F2F3', schwerpunkt: 'reserve',
    etikett: STANDARD_ETIKETT, aufruf: 'Reserve, die man kennt, ist Wert, den man nutzen kann.',
    ueber: 'Ausnützung & Reserve', titel: 'Wie viel Reserve steckt in Ihrem Grundstück?',
    satz: 'Die Gemeinde erlaubt oft mehr, als heute steht. Wir rechnen es mit den amtlichen Daten vor, für Ihre Adresse.',
    analyse: 'Ihre ausführliche Reserveanalyse', vorteile: VORTEILE_PARZELLE,
    design: { buehne: 'luftbild', schrift: 'IBM Plex Sans', muster: 'keins', zeichen: 'linie', radius: 8, ort: ORT.hoengg },
  },
  {
    id: 'aufstockcheck',
    // Gekauft ist aufstockungscheck.ch (13. November).
    domains: ['aufstockungscheck.ch', 'aufstockung-check.ch'],
    name: ['Aufstockungs', 'Check'], farbe: '#B4441E', hell: '#FBEDE6', schwerpunkt: 'bauen',
    etikett: STANDARD_ETIKETT, aufruf: 'Nach oben bauen statt neu kaufen.',
    ueber: 'Aufstocken & Ausbauen', titel: 'Ein Stockwerk mehr auf Ihrem Haus?',
    satz: 'Ob eine Aufstockung erlaubt ist, hängt an Zone und Ausnützung. Prüfen Sie Ihre Parzelle mit den amtlichen Daten.',
    analyse: 'Ihre Abklärung zur Aufstockung',
    vorteile: ['Ob die Zone ein weiteres Geschoss zulässt', 'Wie viel Geschossfläche noch frei ist', 'Was eine Aufstockung kosten und bringen könnte', 'Persönlich geprüft von Fachleuten, nicht nur gerechnet'],
    design: { buehne: 'karte', schrift: 'Outfit', muster: 'raster', zeichen: 'linie', radius: 4 },
  },
  {
    id: 'verdichtungscheck',
    domains: ['verdichtungscheck.ch', 'verdichtung-check.ch', 'verdichtungsrechner.ch'],
    name: ['Verdichtungs', 'Check'], farbe: '#F2B84B', hell: '#3A2E14', aufFarbe: '#17120A', schwerpunkt: 'reserve',
    etikett: STANDARD_ETIKETT, aufruf: 'Wo verdichtet wird, zählt jeder Quadratmeter.',
    ueber: 'Verdichtung', titel: 'Wie dicht darf Ihr Grundstück bebaut werden?',
    satz: 'Wo Gemeinden verdichten, darf oft mehr gebaut werden. Sehen Sie, wie viel Ihre Parzelle heute trägt.',
    analyse: 'Ihre Analyse zur Verdichtung', vorteile: VORTEILE_PARZELLE,
    design: { buehne: 'mitte', schrift: 'Schibsted Grotesk', muster: 'raster', zeichen: 'linie', radius: 6, dunkel: true },
  },
  {
    id: 'parzellenwert',
    domains: ['parzellenwert.ch', 'parzellen-wert.ch'],
    name: ['Parzellen', 'Wert'], farbe: '#E3C27E', hell: '#33291A', aufFarbe: '#15110A', schwerpunkt: 'wert',
    etikett: 'Amtliche Daten · kostenlos · diskret', aufruf: 'Der Wert liegt im Boden.',
    ueber: 'Parzelle & Wert', titel: 'Was ist Ihre Parzelle wert?',
    satz: 'Fläche, Zone und Bebauung bestimmen den Wert des Bodens. Sehen Sie die amtlichen Zahlen zu Ihrer Parzelle.',
    analyse: 'Ihre persönliche Wertschätzung', vorteile: VORTEILE_WERT,
    design: { buehne: 'karte', schrift: 'Instrument Sans', muster: 'kataster', zeichen: 'raute', radius: 2, dunkel: true },
  },
  {
    id: 'landwert24',
    domains: ['landwert24.ch', 'landwert-check.ch', 'landwert-rechner.ch'],
    name: ['Landwert', '24'], farbe: '#4C6B1F', hell: '#EEF3E4', schwerpunkt: 'wert',
    etikett: STANDARD_ETIKETT, aufruf: 'Land wird nicht mehr. Kennen Sie seinen Wert?',
    ueber: 'Bauland & Landwert', titel: 'Bauland oder Garten: Was ist Ihr Land wert?',
    satz: 'Ob Bauland, Reserve oder grosser Garten: Die amtlichen Daten zeigen, was auf Ihrem Land möglich ist.',
    analyse: 'Ihre Einschätzung zum Landwert',
    vorteile: ['Eine Einschätzung des Landwerts', 'Ob sich ein Teil als Bauland abtrennen liesse', 'Was die Zone auf Ihrem Land erlaubt', 'Persönlich geprüft von Fachleuten, nicht nur gerechnet'],
    design: { buehne: 'geteilt', schrift: 'Plus Jakarta Sans', muster: 'raster', zeichen: 'punkt', radius: 10, ort: ORT.duebendorf },
  },
  {
    id: 'hauswertrechner',
    domains: ['hauswertrechner.ch', 'hauswert-rechner.ch'],
    name: ['HausWert', 'Rechner'], farbe: '#22356F', hell: '#E8EBF5', schwerpunkt: 'haus',
    etikett: STANDARD_ETIKETT, aufruf: 'Erst rechnen, dann entscheiden.',
    ueber: 'Haus & Wert', titel: 'Was ist Ihr Haus heute wert?',
    satz: 'Die Grundlage jeder Schätzung: Grundstück, Baujahr, Fläche und Zone. Amtlich, für Ihre Adresse, in einer Minute.',
    analyse: 'Ihre persönliche Wertschätzung', vorteile: VORTEILE_HAUS,
    design: { buehne: 'luftbild', schrift: 'Red Hat Display', muster: 'keins', zeichen: 'raute', radius: 12, ort: ORT.meggen },
  },
  {
    id: 'liegenschaftpruefen',
    domains: ['liegenschaft-pruefen.ch'],
    name: ['Liegenschaft ', 'prüfen'], farbe: '#7B2337', hell: '#F5E8EC', schwerpunkt: 'haus',
    etikett: 'Amtliche Register · kostenlos', aufruf: 'Wer seine Liegenschaft kennt, entscheidet besser.',
    ueber: 'Liegenschaft & Register', titel: 'Ihre Liegenschaft im amtlichen Register',
    satz: 'Grundstück, Gebäude, Wohnungen und Heizung: alles, was Bund und Kanton über Ihre Liegenschaft wissen, auf einen Blick.',
    analyse: 'Ihre ausführliche Liegenschaftsanalyse', vorteile: VORTEILE_HAUS,
    design: { buehne: 'karte', schrift: 'Work Sans', muster: 'raster', zeichen: 'linie', radius: 0 },
  },
  {
    id: 'meineparzelle',
    domains: ['meine-parzelle.ch'],
    name: ['meine ', 'Parzelle'], farbe: '#B2400F', hell: '#FCEEE7', schwerpunkt: 'parzelle',
    etikett: STANDARD_ETIKETT, aufruf: 'Ihre Parzelle, Ihre Zahlen.',
    ueber: 'Ihre Parzelle', titel: 'Meine Parzelle: Was ist darauf möglich?',
    satz: 'Adresse eingeben, Parzelle sehen. Fläche, Zone und Gebäude kommen direkt aus der amtlichen Vermessung.',
    analyse: 'Ihre ausführliche Parzellenanalyse', vorteile: VORTEILE_PARZELLE,
    design: { buehne: 'karte', schrift: 'Lexend', muster: 'kataster', zeichen: 'punkt', radius: 20 },
  },
  {
    id: 'grundstueckrechner',
    // Gekauft ist parzellenrechner.ch (13. November).
    domains: ['parzellenrechner.ch'],
    name: ['Parzellen', 'Rechner'], farbe: '#155E75', hell: '#E2F0F4', schwerpunkt: 'reserve',
    etikett: STANDARD_ETIKETT, aufruf: 'Ein Rechner, Ihre Zahlen, keine Schätzung ins Blaue.',
    ueber: 'Rechner für Eigentümer', titel: 'Rechnen Sie nach, was Ihre Parzelle trägt',
    satz: 'Ausnützung einstellen, Reserve sehen: Der Rechner nimmt Fläche und Gebäude direkt aus den amtlichen Daten.',
    analyse: 'Ihre ausführliche Berechnung', vorteile: VORTEILE_PARZELLE,
    design: { buehne: 'mitte', schrift: 'Onest', muster: 'raster', zeichen: 'linie', radius: 10 },
  },
  {
    id: 'bauzonencheck',
    domains: ['bauzonencheck.ch', 'bauzone-check.ch', 'bauzonenrechner.ch'],
    name: ['Bauzonen', 'Check'], farbe: '#3E4A9E', hell: '#ECEEF9', schwerpunkt: 'bauen',
    etikett: STANDARD_ETIKETT, aufruf: 'Die Zone entscheidet. Kennen Sie Ihre?',
    ueber: 'Zone & Bauregeln', titel: 'In welcher Bauzone liegt Ihr Grundstück?',
    satz: 'Wohnzone, Mischzone oder Kernzone: Die Zone entscheidet, was gebaut werden darf. Prüfen Sie Ihre Adresse.',
    analyse: 'Ihre Abklärung zur Bauzone', vorteile: VORTEILE_PARZELLE,
    design: { buehne: 'mitte', schrift: 'DM Sans', muster: 'kataster', zeichen: 'raute', radius: 6 },
  },
  {
    id: 'eigentuemercheck',
    domains: ['eigentuemercheck.ch', 'eigentuemer-check.ch', 'eigentuemer-rechner.ch'],
    name: ['Eigentümer', 'Check'], farbe: '#334155', hell: '#EEF1F5', schwerpunkt: 'haus',
    etikett: 'Für Eigentümer · kostenlos', aufruf: 'Ihr Eigentum, klar in Zahlen.',
    ueber: 'Für Eigentümer', titel: 'Ihre Liegenschaft in Zahlen, amtlich und kostenlos',
    satz: 'Was die amtlichen Register über Ihr Grundstück und Ihr Haus wissen: für Ihre Adresse, in Sekunden.',
    analyse: 'Ihre persönliche Analyse', vorteile: VORTEILE_HAUS,
    design: { buehne: 'geteilt', schrift: 'Hanken Grotesk', muster: 'keins', zeichen: 'keins', radius: 8, ort: ORT.allenwinden },
  },
  {
    id: 'mfhcheck',
    domains: ['mfh-check.ch', 'mehrfamilienhaus-check.ch'],
    name: ['MFH', 'Check'], farbe: '#0B4F6C', hell: '#E3EFF4', schwerpunkt: 'mfh',
    etikett: 'Für Eigentümer von Mehrfamilienhäusern', aufruf: 'Rendite beginnt mit den richtigen Zahlen.',
    ueber: 'Mehrfamilienhaus', titel: 'Was steckt in Ihrem Mehrfamilienhaus?',
    satz: 'Wohnungen, Baujahr, Heizung und Reserve: die Zahlen zu Ihrem Renditeobjekt, direkt aus den amtlichen Registern.',
    analyse: 'Ihre Analyse zum Mehrfamilienhaus',
    vorteile: ['Eine Einschätzung des Werts der Liegenschaft', 'Ob sich Aufstockung oder Ersatzneubau rechnen', 'Was Sanierung und Heizungsersatz bedeuten', 'Persönlich geprüft von Fachleuten, nicht nur gerechnet'],
    design: { buehne: 'zeitung', schrift: 'Libre Franklin', titelSchrift: 'Source Serif 4', muster: 'keins', zeichen: 'keins', radius: 2, papier: '#F5F6F7' },
  },
  {
    id: 'baurechner24',
    domains: ['baurechner24.ch'],
    name: ['Baurechner', '24'], farbe: '#5B21B6', hell: '#EFE9FB', schwerpunkt: 'bauen',
    etikett: STANDARD_ETIKETT, aufruf: 'Bauen beginnt mit einer Rechnung.',
    ueber: 'Bauen & Rechnen', titel: 'Wie viel dürfen Sie bauen? Rechnen Sie nach.',
    satz: 'Zone, Fläche und Ausnützung für Ihre Adresse, amtlich und in Sekunden. Den Rest rechnet der Rechner.',
    analyse: 'Ihre ausführliche Bauabklärung', vorteile: VORTEILE_PARZELLE,
    design: { buehne: 'luftbild', schrift: 'Bricolage Grotesque', muster: 'keins', zeichen: 'punkt', radius: 16, ort: ORT.kuesnacht },
  },
  // ---------------------------------------------------------------------
  // Julian, 13. November: 23 Domains gekauft, "baue jetzt je eine Landing
  // Page für jede Webseite mit den genauen Namen". Wo bisher mehrere
  // Domains eine Marke teilten, bekommt jede gekaufte Domain ihre eigene:
  // eigener Name, eigene Farbe, eigener Aufbau -- der Ablauf bleibt gleich.
  // ---------------------------------------------------------------------
  {
    id: 'checkmyparcel',
    domains: ['checkmyparcel.ch', 'checkmyparzelle.ch'],
    name: ['CheckMy', 'Parcel'], farbe: '#0B6E4F', hell: '#E4F3EC', schwerpunkt: 'parzelle',
    etikett: STANDARD_ETIKETT, aufruf: 'Ein Check, und Sie wissen mehr über Ihre Parzelle.',
    ueber: 'Parzelle prüfen', titel: 'Check my parcel: Was steckt in Ihrem Grundstück?',
    satz: 'Adresse eingeben und sofort sehen, was die amtliche Vermessung über Ihre Parzelle weiss: Fläche, Zone, Gebäude.',
    analyse: 'Ihre ausführliche Parzellenanalyse', vorteile: VORTEILE_PARZELLE,
    design: { buehne: 'mitte', schrift: 'Urbanist', muster: 'kataster', zeichen: 'punkt', radius: 18 },
  },
  {
    id: 'parzellencheck24',
    domains: ['parzellencheck24.ch'],
    name: ['ParzellenCheck', '24'], farbe: '#2B5D34', hell: '#E8F1E9', schwerpunkt: 'parzelle',
    etikett: 'Rund um die Uhr · amtliche Daten · kostenlos', aufruf: 'Jetzt prüfen, nicht irgendwann.',
    ueber: 'Parzellen-Check', titel: 'Ihre Parzelle in 24 Sekunden geprüft',
    satz: 'Fläche, Bauzone und Gebäude direkt aus den amtlichen Daten. Tag und Nacht, ohne Anmeldung, für Ihre Adresse.',
    analyse: 'Ihre ausführliche Parzellenanalyse', vorteile: VORTEILE_PARZELLE,
    design: { buehne: 'karte', schrift: 'Figtree', muster: 'raster', zeichen: 'raute', radius: 8 },
  },
  {
    id: 'parzellepruefen',
    domains: ['parzellepruefen.ch', 'parzelle-pruefen.ch'],
    name: ['Parzelle ', 'prüfen'], farbe: '#6B2E5F', hell: '#F4E9F1', schwerpunkt: 'parzelle',
    etikett: 'Amtlich · kostenlos · unverbindlich', aufruf: 'Prüfen kostet nichts. Nicht prüfen kann viel kosten.',
    ueber: 'Parzelle prüfen', titel: 'Prüfen Sie Ihre Parzelle, bevor Sie entscheiden',
    satz: 'Verkaufen, bauen oder behalten: Die amtlichen Daten zu Ihrer Parzelle sind der erste Schritt, in einer Minute.',
    analyse: 'Ihre ausführliche Parzellenprüfung', vorteile: VORTEILE_PARZELLE,
    design: { buehne: 'mitte', schrift: 'Work Sans', muster: 'keins', zeichen: 'linie', radius: 0 },
  },
  {
    id: 'parzellencheck',
    domains: ['parzellen-check.ch'],
    name: ['Parzellen', 'Check'], farbe: '#0D5563', hell: '#E2EFF1', schwerpunkt: 'parzelle',
    etikett: STANDARD_ETIKETT, aufruf: 'Ihre Parzelle, aus der Luft und in Zahlen.',
    ueber: 'Parzellen-Check', titel: 'Der Parzellen-Check für Ihre Adresse',
    satz: 'Wir zeigen Ihnen Ihr Grundstück auf dem Luftbild, mit Fläche, Zone und Gebäuden aus den amtlichen Registern.',
    analyse: 'Ihre ausführliche Parzellenanalyse', vorteile: VORTEILE_PARZELLE,
    design: { buehne: 'geteilt', schrift: 'Lexend', muster: 'keins', zeichen: 'raute', radius: 12, ort: ORT.kuesnacht },
  },
  {
    id: 'hauswert24',
    domains: ['hauswert24.ch'],
    name: ['HausWert', '24'], farbe: '#8C2F39', hell: '#F6E8EA', schwerpunkt: 'haus',
    etikett: 'Rund um die Uhr · kostenlos · diskret', aufruf: 'Den Wert kennen, bevor andere ihn nennen.',
    ueber: 'Hauswert', titel: 'Was ist Ihr Haus wert? Jetzt prüfen.',
    satz: 'Grundstück, Baujahr, Wohnungen und Zone: die Grundlage jeder Schätzung, amtlich und jederzeit für Ihre Adresse.',
    analyse: 'Ihre persönliche Wertschätzung', vorteile: VORTEILE_WERT,
    design: { buehne: 'geteilt', schrift: 'Outfit', muster: 'keins', zeichen: 'punkt', radius: 10, ort: ORT.meggen },
  },
  {
    id: 'hauswertcheck',
    domains: ['hauswertcheck.ch', 'hauswert-check.ch'],
    name: ['HausWert', 'Check'], farbe: '#3B5323', hell: '#ECF2E5', schwerpunkt: 'haus',
    etikett: STANDARD_ETIKETT, aufruf: 'Ein Check, eine klare Zahl, kein Druck.',
    ueber: 'Hauswert-Check', titel: 'Der Wert-Check für Ihr Haus',
    satz: 'Was die amtlichen Register über Ihr Haus wissen, ist die Grundlage für seinen Wert. Sehen Sie es in Sekunden.',
    analyse: 'Ihre persönliche Wertschätzung', vorteile: VORTEILE_WERT,
    design: { buehne: 'karte', schrift: 'Manrope', muster: 'keins', zeichen: 'linie', radius: 14 },
  },
  {
    id: 'baupotenzialcheck',
    domains: ['baupotenzialcheck.ch', 'baupotenzial-check.ch'],
    name: ['BauPotenzial', 'Check'], farbe: '#A14716', hell: '#FBEEE5', schwerpunkt: 'reserve',
    etikett: STANDARD_ETIKETT, aufruf: 'Ungenutztes Potenzial ist verschenkter Wert.',
    ueber: 'Baupotenzial', titel: 'Wie viel Baupotenzial hat Ihr Grundstück?',
    satz: 'Oft erlaubt die Gemeinde mehr, als heute steht. Sehen Sie Fläche, Zone und Bebauung Ihrer Parzelle sofort.',
    analyse: 'Ihre ausführliche Potenzialanalyse', vorteile: VORTEILE_PARZELLE,
    design: { buehne: 'mitte', schrift: 'Sora', muster: 'kataster', zeichen: 'raute', radius: 6 },
  },
  {
    id: 'zonencheck',
    domains: ['zonen-check.ch'],
    name: ['Zonen', 'Check'], farbe: '#4338CA', hell: '#ECEBFB', schwerpunkt: 'bauen',
    etikett: STANDARD_ETIKETT, aufruf: 'Erst die Zone, dann der Plan.',
    ueber: 'Zonen-Check', titel: 'Welche Zone gilt für Ihr Grundstück?',
    satz: 'Die Zone bestimmt, was und wie hoch gebaut werden darf. Prüfen Sie Ihre Adresse mit den amtlichen Daten.',
    analyse: 'Ihre Abklärung zur Zone', vorteile: VORTEILE_PARZELLE,
    design: { buehne: 'karte', schrift: 'DM Sans', muster: 'raster', zeichen: 'punkt', radius: 4 },
  },
];

/** Die am 13. November gekauften Domains (Hostpoint). Jede hat ihre eigene Marke mit genau ihrem Namen. */
export const GEKAUFT = [
  'aufstockungscheck.ch', 'ausbaupotenzial.ch', 'ausnuetzung-check.ch', 'baupotenzialcheck.ch', 'bauzonencheck.ch', 'checkmyparcel.ch',
  'hauschecker.ch', 'hauswert24.ch', 'hauswertcheck.ch', 'hauswertrechner.ch', 'parzellencheck24.ch', 'parzellenchecker.ch',
  'parzellenrechner.ch', 'parzellepruefen.ch', 'verdichtungscheck.ch', 'was-kann-ich-bauen.ch', 'zonen-check.ch', 'erbliegenschaft.ch',
  'parzellenwert.ch', 'landwert24.ch', 'eigentuemercheck.ch', 'parzellen-check.ch', 'baurechner24.ch',
];

export const STANDARD_MARKE = MARKEN[0];

/** Die Marke zu einem Hostnamen, oder null, wenn es keine Marken-Domain ist. */
export function markeFuerHost(host: string | null | undefined): Marke | null {
  const h = String(host ?? '').toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '');
  return MARKEN.find(m => m.domains.includes(h)) ?? null;
}

export function markeNachId(id: string | null | undefined): Marke | null {
  return MARKEN.find(m => m.id === id) ?? null;
}
