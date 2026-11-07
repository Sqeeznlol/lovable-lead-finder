import { supabase } from '@/integrations/supabase/client';
import type { Portfolio, Position } from '@/hooks/use-portfolio';

/**
 * Eigentümer suchen und alle seine Parzellen holen -- "Swisscanto
 * eingeben, alle Swisscanto-Liegenschaften auf der Karte sehen".
 *
 * Zwei Quellen, weil beide nötig sind: Die Tabelle `akteur` ist das
 * neue, verdichtete Modell, steht aber erst für 182 Eigentümer
 * (gemessen am 1. November, "Auswerten -> plattform"). Die meisten
 * Eigentümer stehen noch als Text in `properties.owner_name`. Wer nur
 * die eine Quelle fragt, findet einen Teil und hält ihn für alles.
 */
export interface EigentuemerTreffer {
  name: string;
  akteurId: string | null;
  art: string | null;
}

/** Dieselbe Regel wie `akteur_norm` in der Datenbank: Umlaute aufgelöst, alles andere weg. */
export function nameNorm(s: string): string {
  return s.toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[éè]/g, 'e').replace(/à/g, 'a')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Akteure und Textnamen zu einer Liste ohne Doppel. Der Akteur gewinnt,
 * weil an ihm Eigentum mit Quelle und Prüfstatus hängt; ein Textname,
 * der denselben Schlüssel ergibt, ist derselbe Eigentümer.
 */
export function zusammenfuehren(
  akteure: { id: string; name: string; art: string | null }[],
  textnamen: string[],
  hoechstens = 6,
): EigentuemerTreffer[] {
  const gesehen = new Set<string>();
  const aus: EigentuemerTreffer[] = [];
  for (const a of akteure) {
    const k = nameNorm(a.name);
    if (!k || gesehen.has(k)) continue;
    gesehen.add(k);
    aus.push({ name: a.name, akteurId: a.id, art: a.art });
  }
  for (const n of textnamen) {
    const name = n.trim();
    const k = nameNorm(name);
    if (!k || gesehen.has(k)) continue;
    gesehen.add(k);
    aus.push({ name, akteurId: null, art: null });
  }
  return aus.slice(0, hoechstens);
}

// Die erzeugten Typen kennen die Plattform-Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

/** PostgREST-Muster: Komma und Klammern würden den or-Filter zerlegen. */
const muster = (s: string) => `%${s.replace(/[%_,()*]/g, ' ').trim()}%`;

export async function eigentuemerSuchen(s: string): Promise<EigentuemerTreffer[]> {
  const m = muster(s);
  const [ak, tx] = await Promise.all([
    db().from('akteur').select('id, name, art').ilike('name', m).limit(6),
    db().from('properties').select('owner_name').ilike('owner_name', m).limit(60),
  ]);
  // Ohne Anmeldung ist `akteur` gesperrt; dann bleibt der Textname.
  const akteure = (ak.error ? [] : ak.data ?? []) as { id: string; name: string; art: string | null }[];
  const namen = ((tx.error ? [] : tx.data ?? []) as { owner_name: string | null }[])
    .map(r => r.owner_name ?? '').filter(Boolean);
  return zusammenfuehren(akteure, namen);
}

type Zeile = { id: string; address: string | null; egrid: string | null;
               plot_number: string | null; area: number | null; zone: string | null };

/** Alle Parzellen eines Eigentümers, als Gruppe in derselben Form wie ein Portfolio. */
export async function eigentuemerParzellen(t: EigentuemerTreffer): Promise<Portfolio> {
  const spalten = 'id, address, egrid, plot_number, area, zone';
  const ids = new Set<string>();
  if (t.akteurId) {
    const { data } = await db().from('eigentum').select('parzelle_id').eq('akteur_id', t.akteurId);
    for (const r of (data ?? []) as { parzelle_id: string }[]) ids.add(r.parzelle_id);
  }
  // Der Textname genau, nicht als Teilstück: "Meier" soll nicht alle
  // Meiers der Schweiz auf die Karte holen, sondern diesen Eigentümer.
  const genau = t.name.replace(/[%_]/g, ' ');
  const [perText, perId] = await Promise.all([
    db().from('properties').select(spalten).ilike('owner_name', genau).limit(500),
    ids.size ? db().from('properties').select(spalten).in('id', [...ids]) : Promise.resolve({ data: [] }),
  ]);
  const alle = new Map<string, Zeile>();
  for (const z of [...(perId.data ?? []), ...(perText.data ?? [])] as Zeile[]) alle.set(z.id, z);
  const positionen: Position[] = [...alle.values()].map(z => ({
    id: z.id, parzelleId: z.id, adresse: z.address, egrid: z.egrid,
    parzelle: z.plot_number, flaeche: z.area, zone: z.zone,
  }));
  return { id: `eigentuemer:${nameNorm(t.name)}`, name: t.name, eigner: t.name, manager: [], positionen };
}
