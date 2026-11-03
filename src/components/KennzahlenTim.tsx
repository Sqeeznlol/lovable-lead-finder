import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { KNOPF, LISTE, Marke } from '@/components/rahmen';
import { useToast } from '@/hooks/use-toast';

/**
 * Tims Abschnitt 8, als Tabelle mit denselben Zeilen: Bereich,
 * Kennzahl, Ausgangswert, heute, Ziel. "Baselines and target values
 * are defined before implementation starts, so that every development
 * stage can be judged on numbers rather than impressions."
 *
 * Heute wird gezählt, nicht geschätzt (PostgREST mit count, ohne
 * Zeilen). Der Ausgangswert wird einmal festgehalten (Knopf), das Ziel
 * tragen Julian und Tim ein. Was sich nicht messen lässt, steht so da
 * -- die Researchzeit je Lead wird nirgends erfasst.
 */
// Die erzeugten Typen kennen die Plattform-Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

interface Ziel { kennzahl: string; ausgangswert: number | null; ausgangs_am: string | null; ziel: number | null; ziel_bis: string | null; bemerkung: string | null }
interface Stand { gebaeude: string | null; gebaeude_n: number; baugesuch: string | null; baugesuch_n: number; nachbarschaft: string | null; nachbarschaft_n: number; punkte: string | null; punkte_n: number; potenzial_annahmen: string | null }

// Kleine Anteile nicht als "0 %" zeigen: 114 von 532'131 sind 0.02 %.
const z = (n: number | null | undefined, einheit = '') => (n == null ? '–'
  : `${n.toLocaleString('de-CH', { maximumFractionDigits: Math.abs(n) < 1 && n !== 0 ? 2 : Number.isInteger(n) ? 0 : 1 })}${einheit}`);
const datum = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('de-CH') : '–');
const tage = (s: string | null | undefined) => (s ? Math.floor((Date.now() - new Date(s).getTime()) / 86400000) : null);

/** Zählen mit dem Kopf von PostgREST: nur die Zahl, keine Zeilen. */
async function zaehlen(tabelle: string, filter?: (q: any) => any, geschaetzt = false): Promise<number | null> { // eslint-disable-line @typescript-eslint/no-explicit-any
  let q = db().from(tabelle).select('*', { count: geschaetzt ? 'estimated' : 'exact', head: true });
  if (filter) q = filter(q);
  const r = await q;
  return r.error ? null : r.count ?? null;
}

const vor30 = () => new Date(Date.now() - 30 * 86400000).toISOString();

/** Die Kennzahlen in Tims Reihenfolge; `wert` ist der heutige Messwert, `einheit` nur für die Anzeige. */
export interface Kennzahl { id: string; bereich: string; titel: string; wert: number | null; einheit?: string; zeile?: string; messbar?: boolean }

