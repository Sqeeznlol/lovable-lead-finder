import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePortfolios } from '@/hooks/use-portfolio';
import { arrondierungErkennen } from '@/lib/arrondierung';

/**
 * Gelegenheiten: was erkannt wurde, wer daran arbeitet, was daraus
 * wurde -- und der Bericht an den Kunden.
 *
 * Tims Text, Abschnitt 3 und 5: "Track which opportunities were
 * identified, communicated and converted" und "Results are tracked and
 * reported to the institutional client". Eine Gelegenheit hat dafür
 * einen Zustand (erkannt bis abgeschlossen), eine Zuständigkeit und ein
 * Ergebnis; der Bericht zählt sie je Kunde.
 */
type Zustand = 'erkannt' | 'geprueft' | 'gemeldet' | 'in bearbeitung' | 'abgeschlossen' | 'verworfen';
const ZUSTAENDE: [Zustand, string][] = [
  ['erkannt', 'Erkannt'], ['geprueft', 'Geprüft'], ['gemeldet', 'Dem Kunden gemeldet'],
  ['in bearbeitung', 'In Bearbeitung'], ['abgeschlossen', 'Abgeschlossen'], ['verworfen', 'Verworfen'],
];
const ANLAESSE: Record<string, string> = {
  baugesuch: 'Baugesuch', arrondierung: 'Arrondierung', ausnuetzungsreserve: 'Ausnützungsreserve',
  zonenaenderung: 'Zonenänderung', investorentreffer: 'Investorentreffer', manuell: 'Manuell',
};

interface Parz { id: string; address: string | null; owner_name: string | null; area: number | null; gemeinde: string | null; egrid: string | null }
interface Gel {
  id: string; anlass: string; zustand: Zustand; titel: string; begruendung: string | null; zustaendig: string | null;
  erkannt_am: string; gemeldet_am: string | null; abgeschlossen_am: string | null; ergebnis: string | null;
  prioritaet: number | null; fremde_nachbarn: { egrid: string; nummer: string }[] | null;
  mandant: { id: string; akteur: { name: string } | null } | null;
  gelegenheit_parzelle: { rolle: string | null; parzelle: Parz | null }[];
}

// Die erzeugten Typen kennen die Plattform-Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;
const datum = (s: string | null) => (s ? new Date(s).toLocaleDateString('de-CH') : '–');
const m2 = (n: number | null) => (n ? `${Math.round(n).toLocaleString('de-CH')} m²` : null);

