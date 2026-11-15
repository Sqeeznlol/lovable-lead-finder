import { supabase } from '@/integrations/supabase/client';
import { ANLAESSE, ZUSTAENDE } from '@/hooks/use-gelegenheiten';

// Die erzeugten Typen kennen die Plattform-Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

export type Bezug = { art: string; text: string; neben?: string; ziel?: string };

/**
 * Alles, was in Aurora an dieser Parzelle hängt: welcher Kunde sie im
 * Portfolio hat, welche Gelegenheiten sie betreffen, wer über die
 * Check-Seiten nach ihr gefragt hat, welcher Fonds sie hält.
 *
 * Vorher lag das in vier Bereichen, und vom Objekt aus kam man zu
 * keinem davon (Julian, 15. November: "verstehe den Ablauf und
 * verknüpfe"). Mandanten, Portfolios und Gelegenheiten hängen an der
 * Parzellennummer, Leads und Fonds nur an der EGRID -- darum beides.
 */
export async function bezuegeLaden(parzelleId: string, egrid: string | null): Promise<Bezug[]> {
  const [pos, gel, leads, fonds] = await Promise.all([
    db().from('portfolio_position')
      .select('portfolio:portfolio_id(name, mandant:mandant_id(id, akteur:akteur_id(name)))')
      .eq('parzelle_id', parzelleId).limit(20),
    db().from('gelegenheit_parzelle')
      .select('rolle, gelegenheit:gelegenheit_id(id, titel, anlass, zustand)')
      .eq('parzelle_id', parzelleId).limit(20),
    egrid ? db().from('anfrage').select('id, name, erstellt_am').eq('egrid', egrid)
      .order('erstellt_am', { ascending: false }).limit(10) : { data: [] },
    egrid ? db().from('fonds_liegenschaft').select('gefaess').eq('egrid', egrid).limit(5) : { data: [] },
  ]);
  const liste: Bezug[] = [];
  for (const p of pos.data ?? []) {
    const m = p.portfolio?.mandant;
    liste.push({ art: 'Kunde', text: m?.akteur?.name ?? 'Kunde ohne Namen', neben: p.portfolio?.name,
      ziel: m?.id ? `/gelegenheiten?kunde=${m.id}&reiter=alle` : undefined });
  }
  for (const g of gel.data ?? []) {
    const x = g.gelegenheit;
    if (!x) continue;
    liste.push({ art: 'Gelegenheit', text: x.titel || (ANLAESSE[x.anlass] ?? x.anlass),
      neben: ZUSTAENDE.find(z => z[0] === x.zustand)?.[1] ?? x.zustand,
      ziel: `/gelegenheiten?gelegenheit=${x.id}&reiter=alle` });
  }
  for (const l of leads.data ?? []) {
    liste.push({ art: 'Lead', text: l.name || 'Ohne Namen',
      neben: new Date(l.erstellt_am).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }), ziel: `/leads?lead=${l.id}` });
  }
  // Die Fonds-Ansicht zählt mit eigenen Nummern; ein Sprung dorthin
  // fände die Liegenschaft nicht. Darum nur die Angabe.
  for (const f of fonds.data ?? []) liste.push({ art: 'Fonds', text: f.gefaess });
  return liste;
}