export function useKennzahlenTim() {
  return useQuery({
    queryKey: ['kennzahlen-tim'],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<{ liste: Kennzahl[]; stand: Stand | null }> => {
      const [objekte, mitEigner, mitTelefon, gebaeudeParzellen, kunden, portfolios, zugeordnet, alarme30, alarmeAlle, gelOffen, gelGemeldet, gelAbgeschlossen,
        arrond, nachbarnZeilen, anrufe, erreicht, verkaufsja, profile, treffer, treffer30, mandate, stand] = await Promise.all([
        zaehlen('properties', undefined, true),
        zaehlen('properties', q => q.not('owner_name', 'is', null)),
        zaehlen('properties', q => q.not('owner_phone', 'is', null)),
        zaehlen('parzelle_gebaeude'),
        zaehlen('mandant', q => q.eq('aktiv', true)), zaehlen('portfolio'),
        zaehlen('portfolio_position', q => q.eq('zuordnung', 'zugeordnet')),
        zaehlen('gelegenheit', q => q.eq('anlass', 'baugesuch').gte('erkannt_am', vor30())),
        zaehlen('gelegenheit', q => q.eq('anlass', 'baugesuch')),
        zaehlen('gelegenheit', q => q.in('zustand', ['erkannt', 'geprueft', 'gemeldet', 'in bearbeitung'])),
        zaehlen('gelegenheit', q => q.not('gemeldet_am', 'is', null)),
        zaehlen('gelegenheit', q => q.eq('zustand', 'abgeschlossen')),
        zaehlen('gelegenheit', q => q.eq('anlass', 'arrondierung')),
        zaehlen('gelegenheit_parzelle', q => q.eq('rolle', 'nachbar')),
        zaehlen('anruf'), zaehlen('anruf', q => q.eq('erreicht', true)),
        zaehlen('anruf', q => q.in('verkaufsabsicht', ['ja', 'spaeter', 'nur bei preis'])),
        zaehlen('investorprofil', q => q.eq('aktiv', true)),
        zaehlen('investor_treffer'), zaehlen('investor_treffer', q => q.gte('gefunden_am', vor30())),
        zaehlen('mandant', q => q.eq('produkt', 'acquisition')),
        db().rpc('daten_stand').then((r: { data: Stand | null; error: unknown }) => (r.error ? null : r.data)),
      ]);
      const pct = (a: number | null, b: number | null) => (a != null && b ? Math.round((10000 * a) / b) / 100 : null);
      const liste: Kennzahl[] = [
        { id: 'eigentuemer_pct', bereich: 'Datenqualität', titel: 'Parzellen mit bekanntem Eigentümer', wert: pct(mitEigner, objekte), einheit: ' %', zeile: `${z(mitEigner)} von rund ${z(objekte)}, ${z(mitTelefon)} mit Telefon` },
        { id: 'gebaeude_pct', bereich: 'Datenqualität', titel: 'Parzellen mit Gebäude aus dem Register', wert: pct(gebaeudeParzellen, objekte), einheit: ' %', zeile: `${z(gebaeudeParzellen)} Parzellen mit Gebäude` },
        { id: 'ueberwacht', bereich: 'Portfolioabdeckung', titel: 'Überwachte Parzellen', wert: zugeordnet, zeile: `${z(kunden)} Kunden, ${z(portfolios)} Portfolios` },
        { id: 'alarme_30', bereich: 'Baugesuch-Alarme', titel: 'Gelegenheiten aus Baugesuchen, letzte 30 Tage', wert: alarme30, zeile: `${z(alarmeAlle)} insgesamt` },
        { id: 'arrondierung', bereich: 'Arrondierung', titel: 'Nachbarn als Zukauf-Kandidaten', wert: nachbarnZeilen, zeile: `${z(arrond)} Arrondierungen geprüft` },
        { id: 'gelegenheiten_offen', bereich: 'Akquise', titel: 'Offene Gelegenheiten', wert: gelOffen, zeile: `${z(gelGemeldet)} dem Kunden gemeldet` },
        { id: 'abschluesse', bereich: 'Akquise', titel: 'Abgeschlossene Gelegenheiten', wert: gelAbgeschlossen, zeile: 'Umwandlung: erkannt → abgeschlossen' },
        { id: 'gespraeche', bereich: 'Akquise', titel: 'Gespräche mit Verkaufsabsicht', wert: verkaufsja, zeile: `${z(anrufe)} Gespräche, ${z(erreicht)} erreicht` },
        { id: 'researchzeit', bereich: 'Effizienz', titel: 'Researchzeit je qualifiziertem Lead', wert: null, zeile: 'Nicht messbar: Zeiten werden nirgends erfasst', messbar: false },
        { id: 'investoren', bereich: 'Investoren', titel: 'Aktive Suchprofile', wert: profile, zeile: `${z(mandate)} Off-Market-Mandate` },
        { id: 'treffer_30', bereich: 'Investoren', titel: 'Neue Treffer für Investoren, letzte 30 Tage', wert: treffer30, zeile: `${z(treffer)} gemerkte Treffer insgesamt` },
      ];
      return { liste, stand };
    },
  });
}

