/**
 * Preisniveau und Lagequalität der Zürcher Gemeinden.
 *
 * Wofür das gebraucht wird: Der erzielbare Erlös je m² Hauptnutzfläche
 * unterscheidet sich im Kanton um mehr als das Dreifache. Dieselbe
 * Ausbaureserve ist in Küsnacht ein Vielfaches dessen wert, was sie in
 * Bauma wert wäre. Ohne diese Unterscheidung stehen in der Top-Liste
 * Objekte, die rechnerisch gross, wirtschaftlich aber uninteressant sind.
 *
 * Die Einteilung folgt zwei Treibern, die in Zürich zusammenfallen:
 * Steuerbelastung und Seelage. Gemeinden mit tiefem Steuerfuss ziehen
 * kaufkräftige Käufer an, was die Preise trägt; die Goldküste verbindet
 * beides.
 *
 * WICHTIG: Das sind Richtwerte für die Priorisierung, keine Schätzung im
 * rechtlichen Sinn. Sie stammen aus Erfahrungswerten, nicht aus einer
 * laufend gepflegten Marktdatenbank, und sollten mit eigenen Abschlüssen
 * abgeglichen werden -- dafür sind sie hier als Tabelle und nicht im Code
 * verstreut.
 */

export type Lagestufe = 'spitze' | 'hoch' | 'gehoben' | 'mittel' | 'einfach';

export interface Gemeindeprofil {
  /** Erzielbarer Verkaufserlös je m² HNF, CHF. */
  erloesProM2: number;
  stufe: Lagestufe;
  /** Kurze Begründung für die Einstufung. */
  merkmal: string;
}

const PROFIL: Record<Lagestufe, { erloesProM2: number; merkmal: string }> = {
  spitze:   { erloesProM2: 18000, merkmal: 'Tiefe Steuern, Seelage, hohe Nachfrage' },
  hoch:     { erloesProM2: 14000, merkmal: 'Tiefe Steuern oder Stadtlage' },
  gehoben:  { erloesProM2: 11000, merkmal: 'Gute Erreichbarkeit, solide Nachfrage' },
  mittel:   { erloesProM2:  8500, merkmal: 'Durchschnittliche Lage im Kanton' },
  einfach:  { erloesProM2:  6500, merkmal: 'Randlage, längere Vermarktungsdauer' },
};

/**
 * Gemeinden nach Lagestufe. Nicht aufgeführte Gemeinden gelten als
 * "mittel" -- das ist die vorsichtige Annahme.
 */
const ZUORDNUNG: Record<string, Lagestufe> = {
  // Goldküste und steuergünstige Seegemeinden
  'Küsnacht': 'spitze', 'Zollikon': 'spitze', 'Herrliberg': 'spitze',
  'Erlenbach': 'spitze', 'Meilen': 'spitze', 'Zumikon': 'spitze',
  'Rüschlikon': 'spitze', 'Kilchberg': 'spitze', 'Uetikon am See': 'spitze',

  // Stadt Zürich und gut angebundene, teure Gemeinden
  'Zürich': 'hoch', 'Zollikerberg': 'hoch', 'Männedorf': 'hoch',
  'Stäfa': 'hoch', 'Horgen': 'hoch', 'Thalwil': 'hoch', 'Oberrieden': 'hoch',
  'Wädenswil': 'hoch', 'Uitikon': 'hoch', 'Maur': 'hoch', 'Egg': 'hoch',
  'Küsnacht (ZH)': 'hoch', 'Adliswil': 'hoch',

  // Agglomeration mit solider Nachfrage
  'Dietikon': 'gehoben', 'Schlieren': 'gehoben', 'Opfikon': 'gehoben',
  'Wallisellen': 'gehoben', 'Dübendorf': 'gehoben', 'Kloten': 'gehoben',
  'Bassersdorf': 'gehoben', 'Uster': 'gehoben', 'Volketswil': 'gehoben',
  'Regensdorf': 'gehoben', 'Rümlang': 'gehoben', 'Wetzikon (ZH)': 'gehoben',
  'Bülach': 'gehoben', 'Winterthur': 'gehoben', 'Effretikon': 'gehoben',
  'Illnau-Effretikon': 'gehoben', 'Fällanden': 'gehoben', 'Greifensee': 'gehoben',

  // Randlagen mit längerer Vermarktungsdauer
  'Bauma': 'einfach', 'Fischenthal': 'einfach', 'Sternenberg': 'einfach',
  'Wildberg': 'einfach', 'Turbenthal': 'einfach', 'Rheinau': 'einfach',
  'Truttikon': 'einfach', 'Dorf': 'einfach', 'Adlikon': 'einfach',
  'Volken': 'einfach', 'Thalheim an der Thur': 'einfach',
  'Waltalingen': 'einfach', 'Stammheim': 'einfach',
};

export function gemeindeprofil(gemeinde?: string | null): Gemeindeprofil {
  const stufe = (gemeinde && ZUORDNUNG[gemeinde.trim()]) || 'mittel';
  return { stufe, ...PROFIL[stufe] };
}

export const LAGE_LABEL: Record<Lagestufe, string> = {
  spitze: 'Spitzenlage',
  hoch: 'Hochpreisig',
  gehoben: 'Gehoben',
  mittel: 'Mittel',
  einfach: 'Randlage',
};
