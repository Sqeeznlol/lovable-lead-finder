// Baugesuche im Umkreis einer Adresse (Funktion baugesuche_umkreis,
// Migration 20261115150000 im Repository der Webseite). Nur Zählungen.
//
// Julian, 15. November: «die Nachbarn bauen, und ich?» macht neugierig.
// Ehrlich bleiben: Die Daten beginnen je Kanton verschieden; liegt der
// Beginn weniger als ein Jahr zurück, nennt der Satz das Datum. Ist der
// Kanton nicht erfasst (seit = null), zeigt der Check nichts.
import { datenbank } from './datenbank';
import type { Zeile } from './check-modell';

export interface Umkreis {
  meter: number; n365: number; n90: number; seit: string | null;
  neubau: number; umbau: number; aufstockung: number; waermepumpe: number; solar: number; abbruch: number;
}

const datum = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' });
const gesuche = (n: number) => (n === 1 ? 'ein Baugesuch' : `${n.toLocaleString('de-CH')} Baugesuche`);

/** Der Satz über dem Block; null, wenn der Kanton nicht erfasst ist oder nichts gebaut wird. */
export function umkreisSatz(u: Umkreis | null, heute = new Date()): string | null {
  if (!u || !u.seit) return null;
  const tage = (heute.getTime() - new Date(`${u.seit}T12:00:00Z`).getTime()) / 864e5;
  const zeit = tage >= 330 ? 'in den letzten zwölf Monaten' : `seit dem ${datum(u.seit)}`;
  // Ohne Gesuch kein Block: «kein Baugesuch» füllt nur Platz (15. November).
  if (!u.n365) return null;
  return `Im Umkreis von ${u.meter} m ${u.n365 === 1 ? 'wurde' : 'wurden'} ${zeit} ${gesuche(u.n365)} publiziert.`;
}

/** Die Arten, nur wo es welche gibt. Ein Gesuch kann mehrere Arten haben. */
export function umkreisZeilen(u: Umkreis | null): Zeile[] {
  if (!u || !u.seit || !u.n365) return [];
  const quelle = 'Amtsblätter, Kanton Zürich';
  const z: [string, number][] = [['Neubau', u.neubau], ['Umbau, Anbau, Sanierung', u.umbau], ['davon Aufstockung', u.aufstockung],
    ['Wärmepumpe', u.waermepumpe], ['Solaranlage', u.solar], ['Abbruch', u.abbruch]];
  const zeilen: Zeile[] = z.filter(([, n]) => n > 0).map(([titel, n]) => ({ titel, wert: String(n), quelle }));
  // Nur wenn es etwas Neues sagt: sind alle Gesuche aus den letzten drei Monaten, steht die Zahl schon im Satz.
  if (u.n90 && u.n90 < u.n365) zeilen.push({ titel: 'Letzte drei Monate', wert: String(u.n90), quelle });
  return zeilen;
}

/** Die einzige Datenbankfrage der Nachbarschaft: Zählungen im Umkreis von 300 m. */
export async function umkreisLaden(e: number, n: number, kanton: string): Promise<Umkreis | null> {
   
  const r = await (await datenbank()).rpc('baugesuche_umkreis', { p_e: e, p_n: n, p_kanton: kanton, p_meter: 300 });
  return r.error ? null : (r.data as Umkreis | null);
}
