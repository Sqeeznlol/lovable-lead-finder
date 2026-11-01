import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { KATEGORIEN, kategorie, type Absicht, type Kategorie } from '@/lib/gespraech';
import { passendeObjekte } from '@/lib/investor';

/**
 * Auswertung: was aus den Gesprächen folgt, wer kaufen will, und ob
 * die Plattform etwas bringt.
 *
 * - Reaktivierung (Tims Abschnitt 7): je Objekt das letzte Gespräch,
 *   nach Kategorie, mit dem nächsten Schritt. Fällige Wiedervorlagen
 *   zuerst.
 * - Investoren (Abschnitt 6): jedes Suchprofil mit den passenden
 *   Objekten aus dem Bestand.
 * - Kennzahlen (Abschnitt 8): gezählt, nicht geschätzt.
 */
// Die erzeugten Typen kennen die Plattform-Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;
const datum = (s: string | null) => (s ? new Date(s).toLocaleDateString('de-CH') : '–');
const heute = () => new Date().toISOString().slice(0, 10);

interface AnrufZeile {
  id: string; parzelle_id: string | null; gefuehrt_am: string; erreicht: boolean | null;
  verkaufsabsicht: Absicht | null; ablehnungsgrund: string | null; kauft_selbst: boolean;
  wiedervorlage_am: string | null; preisvorstellung_chf: number | null;
  parzelle: { address: string | null; gemeinde: string | null; owner_name: string | null } | null;
}