export function KennzahlenTim() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useKennzahlenTim();
  const { data: ziele, error: zieleFehler } = useQuery({
    queryKey: ['kennzahl-ziel'],
    queryFn: async (): Promise<Ziel[]> => {
      const r = await db().from('kennzahl_ziel').select('*');
      if (r.error) throw new Error(r.error.message);
      return r.data ?? [];
    },
  });
  const [laeuft, setLaeuft] = useState(false);
  const ziel = (id: string) => ziele?.find(x => x.kennzahl === id);
  const ohneAusgang = (data?.liste ?? []).filter(k => k.messbar !== false && k.wert != null && ziel(k.id)?.ausgangswert == null);

  // Der Ausgangswert wird nur gesetzt, wo noch keiner steht -- der
  // Vergleich hätte sonst keinen festen Boden.
  const festhalten = async () => {
    if (!ohneAusgang.length) return;
    setLaeuft(true);
    const heute = new Date().toISOString().slice(0, 10);
    const r = await db().from('kennzahl_ziel').upsert(ohneAusgang.map(k => ({ kennzahl: k.id, ausgangswert: k.wert, ausgangs_am: heute })), { onConflict: 'kennzahl' });
    setLaeuft(false);
    if (r.error) { toast({ title: 'Nicht festgehalten', description: r.error.message, variant: 'destructive' }); return; }
    toast({ title: `${ohneAusgang.length} Ausgangswerte festgehalten` });
    await qc.invalidateQueries({ queryKey: ['kennzahl-ziel'] });
  };
  const zielSetzen = async (id: string, wert: string) => {
    const n = wert.trim() === '' ? null : Number(wert.replace(/[^\d.,-]/g, '').replace(',', '.'));
    if (n != null && !Number.isFinite(n)) return;
    const r = await db().from('kennzahl_ziel').upsert({ kennzahl: id, ziel: n, geaendert_am: new Date().toISOString() }, { onConflict: 'kennzahl' });
    if (r.error) toast({ title: 'Ziel nicht gespeichert', description: r.error.message, variant: 'destructive' });
    else await qc.invalidateQueries({ queryKey: ['kennzahl-ziel'] });
  };
  const s = data?.stand;
  const quellen: [string, string | null | undefined, number, string][] = s ? [
    ['Gebäuderegister (GWR)', s.gebaeude, 45, `${z(s.gebaeude_n)} Gebäude`],
    ['Baugesuche Kanton Zürich', s.baugesuch, 3, `${z(s.baugesuch_n)} Gesuche, täglich`],
    ['Nachbarschaften vom Bund', s.nachbarschaft, 90, `${z(s.nachbarschaft_n)} Paare`],
    ['Lage der Portfolio-Parzellen', s.punkte, 90, `${z(s.punkte_n)} Punkte`],
    ['Annahmen der Potenzialrechnung', s.potenzial_annahmen, 365, 'Zone, Baukosten, Erlös'],
  ] : [];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl">Kennzahlen nach Tims Abschnitt 8</h2>
          <p className="text-sm text-muted-foreground">Gezählt, nicht geschätzt. Der Ausgangswert wird einmal festgehalten, das Ziel tragt ihr ein.</p>
        </div>
        {!zieleFehler && ohneAusgang.length > 0 && (
          <button type="button" onClick={() => void festhalten()} disabled={laeuft} className={KNOPF}>{laeuft ? 'Hält fest …' : `Ausgangswerte festhalten (${ohneAusgang.length})`}</button>
        )}
      </div>
      {zieleFehler && <p className="text-xs text-muted-foreground">Ausgangswerte und Ziele brauchen die Migration 20261103230000; die heutigen Werte stehen trotzdem.</p>}
      {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> wird gezählt …</p>}
      {data && (
        <div className="overflow-x-auto rounded border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-4 py-2 font-medium">Bereich</th><th className="px-4 py-2 font-medium">Kennzahl</th><th className="px-4 py-2 text-right font-medium">Ausgangswert</th><th className="px-4 py-2 text-right font-medium">Heute</th><th className="px-4 py-2 text-right font-medium">Ziel</th></tr>
            </thead>
            <tbody className="divide-y">
              {data.liste.map(k => {
                const zi = ziel(k.id);
                const besser = zi?.ausgangswert != null && k.wert != null ? k.wert - zi.ausgangswert : null;
                const erreicht = zi?.ziel != null && k.wert != null && k.wert >= zi.ziel;
                return (
                  <tr key={k.id} className="align-top">
                    <td className="px-4 py-2.5 text-muted-foreground">{k.bereich}</td>
                    <td className="px-4 py-2.5"><span className="block">{k.titel}</span>{k.zeile && <span className="block text-xs text-muted-foreground">{k.zeile}</span>}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{zi?.ausgangswert != null ? <>{z(zi.ausgangswert, k.einheit)}<span className="block text-xs text-muted-foreground">{datum(zi.ausgangs_am)}</span></> : <span className="text-muted-foreground">–</span>}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {k.messbar === false ? <span className="text-muted-foreground">nicht messbar</span> : <>{z(k.wert, k.einheit)}
                        {besser != null && besser !== 0 && <span className={`block text-xs ${besser > 0 ? 'text-[#24A15A]' : 'text-[#C4520F]'}`}>{besser > 0 ? '+' : ''}{z(besser, k.einheit)}</span>}</>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {k.messbar === false || zieleFehler ? <span className="text-muted-foreground">–</span> : (
                        <span className="inline-flex items-center gap-1.5">
                          {erreicht && <Marke art="minze">erreicht</Marke>}
                          <input defaultValue={zi?.ziel ?? ''} placeholder="Ziel" aria-label={`Ziel ${k.titel}`} inputMode="decimal"
                                 onBlur={e => e.target.value !== String(zi?.ziel ?? '') && void zielSetzen(k.id, e.target.value)}
                                 className="h-9 w-24 rounded-[3px] border border-input bg-card px-2 text-right text-sm tabular-nums focus:border-foreground focus:outline-none" />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {s && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Stand der Daten je Quelle</h3>
          <ul className={LISTE}>
            {quellen.map(([titel, wann, frist, zeile]) => {
              const t = tage(wann);
              const alt = t != null && t > frist;
              return (
                <li key={titel} className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                  <span><span className="font-medium">{titel}</span><span className="block text-xs text-muted-foreground">{zeile}</span></span>
                  <span className="flex items-center gap-2 tabular-nums">{datum(wann)}{t != null && <span className="text-xs text-muted-foreground">vor {t} Tagen</span>}{alt && <Marke art="heiss">veraltet</Marke>}{!wann && <Marke>noch nie</Marke>}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
