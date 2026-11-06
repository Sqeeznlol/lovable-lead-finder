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
 * Die Domains waren am 6. November laut Registry (rdap.nic.ch) frei,
 * gekauft ist noch keine. Wer sie kauft, trägt sie hier ein.
 */
export type Schwerpunkt = 'parzelle' | 'haus' | 'bauen' | 'reserve' | 'wert' | 'erbe';

export interface Marke {
  id: string;
  /** Hostnamen ohne "www.", für die diese Marke gilt. */
  domains: string[];
  /** Name, wie er oben links steht -- zweiteilig für die Wortmarke. */
  name: [string, string];
  /** Hauptfarbe: Knöpfe, Umriss der Parzelle. */
  farbe: string;
  schwerpunkt: Schwerpunkt;
  ueber: string;
  titel: string;
  satz: string;
  /** Was hinter der Anfrage liegt -- der Grund, die Angaben zu hinterlassen. */
  analyse: string;
  vorteile: string[];
}

const VORTEILE_PARZELLE = [
  'Ausnützung und Reserve nach der Bau- und Zonenordnung Ihrer Gemeinde',
  'Was sich anbauen, aufstocken oder neu bauen liesse',
  'Eine Einschätzung des Werts von Grundstück und Gebäude',
  'Persönlich geprüft von Fachleuten, nicht nur gerechnet',
];

export const MARKEN: Marke[] = [
  {
    id: 'parzellenchecker',
    domains: ['parzellenchecker.ch', 'parzellenchecker24.ch', 'parzellen-checker.ch', 'parzellencheck24.ch',
      'parzellen-check.ch', 'checkmyparzelle.ch', 'checkmyparcel.ch', 'parzelle-pruefen.ch', 'parzellepruefen.ch', 'meine-parzelle.ch'],
    name: ['Parzellen', 'Checker'], farbe: '#3D45F5', schwerpunkt: 'parzelle',
    ueber: 'Grundstück & Baupotenzial', titel: 'Was ist auf Ihrer Parzelle möglich?',
    satz: 'Adresse eingeben und in Sekunden sehen, was die amtlichen Daten über Ihr Grundstück sagen -- Fläche, Bauzone, Gebäude.',
    analyse: 'Ihre ausführliche Parzellenanalyse', vorteile: VORTEILE_PARZELLE,
  },
  {
    id: 'hauschecker',
    domains: ['hauschecker.ch', 'haus-checker.ch', 'hauswertcheck.ch', 'hauswert-check.ch', 'hauswert24.ch', 'hauswert-rechner.ch',
      'liegenschaft-pruefen.ch', 'immowert-check.ch', 'mfh-check.ch', 'mehrfamilienhaus-check.ch'],
    name: ['Haus', 'Checker'], farbe: '#1F4E8C', schwerpunkt: 'haus',
    ueber: 'Haus & Liegenschaft', titel: 'Was steckt in Ihrem Haus?',
    satz: 'Baujahr, Wohnungen, Heizung, Grundstück: Ihre Liegenschaft im Überblick, direkt aus den amtlichen Registern.',
    analyse: 'Ihre ausführliche Hausanalyse',
    vorteile: ['Eine Einschätzung des heutigen Werts', 'Was Sanierung, Heizungsersatz oder Ausbau bringen', 'Ob auf dem Grundstück mehr möglich wäre', 'Persönlich geprüft von Fachleuten, nicht nur gerechnet'],
  },
  {
    id: 'wasdarfichbauen',
    domains: ['wasdarfichbauen.ch', 'was-darf-ich-bauen.ch', 'waskannichbauen.ch', 'was-kann-ich-bauen.ch', 'wieviel-darf-ich-bauen.ch',
      'bauzone-check.ch', 'bauzonencheck.ch', 'zonen-check.ch', 'baupotenzial-check.ch', 'baupotenzialcheck.ch', 'baurechner24.ch'],
    name: ['Was darf ich', 'bauen?'], farbe: '#B4432E', schwerpunkt: 'bauen',
    ueber: 'Bauzone & Bauregeln', titel: 'Was dürfen Sie auf Ihrem Grundstück bauen?',
    satz: 'Bauzone und Parzelle sofort sehen. Was die Gemeinde konkret erlaubt, klären wir für Sie ab.',
    analyse: 'Ihre ausführliche Bauabklärung', vorteile: VORTEILE_PARZELLE,
  },
  {
    id: 'ausbaupotenzial',
    domains: ['ausbaupotenzial.ch', 'ausnuetzungsreserve.ch', 'ausnuetzung-check.ch', 'aufstockungscheck.ch', 'aufstockung-check.ch',
      'anbaupotenzial.ch', 'verdichtungscheck.ch', 'verdichtung-check.ch'],
    name: ['Ausbau', 'Potenzial'], farbe: '#6A4BC4', schwerpunkt: 'reserve',
    ueber: 'Reserve & Verdichtung', titel: 'Wie viel Reserve hat Ihr Grundstück?',
    satz: 'Viele Grundstücke dürften mehr tragen, als heute darauf steht. Sehen Sie, wie dicht Ihre Parzelle bebaut ist.',
    analyse: 'Ihre ausführliche Reserveanalyse', vorteile: VORTEILE_PARZELLE,
  },
  {
    id: 'grundstueckwert',
    domains: ['grundstueck-wert.ch', 'parzellenwert.ch', 'parzellen-wert.ch', 'landwert24.ch', 'landwert-check.ch',
      'grundstueckchecker.ch', 'grundstuecks-check.ch', 'grundstueck-potenzial.ch', 'grundstueckrechner.ch', 'parzellenrechner.ch',
      'eigentuemercheck.ch', 'eigentuemer-check.ch'],
    name: ['Grundstück', 'Wert'], farbe: '#8A6512', schwerpunkt: 'wert',
    ueber: 'Grundstück & Wert', titel: 'Was ist Ihr Grundstück wert?',
    satz: 'Fläche, Bauzone und Bebauung aus den amtlichen Daten -- die Grundlage jeder Bewertung, in Sekunden.',
    analyse: 'Ihre persönliche Wertschätzung',
    vorteile: ['Eine Einschätzung des Werts von Grundstück und Gebäude', 'Welche Reserve den Wert erhöht', 'Was ein Verkauf heute bringen könnte', 'Persönlich geprüft von Fachleuten, nicht nur gerechnet'],
  },
  {
    id: 'erbliegenschaft',
    domains: ['erbliegenschaft.ch', 'erbschaft-liegenschaft.ch'],
    name: ['Erb', 'Liegenschaft'], farbe: '#3D5A4C', schwerpunkt: 'erbe',
    ueber: 'Liegenschaft geerbt?', titel: 'Eine Liegenschaft geerbt -- und jetzt?',
    satz: 'Behalten, vermieten oder verkaufen: Der erste Schritt ist zu wissen, was die Liegenschaft ist und kann.',
    analyse: 'Ihre Entscheidungsgrundlage',
    vorteile: ['Eine Einschätzung des Werts für die Erbteilung', 'Was Behalten, Vermieten oder Verkaufen bedeutet', 'Ob auf dem Grundstück mehr möglich wäre', 'Persönlich und vertraulich, ohne Verpflichtung'],
  },
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
