/**
 * Tipps und Tricks für Eigentümer (Julian, 19. November: «Tipps und Tricks,
 * wie was man zum Beispiel auch mit einer Ölheizung wie sanieren»).
 *
 * Keine Zahl und keine Regel ohne Herkunft: jeder Satz ist auf der
 * genannten amtlichen oder offiziellen Seite nachgelesen (19. November,
 * mit wörtlichem Zitat). Wo die Kantone verschieden sind, trägt der Tipp
 * seinen Kanton und erscheint nur bei einer Parzelle dort; vor der Suche
 * stehen nur Tipps, die überall gelten. Ohne "@/"-Pfade, weil
 * seo-marken.ts sie liest.
 *
 * Zwei Dinge, die beim Nachlesen auffielen:
 *   * Ab dem 1. Januar 2029 fallen Steuerabzüge weg (Bundesrat, 1. April
 *     2026). Wer sanieren will, sollte das wissen.
 *   * Zürich nennt auf der Seite zum Heizungsersatz jeden Ersatz
 *     bewilligungspflichtig; die neuere Seite zum Meldeverfahren lässt die
 *     meisten Wärmepumpen seit 2023 ohne Baubewilligung zu. Es gilt die
 *     genauere, neuere Seite.
 */
import type { Schwerpunkt } from './check-marken';

export type Thema = 'heizung' | 'sanieren' | 'bauen' | 'verkaufen' | 'erben' | 'alter';
export type Kanton = 'ZH' | 'ZG' | 'LU' | 'TG';

export interface Quelle { name: string; url: string }

export interface Tipp {
  titel: string;
  text: string;
  quellen: Quelle[];
  thema: Thema;
  /** Gilt nur in diesem Kanton. */
  kanton?: Kanton;
  /** Ratgeber auf derselben Seite, falls es einen gibt. */
  ratgeber?: string;
}

const ENERGIESCHWEIZ_ERSATZ = { name: 'EnergieSchweiz', url: 'https://www.energieschweiz.ch/modernisieren/informationen-heizungsersatz/' };

