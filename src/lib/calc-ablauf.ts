/**
 * CALC YOU LATER, der Ablauf: der Weg einer Kalkulation vom Einreichen
 * über Prüfung und Freigabe bis zum gesendeten Angebot, und wo sie liegt
 * (Tabelle kalkulation, Migration 20261116140000).
 *
 * Eigene Datei, getrennt von der Rechnung (calc.ts) und vom Datenholen
 * (calc-daten.ts): das Cockpit zeigt, was wartet, und soll dafür nicht
 * die ganze Rechnung ins erste Bündel ziehen.
 */
import { supabase } from '@/integrations/supabase/client';
import type { Bewertung, CalcEingabe } from '@/lib/calc';
import type { Adresse } from '@/lib/calc-daten';

// Die erzeugten Typen kennen Tabelle und Funktion noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

/**
 * Der Weg einer Kalkulation. Die Übergänge erzwingt die Datenbank
 * (kalkulation_schritt); hier stehen nur die Namen für die Seite.
 */
export type Zustand = 'entwurf' | 'pruefung' | 'freigabe' | 'angebot' | 'gesendet' | 'abgelehnt';
export type Schritt = 'einreichen' | 'pruefen' | 'freigeben' | 'zurueck' | 'ablehnen' | 'angebot' | 'senden' | 'oeffnen';

export const ZUSTAND_TEXT: Record<Zustand, string> = {
  entwurf: 'Entwurf', pruefung: 'Kaufpreis prüfen', freigabe: 'Freigabe', angebot: 'Angebot schreiben', gesendet: 'Gesendet', abgelehnt: 'Abgelehnt',
};
export const SCHRITT_TEXT: Record<Schritt, string> = {
  einreichen: 'eingereicht', pruefen: 'Kaufpreis geprüft', freigeben: 'freigegeben', zurueck: 'zurück zur Prüfung',
  ablehnen: 'abgelehnt', angebot: 'Angebot gespeichert', senden: 'Angebot gesendet', oeffnen: 'wieder geöffnet',
};
/** Vom Einreichen bis zum Versand: ein Tag. Dieselbe Zahl steht in der Datenbank. */
export const FRIST_STUNDEN = 24;

export interface Uhr { anteil: number; text: string; ueberfaellig: boolean; laeuft: boolean }

