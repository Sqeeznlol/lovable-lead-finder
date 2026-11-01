import { supabase } from '@/integrations/supabase/client';
import { nameNorm } from '@/hooks/use-eigentuemer-suche';
import { zeilenLesen, zuordnen } from '@/lib/portfolio-import';
import { lagenNorm, typenZuKategorien } from '@/lib/investor';
import { parallel } from '@/lib/parallel';

/**
 * Vorhaben: ein Kundenprojekt von der Meldung bis zum Abschluss.
 *
 * "Pensionskasse A hat 1000 Adressen und will in den nächsten sechs
 * Monaten entwickeln" -- daraus wird Research, eine Potenzialanalyse
 * mit den Nachbarn und, mit dem Ja des Kunden, die Akquise in seinem
 * Namen. Die Tabelle steht in 20261101260000_vorhaben.sql.
 */
export type Art = 'entwickeln' | 'kaufen' | 'verkaufen';
export type Zustand = 'eingegangen' | 'research' | 'analyse' | 'freigabe' | 'akquise' | 'abgeschlossen' | 'pausiert';

export const ARTEN: [Art, string][] = [['entwickeln', 'Entwickeln'], ['kaufen', 'Kaufen'], ['verkaufen', 'Verkaufen']];

/** Die Schritte in ihrer Reihenfolge, mit dem, was im Schritt zu tun ist. */
export const SCHRITTE: { z: Zustand; titel: string; tun: string }[] = [
  { z: 'eingegangen', titel: 'Eingegangen', tun: 'Adressen zuordnen' },
  { z: 'research', titel: 'Research', tun: 'Nachbarn und Netzwerk prüfen' },
  { z: 'analyse', titel: 'Analyse geliefert', tun: 'Auf das Ja des Kunden warten' },
  { z: 'freigabe', titel: 'Freigegeben', tun: 'Akquise starten' },
  { z: 'akquise', titel: 'Akquise', tun: 'Eigentümer anfragen' },
  { z: 'abgeschlossen', titel: 'Abgeschlossen', tun: '' },
];

export const titelVon = (z: Zustand) => (z === 'pausiert' ? 'Pausiert' : SCHRITTE.find(s => s.z === z)?.titel ?? z);
export const schrittNr = (z: Zustand) => SCHRITTE.findIndex(s => s.z === z);

export interface Vorhaben {
  id: string; mandant_id: string; art: Art; titel: string; beschreibung: string | null;
  zeitraum_bis: string | null; portfolio_id: string | null; zustand: Zustand;
  vollmacht_am: string | null; vollmacht_von: string | null;
  lagen: string[] | null; objekttypen: string[] | null; zustaendig: string | null;
  erstellt_am: string; geaendert_am: string;
  kunde: string; kunde_art: string; adressen: number; letzter_eintrag: string | null;
}

export interface Analyse {
  adressen: number; zugeordnet: number; offen: number;
  flaeche_m2: number; hnf_reserve: number; mit_reserve: number; marge_chf: number;
  zonen: { zone: string; n: number }[]; gemeinden: { gemeinde: string; n: number }[];
  lage_art: { gemeinde: string | null; kategorie: string | null; n: number }[];
  arrondierungen: number; gepruefte_positionen: number;
  nachbarn: number; nachbarn_mit_eigentuemer: number; nachbarn_ausserhalb: number;
  netzwerk: { address: string | null; gemeinde: string | null; area: number | null; name: string; wieso: string[]; neben: string | null }[];
  top: { address: string | null; gemeinde: string | null; zone: string | null; area: number | null; hnf_delta: number | null; marge_chf: number | null; egrid: string | null; nachbarn: number }[];
}

// Die erzeugten Typen kennen die Plattform-Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

/** "bis März 2027 · noch 5 Monate" -- oder "Frist vorbei". */
export function fristText(bis: string | null, heute = new Date()): string | null {
  if (!bis) return null;
  const d = new Date(bis + 'T00:00:00');
  const monat = d.toLocaleDateString('de-CH', { month: 'long', year: 'numeric' });
  // Kalendertage, nicht Stunden: um 18 Uhr ist morgen noch einen Tag weg.
  const h = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate());
  const tage = Math.round((d.getTime() - h.getTime()) / 864e5);
  if (tage < 0) return `bis ${monat} · Frist vorbei`;
  const rest = tage < 45 ? `noch ${tage} Tage` : `noch ${Math.round(tage / 30.4)} Monate`;
  return `bis ${monat} · ${rest}`;
}

