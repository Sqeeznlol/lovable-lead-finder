/**
 * Die Nachfass-Abfolge der Check-Leads (Migration 20261115110000):
 * Tag 1 Bericht, Tag 7 Erinnerung, nach drei Monaten neu geprüft.
 * Rein und ohne Datenbank, damit ein Test sie prüft. Gezählt wird ab dem
 * Eingang der Anfrage, nicht ab dem letzten Schritt: ein Bericht, der erst
 * am Tag 5 rausging, verschiebt die Erinnerung nicht.
 */
export interface NachfassLead {
  name: string; adresse: string | null; erstellt_am: string; bearbeitet: boolean;
  angaben?: Record<string, unknown> | null; nachfass_stufe?: number | null;
}

export const STUFEN = [
  { tag: 1, titel: 'Bericht senden', kurz: 'Tag 1' },
  { tag: 7, titel: 'Nachfassen', kurz: 'Tag 7' },
  { tag: 90, titel: 'Neu geprüft melden', kurz: '3 Monate' },
] as const;

export interface Schritt { stufe: number; titel: string; kurz: string; faellig: Date; jetzt: boolean; betreff: string; text: string }

/** Der Link zum Bericht: die Check-Seite der Marke mit der Adresse (wie "Teilen" auf der Seite). */
export function berichtLink(l: NachfassLead): string | null {
  const a = l.angaben ?? {};
  const lv = Array.isArray(a.lv95) && a.lv95.length === 2 ? (a.lv95 as number[]) : null;
  const domain = String(a.domain ?? '').replace(/^www\./, '');
  if (!lv || !domain || !l.adresse) return null;
  return `https://www.${domain}/?${new URLSearchParams({ adresse: l.adresse, e: String(lv[0]), n: String(lv[1]) })}`;
}

const anrede = (name: string) => `Guten Tag ${name.trim()}`;

/** Der nächste offene Schritt, oder null, wenn alles erledigt oder der Lead abgeschlossen ist. */
export function naechsterSchritt(l: NachfassLead, heute = new Date()): Schritt | null {
  const stufe = Number(l.nachfass_stufe ?? 0);
  if (l.bearbeitet || stufe >= STUFEN.length) return null;
  const s = STUFEN[stufe];
  const faellig = new Date(new Date(l.erstellt_am).getTime() + s.tag * 864e5);
  const link = berichtLink(l);
  const ort = l.adresse ?? 'Ihre Liegenschaft';
  const texte = [
    { betreff: `Ihre Analyse: ${ort}`, text: `${anrede(l.name)}\n\nVielen Dank für Ihre Anfrage. Hier ist die Berechnung für ${ort}:\n${link ?? ''}\n\nGerne besprechen wir mit Ihnen, was auf dem Grundstück möglich ist. Wann passt Ihnen ein kurzes Telefon?\n\nFreundliche Grüsse` },
    { betreff: `Noch Fragen zu ${ort}?`, text: `${anrede(l.name)}\n\nVor einer Woche haben Sie ${ort} geprüft. Haben Sie die Berechnung erhalten, und sind noch Fragen offen?\n${link ?? ''}\n\nEin Anruf von 15 Minuten genügt meist, um die nächsten Schritte zu klären.\n\nFreundliche Grüsse` },
    { betreff: `${ort}: neu geprüft`, text: `${anrede(l.name)}\n\nWir haben ${ort} mit den aktuellen amtlichen Daten neu geprüft. Den aktuellen Stand sehen Sie hier:\n${link ?? ''}\n\nWenn sich bei Ihnen etwas verändert hat, melden Sie sich gerne.\n\nFreundliche Grüsse` },
  ][stufe];
  return { stufe, titel: s.titel, kurz: s.kurz, faellig, jetzt: faellig.getTime() <= heute.getTime(), ...texte };
}

export function mailLink(email: string, s: Schritt): string {
  return `mailto:${email}?${new URLSearchParams({ subject: s.betreff, body: s.text }).toString().replace(/\+/g, '%20')}`;
}
