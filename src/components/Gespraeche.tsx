import { useState } from 'react';
import { Auswahl } from '@/components/Auswahl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { nameNorm } from '@/hooks/use-eigentuemer-suche';
import {
  ABSICHTEN, GRUENDE, KATEGORIEN, betragLesen, kategorie, type Absicht,
} from '@/lib/gespraech';

/**
 * Gespräche zu einem Objekt: erfassen und nachlesen.
 *
 * Jedes Gespräch wird eine Zeile in `anruf` mit Feldern, nicht eine
 * Notiz (docs/plattform.md). Wer im Gespräch hört, dass der Eigentümer
 * selbst kauft, erfasst gleich sein Suchprofil -- es hängt am Eigentümer
 * als Akteur, damit es bei jedem seiner Objekte und in der
 * Investorensuche wieder auftaucht.
 */
interface Anruf {
  id: string; gefuehrt_am: string; gefuehrt_von: string | null; erreicht: boolean | null;
  verkaufsabsicht: Absicht | null; preisvorstellung_chf: number | null; ablehnungsgrund: string | null;
  kauft_selbst: boolean; weitere_objekte: string | null; wiedervorlage_am: string | null; notiz: string | null;
}

// Die erzeugten Typen kennen die Plattform-Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

const chf = (n: number) => `${Math.round(n).toLocaleString('de-CH')} CHF`;
const datum = (s: string) => new Date(s).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Den Eigentümer als Akteur finden -- oder aus dem Namen im Objekt anlegen und verknüpfen. */
async function akteurFuer(parzelleId: string, ownerName: string | null): Promise<string | null> {
  const e = await db().from('eigentum').select('akteur_id').eq('parzelle_id', parzelleId).limit(1);
  if (e.data?.[0]?.akteur_id) return e.data[0].akteur_id;
  if (!ownerName?.trim()) return null;
  // Gibt es den Namen schon als Akteur, wird er verknüpft statt doppelt angelegt.
  const vorh = await db().from('akteur').select('id').eq('name_norm', nameNorm(ownerName)).limit(1);
  if (vorh.data?.[0]?.id) {
    await db().from('eigentum').insert({ parzelle_id: parzelleId, akteur_id: vorh.data[0].id, quelle: 'manuell' });
    return vorh.data[0].id;
  }
  const a = await db().from('akteur').insert({ name: ownerName.trim(), art: 'person' }).select('id').single();
  if (a.error) throw a.error;
  // Quelle "manuell": der Name kommt aus dem Objekt, geprüft ist er nicht.
  await db().from('eigentum').insert({ parzelle_id: parzelleId, akteur_id: a.data.id, quelle: 'manuell' });
  return a.data.id;
}

