import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { heizGruppe, kodesLaden } from '@/lib/karte3d';

/**
 * Die Gebäude einer Parzelle aus dem Register (Ansicht parzelle_gebaeude,
 * Migration 20261103140000). Hauptgebäude ist das mit der grössten
 * Grundfläche; sein Baujahr und seine Heizung beschreiben die Parzelle.
 */
export interface ParzelleGebaeude {
  egrid: string; gebaeude: number; wohnungen: number | null; geschosse_max: number | null;
  baujahr_aeltestes: number | null; baujahr_juengstes: number | null; energieflaeche: number | null;
  haupt_baujahr: number | null; haupt_heizung: number | null; haupt_heizung_energie: number | null;
  haupt_heizung_seit: string | null; fossil: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

/** In Paketen zu 150: eine Seite der Liste, ohne zu lange Adressen. */
export async function parzellenGebaeude(egrids: string[]): Promise<Map<string, ParzelleGebaeude>> {
  const eindeutig = [...new Set(egrids.filter(Boolean))];
  const aus = new Map<string, ParzelleGebaeude>();
  const pakete: string[][] = [];
  for (let i = 0; i < eindeutig.length; i += 150) pakete.push(eindeutig.slice(i, i + 150));
  const antworten = await Promise.all(pakete.map(p => db().from('parzelle_gebaeude').select('*').in('egrid', p)));
  for (const a of antworten) {
    if (a.error) throw new Error(a.error.message);
    for (const z of (a.data ?? []) as ParzelleGebaeude[]) aus.set(z.egrid, z);
  }
  return aus;
}

export function useParzellenGebaeude(egrids: (string | null | undefined)[]) {
  const liste = [...new Set(egrids.filter((e): e is string => !!e))].sort();
  return useQuery({
    queryKey: ['parzelle-gebaeude', liste],
    enabled: liste.length > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: () => parzellenGebaeude(liste),
  });
}

/** Die amtlichen Texte der Codes, einmal am Tag. */
export function useGwrKodes() {
  return useQuery({ queryKey: ['gwr-kodes'], queryFn: kodesLaden, staleTime: 24 * 3600 * 1000 });
}

/** "Heizöl, Heizkessel (generisch) für ein Gebäude, seit 2001" -- so viel, wie das Register weiss. */
export function heizungBeschreiben(p: ParzelleGebaeude | undefined, kodes: Map<string, string> | undefined): string | null {
  if (!p || p.haupt_heizung_energie == null) return null;
  const energie = kodes?.get(`GENH:${p.haupt_heizung_energie}`);
  const erzeuger = p.haupt_heizung != null ? kodes?.get(`GWAERZH:${p.haupt_heizung}`) : undefined;
  if (!energie) return `Code ${p.haupt_heizung_energie}`;
  return [energie, erzeuger, p.haupt_heizung_seit ? `seit ${p.haupt_heizung_seit.slice(0, 4)}` : null].filter(Boolean).join(', ');
}

/** Kurz für Listen: die Gruppe (Heizöl, Gas, Wärmepumpe …). */
export function heizungKurz(p: ParzelleGebaeude | undefined, kodes: Map<string, string> | undefined): string | null {
  if (!p || p.haupt_heizung_energie == null) return null;
  return heizGruppe(kodes?.get(`GENH:${p.haupt_heizung_energie}`))?.titel ?? null;
}