const dauer = (ms: number) => {
  const min = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h} Std. ${m} Min.` : `${h} Std.`) : `${m} Min.`;
};

/** Wie viel vom Tag verbraucht ist. Null, solange nichts eingereicht ist. */
export function uhr(k: { zustand: Zustand; eingereicht_am: string | null; frist_am: string | null; gesendet_am: string | null }, jetzt = Date.now()): Uhr | null {
  if (!k.eingereicht_am || !k.frist_am || k.zustand === 'entwurf' || k.zustand === 'abgelehnt') return null;
  const start = Date.parse(k.eingereicht_am), ende = Date.parse(k.frist_am);
  if (!Number.isFinite(start) || !Number.isFinite(ende) || ende <= start) return null;
  const fertig = k.zustand === 'gesendet' && !!k.gesendet_am;
  const bis = fertig ? Date.parse(k.gesendet_am!) : jetzt;
  const rest = ende - bis;
  return {
    anteil: Math.max(0, (bis - start) / (ende - start)),
    text: fertig ? `gesendet nach ${dauer(bis - start)}` : rest >= 0 ? `noch ${dauer(rest)}` : `seit ${dauer(-rest)} überfällig`,
    ueberfaellig: rest < 0, laeuft: !fertig,
  };
}

/** CHF 2'350'000 -- ausgeschrieben, wie es in einem Angebot steht. */
export const betrag = (n: number) => `CHF ${Math.round(n).toLocaleString('de-CH')}`;

/**
 * Der Entwurf des Angebots. Ein Mensch formuliert es fertig; der Entwurf
 * sorgt dafür, dass Adresse, Betrag und Frist stimmen.
 */
export function angebotEntwurf(k: { kontakt?: string | null; adresse: string; ort?: string | null; preis: number; absender?: string | null }, heute = new Date()): string {
  const bis = new Date(heute.getTime() + 14 * 864e5).toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' });
  const wo = [k.adresse.trim(), k.ort?.trim()].filter(Boolean).join(' in ');
  return [
    `Guten Tag${k.kontakt?.trim() ? ` ${k.kontakt.trim()}` : ''}`,
    `Vielen Dank für das Gespräch und Ihre Angaben zur Liegenschaft an der ${wo}.`,
    `Wir haben die Liegenschaft geprüft und bieten Ihnen dafür ${betrag(k.preis)}.`,
    `Das Angebot gilt bis am ${bis}. Es setzt voraus, dass Grundbuchauszug, Mietverträge und der Zustand des Gebäudes unseren Annahmen entsprechen.`,
    'Gerne erläutere ich Ihnen das Angebot am Telefon oder bei Ihnen vor Ort.',
    `Freundliche Grüsse\n${k.absender?.trim() || ''}`.trim(),
  ].join('\n\n');
}

// ------------------------------------------------------------- Ablage

export interface VerlaufEintrag { schritt: Schritt; name: string; am: string; notiz?: string; chf?: number }

/** Was gespeichert wird, damit ein Entwurf ohne neue Abfragen wieder aufgeht. */
export interface Eingaben {
  eingabe: CalcEingabe;
  adresse: Adresse;
  parzelleNr: string | null;
  eigentuemer: string | null;
  luecken: string[];
  /** Wer die Kalkulation angelegt hat. */
  name: string | null;
}

export interface Kalkulation {
  id: string; erstellt_am: string; geaendert_am: string;
  adresse: string; plz: string | null; gemeinde: string | null; kanton: string | null;
  egrid: string | null; parzelle_id: string | null; anfrage_id: string | null; kontakt: string | null; test: boolean;
  eingaben: Eingaben; ergebnis: Bewertung;
  empfehlung_chf: number | null; zustand: Zustand; preis_chf: number | null;
  eingereicht_am: string | null; frist_am: string | null; gesendet_am: string | null;
  angebot_text: string | null; verlauf: VerlaufEintrag[];
}

export type KalkulationKurz = Pick<Kalkulation, 'id' | 'erstellt_am' | 'adresse' | 'plz' | 'gemeinde' | 'kontakt' | 'test' | 'empfehlung_chf' | 'zustand' | 'preis_chf' | 'eingereicht_am' | 'frist_am' | 'gesendet_am' | 'verlauf'>;

const KURZ = 'id, erstellt_am, adresse, plz, gemeinde, kontakt, test, empfehlung_chf, zustand, preis_chf, eingereicht_am, frist_am, gesendet_am, verlauf';

/** Die jüngsten Kalkulationen. Die Tabelle ist klein: eine Zeile je Lead. */
export async function kalkulationenLaden(): Promise<KalkulationKurz[]> {
  const r = await db().from('kalkulation').select(KURZ).order('erstellt_am', { ascending: false }).limit(200);
  if (r.error) throw r.error;
  return r.data ?? [];
}

export async function kalkulationLaden(id: string): Promise<Kalkulation | null> {
  const r = await db().from('kalkulation').select('*').eq('id', id).maybeSingle();
  if (r.error) throw r.error;
  return r.data ?? null;
}

export type Entwurf = Pick<Kalkulation, 'adresse' | 'plz' | 'gemeinde' | 'kanton' | 'egrid' | 'parzelle_id' | 'anfrage_id' | 'kontakt' | 'test' | 'eingaben' | 'ergebnis' | 'empfehlung_chf'>;

/** Einen Entwurf anlegen oder ändern. Was eingereicht ist, lässt die Datenbank nicht mehr ändern. */
export async function entwurfSpeichern(e: Entwurf, id?: string | null): Promise<Kalkulation> {
  const r = id
    ? await db().from('kalkulation').update({ ...e, geaendert_am: new Date().toISOString() }).eq('id', id).select('*').maybeSingle()
    : await db().from('kalkulation').insert(e).select('*').maybeSingle();
  if (r.error) throw r.error;
  if (!r.data) throw new Error('Diese Kalkulation ist schon eingereicht und lässt sich nicht mehr ändern.');
  return r.data;
}

export async function entwurfLoeschen(id: string): Promise<void> {
  const r = await db().from('kalkulation').delete().eq('id', id);
  if (r.error) throw r.error;
}

/** Ein Schritt im Ablauf. Reihenfolge und Uhr erzwingt die Datenbank (kalkulation_schritt). */
export async function schritt(id: string, was: Schritt, name: string, mehr: { chf?: number | null; notiz?: string | null; text?: string | null } = {}): Promise<Kalkulation> {
  const r = await db().rpc('kalkulation_schritt', { p_id: id, p_schritt: was, p_name: name, p_chf: mehr.chf ?? null, p_notiz: mehr.notiz ?? null, p_text: mehr.text ?? null });
  if (r.error) throw new Error(r.error.message || 'Der Schritt liess sich nicht ausführen.');
  return r.data;
}