function Reaktivierung() {
  const [filter, setFilter] = useState<Kategorie | 'alle' | 'faellig'>('faellig');
  const { data, isLoading, error } = useQuery({
    queryKey: ['reaktivierung'],
    queryFn: async (): Promise<AnrufZeile[]> => {
      const r = await db().from('anruf')
        .select('id, parzelle_id, gefuehrt_am, erreicht, verkaufsabsicht, ablehnungsgrund, kauft_selbst, wiedervorlage_am, preisvorstellung_chf, parzelle:parzelle_id(address, gemeinde, owner_name)')
        .order('gefuehrt_am', { ascending: false }).limit(2000);
      if (r.error) throw r.error;
      // Je Objekt zählt das letzte Gespräch -- ein älteres "nein" ist
      // durch ein neueres "später" überholt.
      const letzte = new Map<string, AnrufZeile>();
      for (const a of (r.data ?? []) as AnrufZeile[]) {
        const k = a.parzelle_id ?? a.id;
        if (!letzte.has(k)) letzte.set(k, a);
      }
      return [...letzte.values()];
    },
  });

  const mitKat = useMemo(() => (data ?? []).map(a => ({ a, k: kategorie(a) })), [data]);
  const faellig = (a: AnrufZeile) => !!a.wiedervorlage_am && a.wiedervorlage_am <= heute();
  const liste = mitKat
    .filter(({ a, k }) => filter === 'alle' || (filter === 'faellig' ? faellig(a) : k === filter))
    .sort((x, y) => (x.a.wiedervorlage_am ?? '9999').localeCompare(y.a.wiedervorlage_am ?? '9999'));
  const zahl = (k: Kategorie) => mitKat.filter(x => x.k === k).length;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium" style={{ fontFamily: 'inherit' }}>Reaktivierung</h2>
      <p className="text-sm text-muted-foreground">Je Objekt das letzte Gespräch. Wer nicht verkauft, ist nicht verloren -- jede Gruppe hat ihren nächsten Schritt.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setFilter('faellig')}
                className={`h-9 rounded-full border px-3 text-sm ${filter === 'faellig' ? 'border-slate-900 bg-slate-900 text-white' : ''}`}>
          Wiedervorlage fällig · {mitKat.filter(x => faellig(x.a)).length}
        </button>
        {(Object.keys(KATEGORIEN) as Kategorie[]).map(k => (
          <button key={k} type="button" onClick={() => setFilter(k)}
                  className={`h-9 rounded-full border px-3 text-sm ${filter === k ? 'border-slate-900 bg-slate-900 text-white' : ''}`}>
            {KATEGORIEN[k].titel} · {zahl(k)}
          </button>
        ))}
        <button type="button" onClick={() => setFilter('alle')}
                className={`h-9 rounded-full border px-3 text-sm ${filter === 'alle' ? 'border-slate-900 bg-slate-900 text-white' : ''}`}>Alle</button>
      </div>
      {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> wird geladen …</p>}
      {error && <p className="text-sm text-destructive">Gespräche nicht lesbar.</p>}
      {data && liste.length === 0 && <p className="text-sm text-muted-foreground">Nichts in dieser Gruppe.</p>}
      {liste.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {liste.map(({ a, k }) => (
            <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
              <span className="min-w-0">
                <span className="block font-medium">{a.parzelle?.address ?? 'Objekt'}{a.parzelle?.gemeinde ? ` · ${a.parzelle.gemeinde}` : ''}</span>
                <span className="block text-xs text-muted-foreground">
                  {[a.parzelle?.owner_name, KATEGORIEN[k].titel, `Gespräch ${datum(a.gefuehrt_am)}`].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="text-right text-xs">
                <span className="block font-medium">{KATEGORIEN[k].schritt}</span>
                {a.wiedervorlage_am && (
                  <span className={`block ${faellig(a) ? 'font-medium text-red-600' : 'text-muted-foreground'}`}>wieder am {datum(a.wiedervorlage_am)}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface Profil {
  id: string; lagen: string[] | null; objekttypen: string[] | null; budget_min_chf: number | null; budget_max_chf: number | null;
  rendite_min_pct: number | null; horizont: string | null; kriterien: string | null; erfasst_am: string;
  akteur: { name: string } | null;
}

function Investoren() {
  const [offen, setOffen] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ['investorprofile'],
    queryFn: async (): Promise<Profil[]> => {
      const r = await db().from('investorprofil').select('*, akteur:akteur_id(name)').eq('aktiv', true).order('erfasst_am', { ascending: false });
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });
  const profil = data?.find(p => p.id === offen) ?? null;
  const { data: treffer, isLoading: sucht } = useQuery({
    queryKey: ['investor-treffer', offen],
    enabled: !!profil,
    queryFn: () => passendeObjekte(profil!),
  });
  const chf = (n: number | null) => (n ? `${(n / 1e6).toLocaleString('de-CH', { maximumFractionDigits: 1 })} Mio.` : null);

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium" style={{ fontFamily: 'inherit' }}>Investoren</h2>
      <p className="text-sm text-muted-foreground">Suchprofile aus den Gesprächen, mit den passenden Objekten aus dem Bestand.</p>
      {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> wird geladen …</p>}
      {error && <p className="text-sm text-destructive">Suchprofile nicht lesbar.</p>}
      {data && data.length === 0 && <p className="text-sm text-muted-foreground">Noch kein Suchprofil. Es entsteht im Gespräch: "Kauft selbst".</p>}
      <ul className="space-y-2">
        {data?.map(p => (
          <li key={p.id} className="rounded-xl border">
            <button type="button" onClick={() => setOffen(offen === p.id ? null : p.id)} className="w-full p-4 text-left">
              <span className="block font-medium">{p.akteur?.name ?? 'Unbekannt'}</span>
              <span className="block text-sm text-muted-foreground">
                {[p.lagen?.join(', '), p.objekttypen?.join(', '),
                  p.budget_min_chf || p.budget_max_chf ? `${chf(p.budget_min_chf) ?? '…'} bis ${chf(p.budget_max_chf) ?? '…'}` : null,
                  p.rendite_min_pct ? `ab ${p.rendite_min_pct} %` : null, p.horizont].filter(Boolean).join(' · ') || 'ohne Angaben'}
              </span>
            </button>
            {offen === p.id && (
              <div className="border-t p-4 text-sm">
                {sucht && <p className="text-muted-foreground">Suche passende Objekte …</p>}
                {treffer && treffer.objekte.length === 0 && <p className="text-muted-foreground">{treffer.hinweis ?? 'Kein passendes Objekt im Bestand.'}</p>}
                {treffer && treffer.objekte.length > 0 && (
                  <>
                    <p className="mb-2 text-xs text-muted-foreground">{treffer.hinweis}</p>
                    <ul className="divide-y rounded-lg border">
                      {treffer.objekte.map(o => (
                        <li key={o.id} className="flex justify-between gap-3 px-3 py-2">
                          <span className="min-w-0 truncate">{o.address ?? 'Objekt'} · {o.gemeinde}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{[o.kategorie, o.area ? `${Math.round(o.area).toLocaleString('de-CH')} m²` : null].filter(Boolean).join(' · ')}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Zählen mit dem Kopf von PostgREST: nur die Zahl, keine Zeilen. */
async function zaehlen(tabelle: string, filter?: (q: any) => any, geschaetzt = false): Promise<number | null> { // eslint-disable-line @typescript-eslint/no-explicit-any
  let q = db().from(tabelle).select('*', { count: geschaetzt ? 'estimated' : 'exact', head: true });
  if (filter) q = filter(q);
  const r = await q;
  return r.error ? null : r.count ?? null;
}

function Kennzahlen() {
  const { data, isLoading } = useQuery({
    queryKey: ['kennzahlen'],
    queryFn: async () => {
      const [objekte, mitEigner, portfolios, positionen, zugeordnet, gel, gemeldet, abgeschlossen, anrufe, erreicht, profile] = await Promise.all([
        zaehlen('properties', undefined, true),
        // owner_name hat einen Index nur über die gefüllten Zeilen
        // (20261101180000): so ist die Zählung schnell.
        zaehlen('properties', q => q.not('owner_name', 'is', null)),
        zaehlen('portfolio'), zaehlen('portfolio_position'),
        zaehlen('portfolio_position', q => q.eq('zuordnung', 'zugeordnet')),
        zaehlen('gelegenheit'), zaehlen('gelegenheit', q => q.not('gemeldet_am', 'is', null)),
        zaehlen('gelegenheit', q => q.eq('zustand', 'abgeschlossen')),
        zaehlen('anruf'), zaehlen('anruf', q => q.eq('erreicht', true)),
        zaehlen('investorprofil', q => q.eq('aktiv', true)),
      ]);
      return { objekte, mitEigner, portfolios, positionen, zugeordnet, gel, gemeldet, abgeschlossen, anrufe, erreicht, profile };
    },
    staleTime: 60 * 1000,
  });
  const z = (n: number | null | undefined) => (n == null ? '–' : n.toLocaleString('de-CH'));
  const pct = (a: number | null | undefined, b: number | null | undefined) =>
    a != null && b ? `${((a / b) * 100).toLocaleString('de-CH', { maximumFractionDigits: a / b < 0.01 ? 2 : 0 })} %` : '–';
  const kacheln: [string, string, string][] = data ? [
    ['Eigentümer bekannt', pct(data.mitEigner, data.objekte), `${z(data.mitEigner)} von rund ${z(data.objekte)} Objekten`],
    ['Überwachte Parzellen', z(data.zugeordnet), `${z(data.portfolios)} Portfolios, ${z(data.positionen)} Positionen`],
    ['Gelegenheiten', z(data.gel), `${z(data.gemeldet)} gemeldet, ${z(data.abgeschlossen)} abgeschlossen`],
    ['Gespräche', z(data.anrufe), `${z(data.erreicht)} erreicht (${pct(data.erreicht, data.anrufe)})`],
    ['Aktive Suchprofile', z(data.profile), 'Investoren aus Gesprächen'],
  ] : [];
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium" style={{ fontFamily: 'inherit' }}>Kennzahlen</h2>
      {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> wird gezählt …</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kacheln.map(([t, w, s]) => (
          <div key={t} className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">{t}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{w}</p>
            <p className="text-xs text-muted-foreground">{s}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Auswertung() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 md:p-6">
      <div>
        <h1 className="text-2xl">Auswertung</h1>
        <p className="text-sm text-muted-foreground">Reaktivierung, Investoren und Kennzahlen -- aus den erfassten Gesprächen und Gelegenheiten.</p>
      </div>
      <Kennzahlen />
      <Reaktivierung />
      <Investoren />
    </div>
  );
}