export function useGelegenheiten() {
  return useQuery({
    queryKey: ['gelegenheiten'],
    queryFn: async (): Promise<Gel[]> => {
      const r = await db().from('gelegenheit')
        .select('*, mandant:mandant_id(id, akteur:akteur_id(name)), '
          + 'gelegenheit_parzelle(rolle, parzelle:parzelle_id(id, address, owner_name, area, gemeinde, egrid))')
        .order('prioritaet', { ascending: false, nullsFirst: false })
        .order('erkannt_am', { ascending: false })
        .limit(500);
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });
}

export function Gelegenheiten() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useGelegenheiten();
  const { data: portfolios } = usePortfolios(true);
  const [zustand, setZustand] = useState<Zustand | 'offen' | 'alle'>('offen');
  const [mandant, setMandant] = useState('');
  const [offen, setOffen] = useState<string | null>(null);
  const [lauf, setLauf] = useState<Record<string, string>>({});
  const [bericht, setBericht] = useState<string | null>(null);

  const mandanten = useMemo(() => {
    const m = new Map<string, string>();
    (data ?? []).forEach(g => g.mandant && m.set(g.mandant.id, g.mandant.akteur?.name ?? 'Ohne Namen'));
    return [...m.entries()];
  }, [data]);

  const liste = (data ?? []).filter(g =>
    (zustand === 'alle' || (zustand === 'offen' ? !['abgeschlossen', 'verworfen'].includes(g.zustand) : g.zustand === zustand))
    && (!mandant || g.mandant?.id === mandant));

  const aendern = async (g: Gel, felder: Partial<Gel>) => {
    const jetzt = new Date().toISOString();
    const z = felder.zustand;
    const r = await db().from('gelegenheit').update({
      ...felder,
      ...(z === 'gemeldet' && !g.gemeldet_am ? { gemeldet_am: jetzt } : {}),
      ...(z === 'abgeschlossen' || z === 'verworfen' ? { abgeschlossen_am: g.abgeschlossen_am ?? jetzt } : {}),
    }).eq('id', g.id);
    if (!r.error) await qc.invalidateQueries({ queryKey: ['gelegenheiten'] });
    return !r.error;
  };

  const pruefen = async (pfId: string) => {
    const pf = portfolios?.find(p => p.id === pfId);
    if (!pf) return;
    const pos = pf.positionen.filter(p => p.parzelleId && p.egrid)
      .map(p => ({ parzelleId: p.parzelleId!, egrid: p.egrid!, adresse: p.adresse }));
    setLauf(l => ({ ...l, [pfId]: `0 von ${pos.length} …` }));
    try {
      const e = await arrondierungErkennen(pfId, pos, (f, n) => setLauf(l => ({ ...l, [pfId]: `${f} von ${n} …` })));
      setLauf(l => ({ ...l, [pfId]: `${e.neu} neu, ${e.schon} schon erfasst`
        + (e.ohneNachbarn ? `, ${e.ohneNachbarn} ohne Nachbarn` : '') + (e.fehler ? `, ${e.fehler} Fehler` : '') }));
      await qc.invalidateQueries({ queryKey: ['gelegenheiten'] });
    } catch {
      setLauf(l => ({ ...l, [pfId]: 'Nicht möglich -- angemeldet?' }));
    }
  };

  if (bericht) return <Bericht mandantId={bericht} gelegenheiten={data ?? []} onZurueck={() => setBericht(null)} />;

  const zahl = (z: Zustand) => (data ?? []).filter(g => g.zustand === z && (!mandant || g.mandant?.id === mandant)).length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl">Gelegenheiten</h1>
        <p className="text-sm text-muted-foreground">Was das System erkannt hat, wer daran arbeitet und was daraus wurde.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['erkannt', 'gemeldet', 'in bearbeitung', 'abgeschlossen'] as Zustand[]).map(z => (
          <div key={z} className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">{ZUSTAENDE.find(x => x[0] === z)![1]}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{data ? zahl(z) : '–'}</p>
          </div>
        ))}
      </div>

      <section className="space-y-2 rounded-xl border p-4">
        <h2 className="text-base font-medium" style={{ fontFamily: 'inherit' }}>Arrondierung je Portfolio</h2>
        <p className="text-sm text-muted-foreground">Zu jeder Parzelle die Nachbarn beim Bund holen, mit dem Bestand verbinden und als Gelegenheit ablegen. Darf beliebig oft laufen; Doppeltes wird nicht angelegt.</p>
        {!portfolios?.length && <p className="text-sm text-muted-foreground">Kein Portfolio erfasst.</p>}
        <ul className="divide-y">
          {portfolios?.map(pf => (
            <li key={pf.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-sm"><span className="font-medium">{pf.name}</span>
                <span className="text-muted-foreground"> · {pf.positionen.filter(p => p.parzelleId).length} Parzellen</span></span>
              <span className="flex items-center gap-3">
                {lauf[pf.id] && <span className="text-xs text-muted-foreground">{lauf[pf.id]}</span>}
                <button type="button" onClick={() => void pruefen(pf.id)} disabled={!!lauf[pf.id]?.endsWith('…')}
                        className="h-10 rounded-lg border px-3 text-sm font-medium hover:bg-muted/50 disabled:opacity-50">
                  Nachbarn prüfen
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {([['offen', 'Offen'], ...ZUSTAENDE, ['alle', 'Alle']] as [string, string][]).map(([w, t]) => (
            <button key={w} type="button" onClick={() => setZustand(w as typeof zustand)}
                    className={`h-9 rounded-full border px-3 text-sm ${zustand === w ? 'border-slate-900 bg-slate-900 text-white' : ''}`}>{t}</button>
          ))}
          <select value={mandant} onChange={e => setMandant(e.target.value)} className="h-9 rounded-full border bg-white px-3 text-sm">
            <option value="">Alle Kunden</option>
            {mandanten.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
          {mandant && (
            <button type="button" onClick={() => setBericht(mandant)}
                    className="flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium">
              <Printer className="h-4 w-4" /> Kundenbericht
            </button>
          )}
        </div>

        {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> wird geladen …</p>}
        {error && <p className="text-sm text-destructive">Gelegenheiten nicht lesbar.</p>}
        {data && liste.length === 0 && <p className="text-sm text-muted-foreground">Keine Gelegenheit in dieser Auswahl.</p>}

        <ul className="space-y-2">
          {liste.map(g => {
            const auf = offen === g.id;
            const ausl = g.gelegenheit_parzelle.filter(x => x.rolle === 'ausloeser').map(x => x.parzelle).filter(Boolean) as Parz[];
            const nachb = g.gelegenheit_parzelle.filter(x => x.rolle === 'nachbar').map(x => x.parzelle).filter(Boolean) as Parz[];
            return (
              <li key={g.id} className="rounded-xl border">
                <button type="button" onClick={() => setOffen(auf ? null : g.id)} aria-expanded={auf}
                        className="flex w-full items-start justify-between gap-3 p-4 text-left">
                  <span className="min-w-0">
                    <span className="block font-medium">{g.titel}</span>
                    <span className="block text-sm text-muted-foreground">
                      {[ANLAESSE[g.anlass] ?? g.anlass, g.mandant?.akteur?.name, g.begruendung].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-muted-foreground">
                    <span className="block font-medium text-foreground">{ZUSTAENDE.find(x => x[0] === g.zustand)?.[1]}</span>
                    {g.prioritaet != null && <span className="block tabular-nums">Priorität {g.prioritaet}</span>}
                  </span>
                </button>
                {auf && (
                  <div className="space-y-3 border-t p-4">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="block space-y-1 text-xs font-medium text-muted-foreground">Zustand
                        <select value={g.zustand} onChange={e => void aendern(g, { zustand: e.target.value as Zustand })}
                                className="h-11 w-full rounded-lg border bg-white px-3 text-base text-slate-900">
                          {ZUSTAENDE.map(([w, t]) => <option key={w} value={w}>{t}</option>)}
                        </select>
                      </label>
                      <label className="block space-y-1 text-xs font-medium text-muted-foreground">Zuständig
                        <input defaultValue={g.zustaendig ?? ''} placeholder="Name"
                               onBlur={e => e.target.value !== (g.zustaendig ?? '') && void aendern(g, { zustaendig: e.target.value || null })}
                               className="h-11 w-full rounded-lg border bg-white px-3 text-base text-slate-900" />
                      </label>
                    </div>
                    <label className="block space-y-1 text-xs font-medium text-muted-foreground">Ergebnis
                      <input defaultValue={g.ergebnis ?? ''} placeholder="z. B. Nachbar verkauft an Kunden, Vorvertrag"
                             onBlur={e => e.target.value !== (g.ergebnis ?? '') && void aendern(g, { ergebnis: e.target.value || null })}
                             className="h-11 w-full rounded-lg border bg-white px-3 text-base text-slate-900" />
                    </label>
                    <p className="text-xs text-muted-foreground">Erkannt {datum(g.erkannt_am)} · gemeldet {datum(g.gemeldet_am)} · abgeschlossen {datum(g.abgeschlossen_am)}</p>
                    {ausl.length > 0 && (
                      <div className="text-sm"><p className="text-xs font-medium text-muted-foreground">Parzelle des Kunden</p>
                        {ausl.map(p => <p key={p.id}>{p.address ?? p.egrid}{p.gemeinde ? ` · ${p.gemeinde}` : ''}</p>)}</div>
                    )}
                    {nachb.length > 0 && (
                      <div className="text-sm"><p className="text-xs font-medium text-muted-foreground">Nachbarn im Bestand</p>
                        <ul className="divide-y rounded-lg border">
                          {nachb.map(p => (
                            <li key={p.id} className="flex justify-between gap-3 px-3 py-2">
                              <span className="min-w-0 truncate">{p.address ?? p.egrid}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {[p.owner_name ?? 'Eigentümer offen', m2(p.area)].filter(Boolean).join(' · ')}
                              </span>
                            </li>
                          ))}
                        </ul></div>
                    )}
                    {!!g.fremde_nachbarn?.length && (
                      <p className="text-xs text-muted-foreground">
                        Ausserhalb des Bestands: {g.fremde_nachbarn.map(n => n.nummer || n.egrid).join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/**
 * Der Bericht an einen Kunden: was erkannt, gemeldet, bearbeitet und
 * erreicht wurde. Zum Drucken oder als PDF speichern -- der Browser
 * kann beides, und ein Bericht ist etwas, das man weitergibt.
 */
function Bericht({ mandantId, gelegenheiten, onZurueck }: { mandantId: string; gelegenheiten: Gel[]; onZurueck: () => void }) {
  const eigene = gelegenheiten.filter(g => g.mandant?.id === mandantId);
  const name = eigene[0]?.mandant?.akteur?.name ?? 'Kunde';
  const zahl = (z: Zustand) => eigene.filter(g => g.zustand === z).length;
  return (
    <div className="mx-auto max-w-3xl space-y-6 bg-white p-6 text-slate-900 print:p-0">
      <div className="flex items-center justify-between gap-2 print:hidden">
        <button type="button" onClick={onZurueck} className="h-10 rounded-lg border px-3 text-sm">Zurück</button>
        <button type="button" onClick={() => window.print()} className="flex h-10 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white">
          <Printer className="h-4 w-4" /> Drucken / PDF
        </button>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Bericht · {new Date().toLocaleDateString('de-CH')}</p>
        <h1 className="text-2xl">{name}</h1>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([['erkannt', 'Erkannt'], ['gemeldet', 'Gemeldet'], ['in bearbeitung', 'In Bearbeitung'], ['abgeschlossen', 'Abgeschlossen']] as [Zustand, string][]).map(([z, t]) => (
          <div key={z} className="rounded-lg border p-3"><p className="text-xs text-slate-500">{t}</p><p className="text-2xl font-semibold tabular-nums">{zahl(z)}</p></div>
        ))}
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-slate-500"><tr><th className="pb-2 pr-3 font-medium">Gelegenheit</th><th className="pb-2 pr-3 font-medium">Stand</th><th className="pb-2 font-medium">Ergebnis</th></tr></thead>
        <tbody className="divide-y">
          {eigene.map(g => (
            <tr key={g.id} className="align-top">
              <td className="py-2 pr-3"><span className="font-medium">{g.titel}</span><br /><span className="text-xs text-slate-500">{g.begruendung}</span></td>
              <td className="py-2 pr-3 whitespace-nowrap">{ZUSTAENDE.find(x => x[0] === g.zustand)?.[1]}</td>
              <td className="py-2">{g.ergebnis ?? '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
