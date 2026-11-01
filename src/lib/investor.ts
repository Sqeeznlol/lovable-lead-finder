import { supabase } from '@/integrations/supabase/client';

/**
 * Passende Objekte zu einem Suchprofil -- Tims "match relevant
 * properties with investor demand".
 *
 * Abgeglichen wird, was der Bestand führt: Gemeinde und Objektart
 * (kategorie; gemessen am 1. November die gefüllte Spalte). Einen Preis
 * führt der Bestand nicht; das Budget lässt sich deshalb nicht
 * abgleichen, und das steht beim Ergebnis dabei, statt still zu fehlen.
 */
const TYPEN: [RegExp, string][] = [
  [/mfh|mehrfam|renditeliegenschaft|wohnhaus mit/i, 'Mehrfamilienhaus'],
  [/efh|einfam/i, 'Einfamilienhaus'],
  [/gewerbe|b(ü|ue)ro|industrie|lager/i, 'Gebäude ohne Wohnnutzung'],
  [/gemischt|wohn.*gesch(ä|ae)ft|teilweise/i, 'Gebäude mit teilweiser Wohnnutzung'],
  [/nebennutzung/i, 'Wohngebäude mit Nebennutzung'],
];

/** Freitext aus dem Gespräch ("MFH, Bauland") in Werte von kategorie. Unbekanntes fällt weg. */
export function typenZuKategorien(typen: string[] | null | undefined): string[] {
  const aus = new Set<string>();
  for (const t of typen ?? []) for (const [m, k] of TYPEN) if (m.test(t)) aus.add(k);
  return [...aus];
}

/** "zürich", " Kloten " -> wie die Gemeinde im Bestand geschrieben ist (erster Buchstabe gross). */
export function lagenNorm(lagen: string[] | null | undefined): string[] {
  return [...new Set((lagen ?? []).map(l => l.trim()).filter(Boolean)
    .map(l => l.charAt(0).toUpperCase() + l.slice(1)))];
}

export interface Treffer { id: string; address: string | null; gemeinde: string | null; kategorie: string | null; area: number | null; marge_chf: number | null }

export async function passendeObjekte(p: { lagen: string[] | null; objekttypen: string[] | null }): Promise<{ objekte: Treffer[]; hinweis: string | null }> {
  const lagen = lagenNorm(p.lagen);
  const kat = typenZuKategorien(p.objekttypen);
  if (!lagen.length && !kat.length) return { objekte: [], hinweis: 'Das Profil nennt weder Lage noch eine erkennbare Objektart.' };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (supabase as any).from('properties').select('id, address, gemeinde, kategorie, area, marge_chf')
    .eq('ausgeschlossen', false);
  if (lagen.length) q = q.in('gemeinde', lagen);
  if (kat.length) q = q.in('kategorie', kat);
  const r = await q.order('marge_chf', { ascending: false, nullsFirst: false }).limit(20);
  if (r.error) throw r.error;
  const offen = (p.objekttypen ?? []).filter(t => !typenZuKategorien([t]).length);
  const hinweise = [
    'Budget nicht abgeglichen: der Bestand führt keinen Preis.',
    offen.length ? `Nicht abgleichbar: ${offen.join(', ')}.` : null,
  ];
  return { objekte: r.data ?? [], hinweis: hinweise.filter(Boolean).join(' ') };
}
