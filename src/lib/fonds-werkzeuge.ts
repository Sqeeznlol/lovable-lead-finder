import { supabase } from '@/integrations/supabase/client';

/**
 * Die Werkzeuge von Wohntraums: Gespräche, Suchprofile, Baugesuche bei
 * den eigenen Liegenschaften und der Stand der Potenziale. Die Grenze
 * (nur die eigene Fondsleitung) zieht die Datenbank
 * (Migration 20261101350000_fonds_werkzeuge.sql).
 */
// Die erzeugten Typen kennen die neuen Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

const pruefen = <T,>(r: { data: T; error: { message: string } | null }): T => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};

/** Welche Fondsleitung gilt: ein Fondsmanager immer die eigene, unsere Konten die gewählte. */
export async function fondsTeam(als: string | null): Promise<string | null> {
  return pruefen(await db().rpc('fonds_team', { p_team: als })) as string | null;
}

// ------------------------------------------------------------ Baugesuche
export interface FondsGesuch {
  id: string; publiziert_am: string; gemeinde: string | null; adresse: string | null; beschreibung: string | null;
  zustand: string; kosten_chf: number | null; liegenschaft: string; liegenschaft_adresse: string | null; fonds: string;
  lage: 'auf' | 'nebenan';
}
export async function baugesucheLaden(als: string | null, tage: number): Promise<FondsGesuch[]> {
  return (pruefen(await db().rpc('fonds_baugesuche', { p_team: als, p_tage: tage })) ?? []) as FondsGesuch[];
}

// ------------------------------------------------------------- Gespräche
export interface Notiz {
  id: string; team_id: string; parzelle_id: string | null; mit: string | null; text: string; am: string;
  wiedervorlage: string | null; erledigt: boolean; von: string | null;
}
export async function notizenLaden(team: string): Promise<Notiz[]> {
  return pruefen(await db().from('fonds_notiz').select('*').eq('team_id', team).order('am', { ascending: false }).limit(500)) as Notiz[];
}
export async function notizSpeichern(n: Omit<Notiz, 'id' | 'erledigt'>) {
  pruefen(await db().from('fonds_notiz').insert(n));
}
export async function notizErledigt(id: string, erledigt: boolean) {
  pruefen(await db().from('fonds_notiz').update({ erledigt }).eq('id', id));
}
export const faellig = (n: Notiz, heute = new Date().toISOString().slice(0, 10)) =>
  !n.erledigt && !!n.wiedervorlage && n.wiedervorlage <= heute;

// ----------------------------------------------------------- Suchprofile
export interface Suchprofil {
  id: string; team_id: string; name: string; lagen: string[]; flaeche_min: number | null; reserve_min: number | null;
  marge_min: number | null; nur_wohnzone: boolean; aktiv: boolean; bemerkung: string | null;
}
export interface Suchtreffer {
  id: string; adresse: string | null; gemeinde: string | null; flaeche: number | null; zone: string | null;
  reserve: number | null; marge: number | null; egrid: string | null; e: number | null; n: number | null;
}
export async function suchprofileLaden(team: string): Promise<Suchprofil[]> {
  return pruefen(await db().from('fonds_suchprofil').select('*').eq('team_id', team).order('erstellt_am', { ascending: false })) as Suchprofil[];
}
export async function suchprofilSpeichern(p: Omit<Suchprofil, 'id' | 'aktiv'>) {
  pruefen(await db().from('fonds_suchprofil').insert(p));
}
export async function suchprofilLoeschen(id: string) {
  pruefen(await db().from('fonds_suchprofil').delete().eq('id', id));
}
export async function suchtrefferLaden(profil: string): Promise<Suchtreffer[]> {
  return (pruefen(await db().rpc('fonds_suchtreffer', { p_profil: profil })) ?? []) as Suchtreffer[];
}
/** "Zürich, Winterthur; Uster" -> ['Zürich', 'Winterthur', 'Uster'] */
export const lagenLesen = (t: string) => t.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);

// ------------------------------------------------- Stand der Potenziale
export type Stand = 'pendent' | 'geprueft' | 'erledigt' | 'verworfen';
export const STAENDE: [Stand, string][] = [['pendent', 'Pendent'], ['geprueft', 'Geprüft'], ['erledigt', 'Erledigt'], ['verworfen', 'Verworfen']];
/** Derselbe Schlüssel, den die Datenbank für ein Potenzial ablegt: Art und Parzelle(n). */
export const potenzialSchluessel = (p: { art: string; parzelle: string; parzelle2: string | null }) =>
  [p.art, p.parzelle, p.parzelle2].filter(Boolean).join(':');
export async function staendeLaden(team: string): Promise<Map<string, Stand>> {
  const d = pruefen(await db().from('fonds_potenzial_stand').select('schluessel, stand').eq('team_id', team)) as { schluessel: string; stand: Stand }[];
  return new Map(d.map(x => [x.schluessel, x.stand]));
}
export async function standSetzen(team: string, schluessel: string, stand: Stand) {
  pruefen(await db().from('fonds_potenzial_stand')
    .upsert({ team_id: team, schluessel, stand, geaendert_am: new Date().toISOString() }, { onConflict: 'team_id,schluessel' }));
}
