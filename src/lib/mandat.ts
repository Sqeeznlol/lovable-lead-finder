import { supabase } from '@/integrations/supabase/client';

/**
 * Der Anrufer-Ablauf je Kunde (Tims Brief, Abschnitt 5, Schritt 5 und
 * 6): Der Akquise-Modus arbeitet die offenen Gelegenheiten eines Kunden
 * ab -- Kandidaten eines Off-Market-Mandats, Nachbarn einer
 * Arrondierung, Auslöser eines Baugesuchs -- mit der Anweisung des
 * Kunden im Kopf. Was der Anrufer herausfindet, fliesst in die
 * Gelegenheit zurück (Zustand, Ergebnis) und damit in den Bericht.
 *
 * Die Parzellen des Kunden selbst (Rolle 'im portfolio') werden nicht
 * angerufen: Das ist sein Eigentum, nicht sein Ziel.
 */
// Die erzeugten Typen kennen die Plattform-Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

export interface MandatKopf { id: string; name: string; produkt: string | null; anweisung: string | null }

export async function mandatLesen(mandantId: string): Promise<MandatKopf | null> {
  const r = await db().from('mandant').select('id, produkt, anweisung, akteur:akteur_id(name)').eq('id', mandantId).maybeSingle();
  if (r.error || !r.data) return null;
  const m = r.data as { id: string; produkt: string | null; anweisung: string | null; akteur: { name: string } | null };
  return { id: m.id, name: m.akteur?.name ?? 'Kunde', produkt: m.produkt, anweisung: m.anweisung };
}

/** Die Parzellen der offenen Gelegenheiten eines Kunden, ganz (alle Spalten). */
export async function mandatParzellen(mandantId: string) {
  const g = await db().from('gelegenheit').select('id, gelegenheit_parzelle(parzelle_id, rolle)')
    .eq('mandant_id', mandantId).in('zustand', ['erkannt', 'geprueft', 'gemeldet', 'in bearbeitung']).limit(2000);
  if (g.error) throw new Error(g.error.message);
  const ids = [...new Set(((g.data ?? []) as { gelegenheit_parzelle: { parzelle_id: string; rolle: string | null }[] }[])
    .flatMap(x => x.gelegenheit_parzelle ?? []).filter(x => x.rolle !== 'im portfolio').map(x => x.parzelle_id))];
  const pakete: string[][] = [];
  for (let i = 0; i < ids.length; i += 150) pakete.push(ids.slice(i, i + 150));
  const r = await Promise.all(pakete.map(pk => supabase.from('properties').select('*').in('id', pk)));
  const f = r.find(x => x.error);
  if (f?.error) throw new Error(f.error.message);
  return r.flatMap(x => x.data ?? []);
}

/**
 * Das Ergebnis des Anrufers in die Gelegenheiten dieser Parzelle beim
 * Kunden: erkannt/geprüft -> in Bearbeitung, und ein Satz im Ergebnis.
 * Fehler werden nicht verschluckt, aber auch nicht zum Abbruch -- der
 * Eigentümer ist schon gespeichert, das zählt.
 */
export async function gelegenheitFortschritt(mandantId: string, parzelleId: string, satz: string): Promise<number> {
  const gp = await db().from('gelegenheit_parzelle').select('gelegenheit_id, gelegenheit!inner(id, zustand, ergebnis, mandant_id)')
    .eq('parzelle_id', parzelleId).eq('gelegenheit.mandant_id', mandantId);
  if (gp.error) return 0;
  const heute = new Date().toLocaleDateString('de-CH');
  let n = 0;
  for (const z of (gp.data ?? []) as { gelegenheit: { id: string; zustand: string; ergebnis: string | null } }[]) {
    const g = z.gelegenheit;
    if (['abgeschlossen', 'verworfen'].includes(g.zustand)) continue;
    const ergebnis = [g.ergebnis, `${heute}: ${satz}`].filter(Boolean).join(' · ');
    const r = await db().from('gelegenheit').update({ ergebnis, ...(g.zustand === 'erkannt' || g.zustand === 'geprueft' ? { zustand: 'in bearbeitung' } : {}) }).eq('id', g.id);
    if (!r.error) n++;
  }
  return n;
}