export const TIPPS: Tipp[] = [
  // ---------------------------------------------------------------- Heizung
  {
    thema: 'heizung', ratgeber: 'heizung-ersetzen',
    titel: 'Die Heizung ersetzen, bevor sie ausfällt',
    text: 'Heizungen halten im Durchschnitt rund 20 Jahre. Ist Ihre Heizung zehn Jahre alt oder älter, lohnt es sich, den Ersatz jetzt zu planen. Wer erst handelt, wenn die Heizung im Winter stillsteht, hat kaum Zeit für Offerten und Fördergesuche.',
    quellen: [ENERGIESCHWEIZ_ERSATZ],
  },
  {
    thema: 'heizung',
    titel: 'Kostenlose Beratung zu Hause: «erneuerbar heizen»',
    text: 'Bei der Impulsberatung «erneuerbar heizen» kommt eine Fachperson zu Ihnen und zeigt, welche erneuerbare Heizung passt, mit Kostenschätzung, Fördergeldern und Steuerabzügen. Für Sie kostet sie nichts, wenn die Heizung älter als zehn Jahre ist und als Hauptheizung dient.',
    quellen: [{ name: 'EnergieSchweiz', url: 'https://www.energieschweiz.ch/modernisieren/impulsberatung-einfamilienhaus/' }],
  },
  {
    thema: 'heizung',
    titel: 'Fördergeld immer vor Baubeginn beantragen',
    text: 'Das Gesuch um Förderbeiträge muss eingereicht sein, bevor die Arbeiten beginnen. Nachträglich eingereichte Gesuche berücksichtigt das Gebäudeprogramm nicht, und auch das Förderprogramm des Kantons Zürich fördert nach Baubeginn nichts mehr.',
    quellen: [
      { name: 'Das Gebäudeprogramm', url: 'https://www.dasgebaeudeprogramm.ch/de/vorgehen/gebaudehulle/haufige-fragen-zur-gesuchsstellung/' },
      { name: 'Förderprogramm Kanton Zürich 2026', url: 'https://www.zh.ch/content/dam/zhweb/bilder-dokumente/themen/umwelt-tiere/energie/energieberatung-und-energiefoerderung/ktzh_foerderprogramm_2026.pdf' },
    ],
  },
  {
    thema: 'heizung', kanton: 'ZH',
    titel: 'Öl oder Gas ersetzen im Kanton Zürich',
    text: 'Seit dem 1. September 2022 gilt: Beim Ersatz kommt eine erneuerbare Heizung, wenn das technisch möglich ist und über die ganze Lebensdauer höchstens 5 % mehr kostet. Sonst ist Öl oder Gas weiter erlaubt, dann müssen aber 10 % des Energieverbrauchs eingespart oder erneuerbar gedeckt werden. Für finanzielle Härtefälle gibt es Ausnahmen.',
    quellen: [{ name: 'Kanton Zürich, Heizungsersatz', url: 'https://www.zh.ch/de/planen-bauen/bauvorschriften/bauvorschriften-gebaeude-energie/heizungsersatz.html' }],
  },
  {
    thema: 'heizung', kanton: 'ZH',
    titel: 'Wärmepumpe im Kanton Zürich: melden statt warten',
    text: 'Seit dem 1. Januar 2023 lassen sich viele Wärmepumpen im Meldeverfahren erstellen: Luft/Wasser-Wärmepumpen innen und aussen bis 2 Kubikmeter, Erdsonden-Wärmepumpen und Fernwärmeanschlüsse. Ordnet die Gemeinde innert 30 Tagen nichts anderes an, darf gebaut werden. Aussen aufgestellte Geräte in Kernzonen und bei geschützten Ortsbildern oder Denkmälern brauchen weiterhin eine Baubewilligung. Für die Erdsonde selbst braucht es immer eine Bewilligung nach dem Gewässerschutz.',
    quellen: [
      { name: 'Kanton Zürich, Meldeverfahren', url: 'https://www.zh.ch/de/planen-bauen/baubewilligung/baueingabe-verfahren/meldeverfahren-solaranlagen-waermepumpen-eladestationen.html' },
      { name: 'Kanton Zürich, Erdwärmesonden', url: 'https://www.zh.ch/de/planen-bauen/bauvorschriften/energienutzung-untergrund-wasser/erdwaermesonden.html' },
    ],
  },
  {
    thema: 'heizung', kanton: 'ZG',
    titel: 'Öl oder Gas ersetzen im Kanton Zug',
    text: 'Seit dem 1. Februar 2024 gilt: Wer wieder mit Öl oder Gas heizt, muss mindestens 20 % des Wärmebedarfs erneuerbar decken oder das Gebäude im selben Mass verbessern. Ausgenommen sind Minergie-Bauten und Gebäude ab GEAK-Klasse C. Jeder Heizungsersatz wird vorher mit einer Bauanzeige bei der Gemeinde gemeldet.',
    quellen: [
      { name: 'Kanton Zug, Energievorschriften', url: 'https://zg.ch/de/planen-bauen/bauvorschriften/gebaeude-und-energie/energievorschriften-vollzug' },
      { name: 'Kanton Zug, Mitteilung vom 25. Januar 2024', url: 'https://zg.ch/de/news/2024/January/neues-energiegesetz-tritt-in-kraft' },
    ],
  },
  {
    thema: 'heizung', kanton: 'LU',
    titel: 'Öl oder Gas ersetzen im Kanton Luzern',
    text: 'Eine bestehende Ölheizung müssen Sie nicht vorzeitig ersetzen. Erst wenn sie am Ende ihrer Lebensdauer ersetzt wird, darf höchstens 90 % des Wärmebedarfs aus nicht erneuerbarer Energie kommen. Ausgenommen sind Gebäude ab GEAK-Klasse D und Minergie-Bauten. Gemeldet wird mindestens 20 Tage vor Baubeginn.',
    quellen: [
      { name: 'Kanton Luzern, Energiegesetz kompakt', url: 'https://uwe.lu.ch/Energiegesetz/KEnG_kompakt' },
      { name: 'Kanton Luzern, häufige Fragen', url: 'https://uwe.lu.ch/Energiegesetz/FAQ' },
    ],
  },
  {
    thema: 'heizung', kanton: 'TG',
    titel: 'Öl oder Gas ersetzen im Kanton Thurgau',
    text: 'Wer wieder eine Öl- oder Gasheizung einbaut, muss einen Teil des Bedarfs einsparen oder erneuerbar decken: mindestens 15 % ab 2025 und 20 % ab 2030. Für die Umsetzung bleiben drei Jahre. Gebäude mit einer Baubewilligung nach dem 1. Juli 1988 dürfen ohne weitere Massnahmen wieder fossil heizen.',
    quellen: [
      { name: 'Kanton Thurgau, Energienutzungsgesetz § 8a', url: 'https://www.rechtsbuch.tg.ch/app/de/texts_of_law/731.1' },
      { name: 'Kanton Thurgau, Vollzugshilfe Energie', url: 'https://energie.tg.ch/public/upload/assets/177247/Energieordner_TG_Register_4.pdf' },
    ],
  },
  // ---------------------------------------------------------------- Sanieren
  {
    thema: 'sanieren',
    titel: 'Ab 2029 ändern die Steuerabzüge',
    text: 'Ab dem 1. Januar 2029 entfällt für selbst bewohntes Wohneigentum der Abzug für den Unterhalt, bei Bund, Kantonen und Gemeinden. Bei der direkten Bundessteuer fallen auch die Abzüge für Investitionen ins Energiesparen weg. Bis dahin lassen sich Investitionen ins Energiesparen, die in einem Jahr nicht ausgeschöpft sind, bei der Bundessteuer auf die folgenden Steuerjahre übertragen. Wer ohnehin sanieren will, bespricht den Zeitpunkt am besten mit seiner Steuerberatung.',
    quellen: [
      { name: 'Bundesrat, 1. April 2026', url: 'https://www.admin.ch/de/newnsb/yGTqBPowRqyVh0zPokW-q' },
      { name: 'Liegenschaftskostenverordnung', url: 'https://www.fedlex.admin.ch/eli/cc/2018/212/de' },
    ],
  },
  {
    thema: 'sanieren',
    titel: 'Der GEAK Plus zeigt, was sich lohnt',
    text: 'Der GEAK ist der Gebäudeenergieausweis der Kantone. Er bewertet Gebäudehülle und Gesamtenergie in Klassen von A bis G. Der GEAK Plus enthält zusätzlich einen Beratungsbericht mit Varianten, wie sich das Haus sanieren liesse. In Zug und Luzern entscheidet die Klasse auch mit, was beim Heizungsersatz gilt.',
    quellen: [{ name: 'GEAK', url: 'https://www.geak.ch/der-geak/was-ist-der-geak/' }],
  },
  {
    thema: 'sanieren',
    titel: 'Solaranlage: Einmalvergütung beantragen',
    text: 'Für eine Photovoltaikanlage ab 2 kW mit festem Standort zahlt Pronovo eine Einmalvergütung. Das Gesuch kann jede Betreiberin und jeder Betreiber stellen, auch über den Installateur.',
    quellen: [{ name: 'Pronovo', url: 'https://pronovo.ch/de/foerderung/photovoltaik/haeufige-fragen/' }],
  },
  // ---------------------------------------------------------------- Bauen
  {
    thema: 'bauen', ratgeber: 'aufstocken',
    titel: 'Früh mit dem Bauamt reden',
    text: 'Reden Sie mit dem Bauamt Ihrer Gemeinde, bevor Sie viel Geld in Pläne stecken. Der Kanton Zürich zum Beispiel empfiehlt, jedes Vorhaben vor der Eingabe vorzubesprechen. In der Stadt Zürich lässt sich zu einzelnen Fragen auch ein Vorentscheid einholen.',
    quellen: [
      { name: 'Kanton Zürich, Baueingabe', url: 'https://www.zh.ch/de/planen-bauen/baubewilligung/baueingabe-verfahren.html' },
      { name: 'Stadt Zürich, Bauberatung', url: 'https://www.stadt-zuerich.ch/de/planen-und-bauen/bauberatung-und-dienstleistungen/bauberatung/bauten-anlagen/beratung-baubewilligungen.html' },
    ],
  },
  // ---------------------------------------------------------------- Verkaufen
  {
    thema: 'verkaufen', kanton: 'ZH', ratgeber: 'grundstueckgewinnsteuer',
    titel: 'Verkaufen im Kanton Zürich: die Besitzdauer zählt',
    text: 'Auf den Gewinn beim Verkauf erhebt die Gemeinde die Grundstückgewinnsteuer. Sie sinkt nach 5 vollen Jahren Besitz um 5 % und nach 20 Jahren um 50 %. Wer nach weniger als einem Jahr verkauft, zahlt 50 % mehr. Eine Handänderungssteuer gibt es im Kanton Zürich seit 2005 nicht mehr.',
    quellen: [
      { name: 'Steuergesetz Kanton Zürich, § 225', url: 'https://www.notes.zh.ch/appl/zhlex_r.nsf/WebView/A1B72A220CD6E747C1258DC4002A921E/$File/631.1_8.6.97_132.pdf' },
      { name: 'Kanton Zürich, Grundstückgewinnsteuer', url: 'https://www.zh.ch/de/steuern-finanzen/steuern/steuern-natuerliche-personen/grundstueck-gewinnsteuer.html' },
    ],
  },
  // ---------------------------------------------------------------- Erben
  {
    thema: 'erben', ratgeber: 'liegenschaft-geerbt',
    titel: 'Erbschaft ausschlagen: drei Monate Zeit',
    text: 'Wer erbt, kann die Erbschaft innert drei Monaten ausschlagen, etwa wenn mehr Schulden als Vermögen da sind. Die Frist beginnt in der Regel, sobald man vom Tod erfährt. Wer sich vorher in die Angelegenheiten der Erbschaft einmischt, kann nicht mehr ausschlagen.',
    quellen: [{ name: 'Zivilgesetzbuch, Art. 567 und 571', url: 'https://www.fedlex.admin.ch/eli/cc/24/233_245_233/de' }],
  },
  {
    thema: 'erben',
    titel: 'Erbengemeinschaft: alle entscheiden gemeinsam',
    text: 'Erben werden gemeinsam Eigentümer und entscheiden über die Liegenschaft gemeinsam, solange niemand als Vertreter bestimmt ist. Können sie sich nicht einigen, kann jede Erbin und jeder Erbe bei der Behörde einen Vertreter beantragen.',
    quellen: [{ name: 'Zivilgesetzbuch, Art. 602', url: 'https://www.fedlex.admin.ch/eli/cc/24/233_245_233/de' }],
  },
  // ---------------------------------------------------------------- Wohnen im Alter
  {
    thema: 'alter', ratgeber: 'haus-zu-gross',
    titel: 'Wenn das Haus zu gross wird: fünf Wege',
    text: 'Bleiben und eine Wohnung abtrennen, anbauen oder aufstocken, das Haus aufteilen und einen Teil verkaufen, an die Kinder übergeben, oder verkaufen und in eine Wohnung ziehen. Unser Ratgeber zeigt, was jeder Weg bedeutet.',
    quellen: [],
  },
];