export function Gespraeche({ parzelleId, ownerName }: { parzelleId: string; ownerName: string | null }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [auf, setAuf] = useState(false);
  const leer = {
    erreicht: true as boolean | null, verkaufsabsicht: '' as Absicht | '', preis: '', grund: '',
    kauftSelbst: false, weitere: '', wiedervorlage: '', notiz: '',
    lagen: '', typen: '', budgetMin: '', budgetMax: '', rendite: '', horizont: '', kriterien: '',
  };
  const [f, setF] = useState(leer);
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const set = (k: keyof typeof leer) => (e: { target: { value: string } }) => setF(v => ({ ...v, [k]: e.target.value }));

  const { data, isLoading, error } = useQuery({
    queryKey: ['anrufe', parzelleId],
    queryFn: async (): Promise<Anruf[]> => {
      const r = await db().from('anruf').select('*').eq('parzelle_id', parzelleId).order('gefuehrt_am', { ascending: false });
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });

  const vorschau = kategorie({
    erreicht: f.erreicht, verkaufsabsicht: (f.verkaufsabsicht || null) as Absicht | null,
    ablehnungsgrund: f.grund || null, kauft_selbst: f.kauftSelbst,
  });

  const speichern = async () => {
    setSpeichert(true); setFehler(null);
    try {
      const akteurId = f.kauftSelbst || ownerName ? await akteurFuer(parzelleId, ownerName).catch(() => null) : null;
      const r = await db().from('anruf').insert({
        parzelle_id: parzelleId, akteur_id: akteurId,
        gefuehrt_von: (user?.email ?? '').split('@')[0] || null,
        erreicht: f.erreicht, verkaufsabsicht: f.erreicht ? f.verkaufsabsicht || null : null,
        preisvorstellung_chf: betragLesen(f.preis), ablehnungsgrund: f.grund || null,
        kauft_selbst: f.kauftSelbst, weitere_objekte: f.weitere.trim() || null,
        wiedervorlage_am: f.wiedervorlage || null, notiz: f.notiz.trim() || null,
      });
      if (r.error) throw r.error;
      // Abschnitt 7: "lieber mit Makler" und "will verkaufen" werden eine
      // Gelegenheit mit eigenem Anlass, nicht nur eine Kategorie in der
      // Liste. Je Parzelle und Anlass eine offene; scheitert es (Migration
      // 20261103270000 fehlt), bleibt das Gespräch trotzdem gespeichert.
      if (f.erreicht && (f.grund === 'makler' || f.verkaufsabsicht === 'ja')) {
        const anlass = f.verkaufsabsicht === 'ja' ? 'verkauf' : 'vermittlung';
        const grund = [f.verkaufsabsicht === 'ja' ? 'Will verkaufen' : 'Möchte lieber mit einem Makler', f.preis ? `Preisvorstellung ${f.preis}` : null, f.notiz.trim() || null]
          .filter(Boolean).join(' · ') + ` (Gespräch ${new Date().toLocaleDateString('de-CH')})`;
        const g = await db().rpc('gelegenheit_aus_gespraech', { p_parzelle: parzelleId, p_anlass: anlass, p_begruendung: grund });
        if (!g.error) await qc.invalidateQueries({ queryKey: ['gelegenheiten'] });
      }
      if (f.kauftSelbst) {
        if (!akteurId) throw new Error('Ohne Eigentümernamen lässt sich kein Suchprofil anlegen.');
        const liste = (s: string) => s.split(/[,;]/).map(x => x.trim()).filter(Boolean);
        const p = await db().from('investorprofil').insert({
          akteur_id: akteurId, lagen: liste(f.lagen), objekttypen: liste(f.typen),
          budget_min_chf: betragLesen(f.budgetMin), budget_max_chf: betragLesen(f.budgetMax),
          rendite_min_pct: f.rendite ? Number(f.rendite.replace(',', '.')) || null : null,
          horizont: f.horizont.trim() || null, kriterien: f.kriterien.trim() || null,
          erfasst_von: (user?.email ?? '').split('@')[0] || null,
        });
        if (p.error) throw p.error;
      }
      setF(leer); setAuf(false);
      await qc.invalidateQueries({ queryKey: ['anrufe', parzelleId] });
      await qc.invalidateQueries({ queryKey: ['reaktivierung'] });
    } catch (e) {
      setFehler(e instanceof Error && e.message.startsWith('Ohne') ? e.message : 'Nicht gespeichert.');
    } finally { setSpeichert(false); }
  };

  const feld = 'h-11 w-full rounded-lg border bg-white px-3 text-base text-slate-900';
  const marke = 'text-xs font-medium text-muted-foreground';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Gespräche</h3>
        </div>
        {!auf && (
          <button type="button" onClick={() => setAuf(true)}
                  className="h-9 rounded-lg border px-3 text-sm font-medium hover:bg-muted/50">Gespräch erfassen</button>
        )}
      </div>

      {auf && (
        <form className="space-y-3 rounded-xl border p-4" onSubmit={e => { e.preventDefault(); void speichern(); }}>
          <div className="flex gap-2">
            {([[true, 'Erreicht'], [false, 'Nicht erreicht']] as [boolean, string][]).map(([w, t]) => (
              <button key={t} type="button" onClick={() => setF(v => ({ ...v, erreicht: w }))}
                      className={`h-10 flex-1 rounded-lg border text-sm font-medium ${f.erreicht === w ? 'border-slate-900 bg-slate-900 text-white' : ''}`}>
                {t}
              </button>
            ))}
          </div>
          {f.erreicht && (
            <>
              <label className="block space-y-1"><span className={marke}>Verkaufsabsicht</span>
                <Auswahl label="Verkaufsabsicht" wert={f.verkaufsabsicht} setWert={w => set('verkaufsabsicht')({ target: { value: w } })} className="w-full"
                         optionen={[{ wert: '', titel: '–' }, ...ABSICHTEN.map(([w, t]) => ({ wert: w, titel: t }))]} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1"><span className={marke}>Preisvorstellung</span>
                  <input className={feld} inputMode="decimal" value={f.preis} onChange={set('preis')} placeholder="z. B. 2,4 Mio." />
                </label>
                <label className="block space-y-1"><span className={marke}>Grund, falls nicht</span>
                  <Auswahl label="Grund, falls nicht" wert={f.grund} setWert={w => set('grund')({ target: { value: w } })} className="w-full"
                           optionen={GRUENDE.map(([w, t]) => ({ wert: w, titel: t }))} />
                </label>
              </div>
              <label className="block space-y-1"><span className={marke}>Weitere Objekte des Eigentümers</span>
                <input className={feld} value={f.weitere} onChange={set('weitere')} placeholder="z. B. MFH in Kloten, Bauland Bülach" />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-5 w-5" checked={f.kauftSelbst}
                       onChange={e => setF(v => ({ ...v, kauftSelbst: e.target.checked }))} />
                Kauft selbst Liegenschaften -- Suchprofil erfassen
              </label>
              {f.kauftSelbst && (
                <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                  <label className="block space-y-1"><span className={marke}>Lagen</span>
                    <input className={feld} value={f.lagen} onChange={set('lagen')} placeholder="z. B. Zürich, Kloten, Winterthur" /></label>
                  <label className="block space-y-1"><span className={marke}>Objekttypen</span>
                    <input className={feld} value={f.typen} onChange={set('typen')} placeholder="z. B. Mehrfamilienhaus, Bauland" /></label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block space-y-1"><span className={marke}>Budget ab</span>
                      <input className={feld} inputMode="decimal" value={f.budgetMin} onChange={set('budgetMin')} placeholder="2 Mio." /></label>
                    <label className="block space-y-1"><span className={marke}>Budget bis</span>
                      <input className={feld} inputMode="decimal" value={f.budgetMax} onChange={set('budgetMax')} placeholder="8 Mio." /></label>
                    <label className="block space-y-1"><span className={marke}>Rendite ab %</span>
                      <input className={feld} inputMode="decimal" value={f.rendite} onChange={set('rendite')} placeholder="3,5" /></label>
                    <label className="block space-y-1"><span className={marke}>Zeitrahmen</span>
                      <input className={feld} value={f.horizont} onChange={set('horizont')} placeholder="12 Monate" /></label>
                  </div>
                  <label className="block space-y-1"><span className={marke}>Weitere Kriterien</span>
                    <input className={feld} value={f.kriterien} onChange={set('kriterien')} /></label>
                </div>
              )}
            </>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1"><span className={marke}>Wiedervorlage</span>
              <input type="date" className={feld} value={f.wiedervorlage} onChange={set('wiedervorlage')} /></label>
          </div>
          <label className="block space-y-1"><span className={marke}>Notiz</span>
            <textarea rows={2} className="w-full rounded-lg border bg-white px-3 py-2 text-base text-slate-900" value={f.notiz} onChange={set('notiz')} />
          </label>
          <p className="text-sm"><span className="font-medium">{KATEGORIEN[vorschau].titel}</span>
            <span className="text-muted-foreground"> · {KATEGORIEN[vorschau].schritt}</span></p>
          {fehler && <p className="text-sm text-destructive">{fehler}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className="h-11 px-3 text-sm text-muted-foreground" onClick={() => { setAuf(false); setF(leer); }}>Abbrechen</button>
            <button type="submit" disabled={speichert}
                    className="h-11 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-50">
              {speichert ? 'Speichert …' : 'Gespräch speichern'}
            </button>
          </div>
        </form>
      )}

      {isLoading && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Gespräche …</p>}
      {error && <p className="text-sm text-muted-foreground">Gespräche sieht nur, wer angemeldet ist.</p>}
      {data && data.length === 0 && !auf && <p className="text-sm text-muted-foreground">Noch kein Gespräch erfasst.</p>}
      {data && data.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {data.map(a => {
            const k = kategorie(a);
            return (
              <li key={a.id} className="space-y-0.5 px-3 py-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{KATEGORIEN[k].titel}</span>
                  <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{datum(a.gefuehrt_am)}{a.gefuehrt_von ? ` · ${a.gefuehrt_von}` : ''}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {[a.erreicht === false ? 'nicht erreicht' : ABSICHTEN.find(x => x[0] === a.verkaufsabsicht)?.[1],
                    a.preisvorstellung_chf ? `Preis ${chf(a.preisvorstellung_chf)}` : null,
                    a.ablehnungsgrund ? GRUENDE.find(x => x[0] === a.ablehnungsgrund)?.[1] : null,
                    a.wiedervorlage_am ? `wieder am ${datum(a.wiedervorlage_am)}` : null,
                  ].filter(Boolean).join(' · ')}
                </p>
                {a.weitere_objekte && <p className="text-xs">Weitere Objekte: {a.weitere_objekte}</p>}
                {a.notiz && <p className="text-xs">{a.notiz}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