/** Monate ab heute als Datum (yyyy-mm-dd). */
export function inMonaten(n: number, heute = new Date()): string {
  const d = new Date(heute.getFullYear(), heute.getMonth() + n, heute.getDate());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Den Kunden finden oder anlegen. Wiederverwendet wird nach derselben
 * Regel wie akteur_norm, sonst stünde Swisscanto zweimal da; und der
 * bestehende Mandant, damit Gelegenheiten und Berichte beim selben
 * Kunden landen.
 */
async function mandantFuer(name: string, art: string): Promise<string> {
  const vorh = await db().from('akteur').select('id').eq('name_norm', nameNorm(name)).limit(1);
  if (vorh.error) throw vorh.error;
  let akteurId: string | undefined = vorh.data?.[0]?.id;
  if (!akteurId) {
    const a = await db().from('akteur').insert({ name: name.trim(), art }).select('id').single();
    if (a.error) throw a.error;
    akteurId = a.data.id;
  }
  const m = await db().from('mandant').select('id').eq('akteur_id', akteurId).order('seit', { ascending: false }).limit(1);
  if (m.error) throw m.error;
  if (m.data?.[0]?.id) return m.data[0].id as string;
  const neu = await db().from('mandant').insert({ akteur_id: akteurId, produkt: 'acquisition' }).select('id').single();
  if (neu.error) throw neu.error;
  return neu.data.id as string;
}

export interface Neu {
  kunde: string; kundeArt: string; art: Art; titel: string; beschreibung: string;
  monate: number | null; adressen: string; lagen: string; objekttypen: string; von: string | null;
}

const liste = (s: string) => s.split(/[,;\n]/).map(x => x.trim()).filter(Boolean);

/**
 * Vorhaben anlegen. Die Adressen werden sofort als Rohtext gespeichert
 * (zuordnung "offen") und erst danach beim Bund zugeordnet: so geht bei
 * 1000 Adressen nichts verloren, wenn das Fenster zwischendurch zugeht,
 * und das Zuordnen kann dort weitermachen, wo es aufgehört hat.
 */
export async function vorhabenAnlegen(n: Neu): Promise<string> {
  const mandantId = await mandantFuer(n.kunde, n.kundeArt);
  const pf = await db().from('portfolio').insert({ mandant_id: mandantId, name: n.titel.trim() }).select('id').single();
  if (pf.error) throw pf.error;
  const zeilen = zeilenLesen(n.adressen);
  for (let i = 0; i < zeilen.length; i += 500) {
    const r = await db().from('portfolio_position').insert(
      zeilen.slice(i, i + 500).map(z => ({ portfolio_id: pf.data.id, roh_adresse: z.roh, zuordnung: 'offen' })));
    if (r.error) throw r.error;
  }
  const v = await db().from('vorhaben').insert({
    mandant_id: mandantId, art: n.art, titel: n.titel.trim(), beschreibung: n.beschreibung.trim() || null,
    zeitraum_bis: n.monate ? inMonaten(n.monate) : null, portfolio_id: pf.data.id,
    lagen: n.art === 'kaufen' ? lagenNorm(liste(n.lagen)) : null,
    objekttypen: n.art === 'kaufen' ? liste(n.objekttypen) : null,
    zustaendig: n.von,
  }).select('id').single();
  if (v.error) throw v.error;
  await eintragen(v.data.id, `Vorhaben erfasst${zeilen.length ? `, ${zeilen.length} Adressen` : ''}.`, n.von, 'schritt');
  return v.data.id as string;
}

export async function eintragen(vorhabenId: string, text: string, von: string | null, art: 'notiz' | 'schritt' = 'notiz') {
  const r = await db().from('vorhaben_eintrag').insert({ vorhaben_id: vorhabenId, text, von, art });
  if (r.error) throw r.error;
}

/** In einen Zustand wechseln und es im Verlauf festhalten. */
export async function weiter(v: Pick<Vorhaben, 'id'>, zu: Zustand, von: string | null, extra: Record<string, unknown> = {}) {
  const r = await db().from('vorhaben').update({ zustand: zu, geaendert_am: new Date().toISOString(), ...extra }).eq('id', v.id);
  if (r.error) throw r.error;
  await eintragen(v.id, `Schritt: ${titelVon(zu)}.`, von, 'schritt');
}

/** Weitere Adressen zu einem bestehenden Vorhaben. */
export async function adressenHinzu(portfolioId: string, text: string): Promise<number> {
  const zeilen = zeilenLesen(text);
  for (let i = 0; i < zeilen.length; i += 500) {
    const r = await db().from('portfolio_position').insert(
      zeilen.slice(i, i + 500).map(z => ({ portfolio_id: portfolioId, roh_adresse: z.roh, zuordnung: 'offen' })));
    if (r.error) throw r.error;
  }
  return zeilen.length;
}

/**
 * Die offenen Adressen eines Vorhabens beim Bund zuordnen. Fortsetzbar:
 * es nimmt nur, was noch "offen" ist.
 */
export async function offeneZuordnen(portfolioId: string, fortschritt: (f: number, n: number) => void): Promise<{ zugeordnet: number; andere: number }> {
  const r = await db().from('portfolio_position').select('id, roh_adresse')
    .eq('portfolio_id', portfolioId).eq('zuordnung', 'offen').limit(5000);
  if (r.error) throw r.error;
  const offen = (r.data ?? []) as { id: string; roh_adresse: string | null }[];
  let f = 0; const erg = { zugeordnet: 0, andere: 0 };
  fortschritt(0, offen.length);
  await parallel(offen, 4, async p => {
    const roh = p.roh_adresse ?? '';
    const e = await zuordnen(zeilenLesen(roh)[0] ?? { roh, egrid: null });
    // "offen" bleibt offen (Dienst nicht erreichbar): beim nächsten Lauf neu.
    if (e.zuordnung !== 'offen') {
      await db().from('portfolio_position').update({ parzelle_id: e.parzelleId, zuordnung: e.zuordnung }).eq('id', p.id);
      if (e.zuordnung === 'zugeordnet') erg.zugeordnet++; else erg.andere++;
    }
    fortschritt(++f, offen.length);
  });
  return erg;
}

/** Die Parzellen eines Vorhabens mit EGRID, für die Arrondierung. */
export async function positionenMitEgrid(portfolioId: string): Promise<{ parzelleId: string; egrid: string; adresse: string | null }[]> {
  const r = await db().from('portfolio_position').select('parzelle_id, properties!inner(egrid, address)')
    .eq('portfolio_id', portfolioId).not('parzelle_id', 'is', null).limit(5000);
  if (r.error) throw r.error;
  return ((r.data ?? []) as { parzelle_id: string; properties: { egrid: string | null; address: string | null } }[])
    .filter(x => x.properties?.egrid)
    .map(x => ({ parzelleId: x.parzelle_id, egrid: x.properties.egrid!, adresse: x.properties.address }));
}

export interface Investor { id: string; name: string; lagen: string[] | null; objekttypen: string[] | null; budget_max_chf: number | null }

/**
 * Wer als Käufer in Frage kommt: Investoren, deren Suchprofil Objekte
 * des Vorhabens trifft, nach Anzahl Treffer. Gemessen wird an Gemeinde
 * und Objektart -- dem, was der Bestand führt; den Preis führt er nicht.
 * Ein Profil ohne Lage oder ohne Objektart schränkt dort nicht ein.
 */
export function kaeuferAbgleich(investoren: Investor[], lageArt: Analyse['lage_art']): { investor: Investor; treffer: number }[] {
  return investoren.map(inv => {
    const lagen = new Set(lagenNorm(inv.lagen));
    const kat = new Set(typenZuKategorien(inv.objekttypen));
    if (!lagen.size && !kat.size) return { investor: inv, treffer: 0 };
    const treffer = lageArt
      .filter(x => (!lagen.size || lagen.has(x.gemeinde ?? '')) && (!kat.size || kat.has(x.kategorie ?? '')))
      .reduce((s, x) => s + Number(x.n), 0);
    return { investor: inv, treffer };
  }).filter(x => x.treffer > 0).sort((a, b) => b.treffer - a.treffer);
}
