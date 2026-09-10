/**
 * Der Brief an Eigentümer, die keine Telefonnummer haben.
 *
 * Nicht jede Nummer lässt sich finden -- alte Einträge, Firmen ohne
 * Eintrag, Erbengemeinschaften. Dann bleibt der Brief, und der lohnt
 * sich: er kommt an, wo ein Anruf nicht hinkommt.
 *
 * Die Anrede lässt sich aus einem Namen nicht ableiten. "René" ist
 * beides, "M. Meier" sagt gar nichts, und eine Erbengemeinschaft ist
 * weder Herr noch Frau. Geraten würde hier peinlich -- deshalb wird
 * die Anrede gewählt, mit einer Voreinstellung, die nie falsch ist.
 */
export type Anredeform = 'herr' | 'frau' | 'beide' | 'neutral';

export interface BriefEmpfaenger {
  name: string;
  adresse?: string | null;
  plzOrt?: string | null;
}

export interface BriefObjekt {
  address: string;
  parzelle?: string | null;
  plz?: string | null;
  gemeinde?: string | null;
  plzOrt?: string | null;
}

/** Der Nachname allein -- "Sehr geehrter Herr Hans Schmid" liest sich falsch. */
export function nachname(name: string): string {
  const sauber = (name || '').replace(/\s+\d+\/\d+\s*$/, '').trim();
  if (!sauber) return '';
  // "Schmid, René" -- vor dem Komma steht der Nachname.
  if (sauber.includes(',')) return sauber.split(',')[0].trim();
  const teile = sauber.split(/\s+/);
  return teile[teile.length - 1];
}

export function anrede(form: Anredeform, empfaenger: BriefEmpfaenger[]): string {
  const namen = empfaenger.map(e => nachname(e.name)).filter(Boolean);
  if (form === 'neutral' || namen.length === 0) return 'Sehr geehrte Damen und Herren';
  if (form === 'beide') {
    // Zwei Eigentümer, ein Brief: beide werden genannt.
    if (namen.length >= 2) {
      return `Sehr geehrte Frau ${namen[0]}, sehr geehrter Herr ${namen[1]}`;
    }
    return `Sehr geehrte Frau ${namen[0]}, sehr geehrter Herr ${namen[0]}`;
  }
  return form === 'frau'
    ? `Sehr geehrte Frau ${namen[0]}`
    : `Sehr geehrter Herr ${namen[0]}`;
}

/** "Parzelle 1114 an der Waltalingerstrasse 19 in 8526 Neunforn" */
export function objektsatz(o: BriefObjekt): string {
  const ort = o.plzOrt || [o.plz, o.gemeinde].filter(Boolean).join(' ');
  const teile: string[] = [];
  if (o.parzelle) teile.push(`Parzelle ${o.parzelle}`);
  if (o.address) teile.push(`${teile.length ? 'an der ' : ''}${o.address}`);
  if (ort) teile.push(`in ${ort}`);
  return teile.join(' ');
}

export const ABSENDER = {
  firma: 'Stimo Generalunternehmung AG',
  ort: 'Kloten',
  personen: [
    { name: 'Julian Kurmann', mail: 'kurmann@stimo.ch' },
    { name: 'Leander Kägi', mail: 'leander.kaegi@meinwohntraum.ch' },
  ],
} as const;

export function brieftext(
  form: Anredeform,
  empfaenger: BriefEmpfaenger[],
  objekt: BriefObjekt,
): string {
  return `${anrede(form, empfaenger)}

wir interessieren uns für Ihr Grundstück ${objektsatz(objekt)}.

Wir sind ein Generalunternehmen aus Kloten und entwickeln Wohnraum in
der Region. Ihr Grundstück ist uns dabei aufgefallen, weil es nach der
geltenden Bau- und Zonenordnung mehr zulässt, als heute darauf steht.

Falls Sie einen Verkauf in Betracht ziehen -- jetzt oder in einigen
Jahren --, würden wir gerne unverbindlich mit Ihnen sprechen. Wir
melden uns gerne bei Ihnen, oder Sie erreichen uns direkt unter den
unten stehenden Angaben.

Freundliche Grüsse`;
}