/** Welche Themen eine Marke zuerst zeigt. */
const REIHE: Record<Schwerpunkt, Thema[]> = {
  parzelle: ['bauen', 'verkaufen', 'sanieren', 'heizung'],
  haus: ['sanieren', 'heizung', 'verkaufen'],
  bauen: ['bauen', 'sanieren', 'heizung'],
  reserve: ['bauen', 'verkaufen', 'sanieren'],
  wert: ['verkaufen', 'bauen', 'sanieren'],
  erbe: ['erben', 'verkaufen', 'sanieren'],
  alter: ['alter', 'verkaufen', 'erben', 'sanieren'],
  mfh: ['sanieren', 'heizung', 'bauen'],
};

export const TIPP_TITEL = 'Was Eigentümer wissen sollten';

/**
 * Höchstens sechs Tipps, das Thema der Marke zuerst; im Heizungs-Check die
 * Heizung. Tipps eines Kantons nur, wenn die Parzelle dort liegt, und
 * dann vor den allgemeinen ihres Themas.
 */
export function tippsFuer(s: Schwerpunkt, heizung = false, kanton?: string | null): Tipp[] {
  const reihe = [...new Set<Thema>(heizung ? ['heizung', 'sanieren', ...REIHE[s]] : REIHE[s])];
  return reihe.flatMap(t => [
    ...TIPPS.filter(x => x.thema === t && x.kanton && x.kanton === kanton),
    ...TIPPS.filter(x => x.thema === t && !x.kanton),
  ]).slice(0, 6);
}
