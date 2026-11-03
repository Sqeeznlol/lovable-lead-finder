import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, RefreshCw, Target } from 'lucide-react';
import { ObjektLink } from '@/components/ObjektLink';
import { Auswahl } from '@/components/Auswahl';
import { FELD, KNOPF, KNOPF_HAUPT, LISTE, Marke } from '@/components/rahmen';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUrlWert } from '@/hooks/use-url-wert';
import { passendeObjekte, type Treffer } from '@/lib/investor';

/**
 * Investoren: Suchprofile mit den passenden Objekten aus dem Bestand,
 * und daraus das Off-Market-Mandat (Tims Brief, 11C).
 *
 * Der Abgleich läuft in der Datenbank (investor_abgleich, täglich mit
 * den Baugesuchen und auf Knopfdruck) und merkt sich je Profil, was
 * wann gefunden wurde -- "neu" heisst: seit dem letzten Öffnen
 * dazugekommen. "Als Mandat anlegen" macht den Investor zum Kunden
 * (Acquisition) und jeden Kandidaten zu einer Gelegenheit, die das
 * Akquise-Team wie jede andere abarbeitet.
 *
 * Solange die Migration 20261103220000 nicht eingespielt ist, rechnet
 * der Browser den Abgleich wie bisher selbst (src/lib/investor.ts).
 */
// Die erzeugten Typen kennen die Plattform-Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

interface Profil {
  id: string; lagen: string[] | null; objekttypen: string[] | null; budget_min_chf: number | null; budget_max_chf: number | null;
  rendite_min_pct: number | null; horizont: string | null; kriterien: string | null; erfasst_am: string;
  akteur: { name: string } | null;
}
interface TrefferZeile { profil_id: string; parzelle_id: string; gefunden_am: string; gesehen_am: string | null; parzelle: Treffer | null }

const chf = (n: number | null) => (n ? `${(n / 1e6).toLocaleString('de-CH', { maximumFractionDigits: 1 })} Mio.` : null);
const m2 = (n: number | null) => (n ? `${Math.round(n).toLocaleString('de-CH')} m²` : null);
const liste = (s: string) => s.split(/[,;]/).map(x => x.trim()).filter(Boolean);
const betrag = (s: string) => { const n = Number(s.replace(/[^\d.]/g, '')); return s && Number.isFinite(n) && n > 0 ? (n < 1000 ? n * 1e6 : n) : null; };

export function Investoren() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [offen, setOffen] = useUrlWert('investor');
  const [neu, setNeu] = useUrlWert('investor_neu');
  const { data, isLoading, error } = useQuery({
    queryKey: ['investorprofile'],
    queryFn: async (): Promise<Profil[]> => {
      const r = await db().from('investorprofil').select('*, akteur:akteur_id(name)').eq('aktiv', true).order('erfasst_am', { ascending: false });
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });
  // Die gemerkten Treffer aller Profile auf einmal (höchstens 100 je
  // Profil); fehlt die Tabelle, bleibt es beim Abgleich im Browser.
  const { data: treffer, error: trefferFehler } = useQuery({
    queryKey: ['investor-treffer'],
    enabled: !!data?.length,
    queryFn: async (): Promise<TrefferZeile[]> => {
      const r = await db().from('investor_treffer')
        .select('profil_id, parzelle_id, gefunden_am, gesehen_am, parzelle:parzelle_id(id, address, gemeinde, kategorie, area, marge_chf)')
        .order('gefunden_am', { ascending: false }).limit(5000);
      if (r.error) throw new Error(r.error.message);
      return r.data ?? [];
    },
  });
  const gemerkt = !trefferFehler && !!treffer;
  const profil = data?.find(p => p.id === offen) ?? null;
  const { data: live, isLoading: sucht } = useQuery({
    queryKey: ['investor-treffer-live', offen],
    enabled: !!profil && !gemerkt,
    queryFn: () => passendeObjekte(profil!),
  });
  const [lauf, setLauf] = useState<string | null>(null);

  const je = (id: string) => (treffer ?? []).filter(t => t.profil_id === id && t.parzelle);
  const neue = (id: string) => je(id).filter(t => !t.gesehen_am).length;

  // Was beim Öffnen "neu" war, bleibt es in dieser Ansicht -- gemerkt
  // wird das Sehen trotzdem sofort, damit es beim nächsten Mal stimmt.
  const [gesehen, setGesehen] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!offen || !gemerkt) return;
    const ungesehen = je(offen).filter(t => !t.gesehen_am).map(t => t.parzelle_id);
    if (!ungesehen.length) return;
    setGesehen(g => new Set([...g, ...ungesehen]));
    void db().from('investor_treffer').update({ gesehen_am: new Date().toISOString() }).eq('profil_id', offen).is('gesehen_am', null)
      .then(() => qc.invalidateQueries({ queryKey: ['investor-treffer'] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen, gemerkt]);

  const abgleichen = async (id: string) => {
    setLauf(id);
    const r = await db().rpc('investor_abgleich', { p_schreiben: true, p_profil: id });
    setLauf(null);
    if (r.error) { toast({ title: 'Abgleich ging nicht', description: r.error.message, variant: 'destructive' }); return; }
    const z = (r.data as { treffer: number; neu: number }[])?.[0];
    toast({ title: z ? `${z.treffer} Treffer, ${z.neu} neu` : 'Abgeglichen' });
    await qc.invalidateQueries({ queryKey: ['investor-treffer'] });
  };
  const mandat = async (p: Profil) => {
    setLauf(p.id);
    const r = await db().rpc('investor_mandat_anlegen', { p_profil: p.id, p_max: 30 });
    setLauf(null);
    if (r.error) { toast({ title: 'Mandat nicht angelegt', description: r.error.message, variant: 'destructive' }); return; }
    const z = r.data as { mandant: string; neu: number; schon: number };
    toast({ title: `${z.neu} Gelegenheiten angelegt${z.schon ? `, ${z.schon} gab es schon` : ''}`, description: `Mandat für ${p.akteur?.name ?? 'den Investor'}` });
    await qc.invalidateQueries({ queryKey: ['gelegenheiten'] });
    navigate(`/gelegenheiten?kunde=${z.mandant}&anlass=investorentreffer`);
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl">Investoren</h2>
          <p className="text-sm text-muted-foreground">Suchprofile mit den passenden Objekten aus dem Bestand. Der Abgleich läuft täglich; neue Treffer stehen als "neu" da.</p>
        </div>
        {!neu && <button type="button" onClick={() => setNeu('1')} className={KNOPF}><Plus className="h-4 w-4" /> Investor erfassen</button>}
      </div>
      {neu && <Erfassen onFertig={() => { setNeu(null); void qc.invalidateQueries({ queryKey: ['investorprofile'] }); }} onAbbrechen={() => setNeu(null)} />}
      {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> wird geladen …</p>}
      {error && <p className="text-sm text-destructive">Suchprofile nicht lesbar.</p>}
      {data && data.length === 0 && <p className="text-sm text-muted-foreground">Noch kein Suchprofil. Es entsteht im Gespräch ("Kauft selbst"), aus einer Anfrage über die Seite /investor, oder hier mit "Investor erfassen".</p>}
      {trefferFehler && !!data?.length && <p className="text-xs text-muted-foreground">Gemerkte Treffer brauchen die Migration 20261103220000; bis dahin rechnet der Browser beim Öffnen.</p>}
      <ul className={LISTE}>
        {data?.map(p => {
          const zeilen = je(p.id);
          const n = neue(p.id);
          const auf = offen === p.id;
          return (
            <li key={p.id}>
              <button type="button" onClick={() => setOffen(auf ? null : p.id)} aria-expanded={auf} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/50">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.akteur?.name ?? 'Unbekannt'}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {[p.lagen?.join(', '), p.objekttypen?.join(', '),
                      p.budget_min_chf || p.budget_max_chf ? `${chf(p.budget_min_chf) ?? '…'} bis ${chf(p.budget_max_chf) ?? '…'}` : null,
                      p.rendite_min_pct ? `ab ${p.rendite_min_pct} %` : null, p.horizont].filter(Boolean).join(' · ') || 'ohne Angaben'}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {gemerkt && <span className="text-sm tabular-nums text-muted-foreground">{zeilen.length} Treffer</span>}
                  {n > 0 && <Marke art="heiss">{n} neu</Marke>}
                </span>
              </button>
              {auf && (
                <div className="space-y-3 border-t bg-secondary/30 px-4 py-4 text-sm">
                  {gemerkt && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => void abgleichen(p.id)} disabled={lauf === p.id} className={KNOPF}><RefreshCw className={`h-4 w-4 ${lauf === p.id ? 'animate-spin' : ''}`} /> Jetzt abgleichen</button>
                      <button type="button" onClick={() => void mandat(p)} disabled={lauf === p.id || !zeilen.length} className={`${KNOPF_HAUPT} disabled:opacity-50`}><Target className="h-4 w-4" /> Als Mandat anlegen{zeilen.length ? ` (${Math.min(zeilen.length, 30)} Kandidaten)` : ''}</button>
                      <span className="text-xs text-muted-foreground">Budget nicht abgeglichen: der Bestand führt keinen Preis.</span>
                    </div>
                  )}
                  {p.kriterien && <p className="text-muted-foreground">{p.kriterien}</p>}
                  {!gemerkt && sucht && <p className="text-muted-foreground">Suche passende Objekte …</p>}
                  {!gemerkt && live && live.objekte.length === 0 && <p className="text-muted-foreground">{live.hinweis ?? 'Kein passendes Objekt im Bestand.'}</p>}
                  {!gemerkt && live && live.objekte.length > 0 && <Objekte zeilen={live.objekte.map(o => ({ o, neu: false }))} hinweis={live.hinweis} />}
                  {gemerkt && zeilen.length === 0 && <p className="text-muted-foreground">Noch kein Treffer gemerkt. "Jetzt abgleichen" sucht im Bestand nach Lage und Objektart.</p>}
                  {gemerkt && zeilen.length > 0 && <Objekte zeilen={zeilen.map(t => ({ o: t.parzelle!, neu: !t.gesehen_am || gesehen.has(t.parzelle_id) }))} hinweis={null} />}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Objekte({ zeilen, hinweis }: { zeilen: { o: Treffer; neu: boolean }[]; hinweis: string | null }) {
  const sortiert = [...zeilen].sort((a, b) => (Number(b.o.marge_chf) || 0) - (Number(a.o.marge_chf) || 0));
  return (
    <>
      {hinweis && <p className="text-xs text-muted-foreground">{hinweis}</p>}
      <ul className={LISTE}>
        {sortiert.map(({ o, neu }) => (
          <li key={o.id} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">
            <span className="flex min-w-0 items-center gap-2">
              <ObjektLink id={o.id} className="truncate">{o.address ?? 'Objekt'}{o.gemeinde ? ` · ${o.gemeinde}` : ''}</ObjektLink>
              {neu && <Marke art="heiss">neu</Marke>}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{[o.kategorie, m2(o.area), o.marge_chf ? `Marge ${chf(o.marge_chf)}` : null].filter(Boolean).join(' · ')}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Ein Investor von Hand: Name und Art, dann das Suchprofil. */
function Erfassen({ onFertig, onAbbrechen }: { onFertig: () => void; onAbbrechen: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({ name: '', art: 'firma', lagen: '', typen: '', budgetMin: '', budgetMax: '', rendite: '', horizont: '', kriterien: '' });
  const [laeuft, setLaeuft] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(x => ({ ...x, [k]: e.target.value }));
  const speichern = async () => {
    if (!f.name.trim()) return;
    setLaeuft(true);
    try {
      const a = await db().from('akteur').insert({ name: f.name.trim(), art: f.art, bemerkung: 'Investor, von Hand erfasst' }).select('id').single();
      if (a.error) throw new Error(a.error.message);
      const p = await db().from('investorprofil').insert({
        akteur_id: a.data.id, lagen: liste(f.lagen), objekttypen: liste(f.typen),
        budget_min_chf: betrag(f.budgetMin), budget_max_chf: betrag(f.budgetMax),
        rendite_min_pct: f.rendite ? Number(f.rendite.replace(',', '.')) || null : null,
        horizont: f.horizont.trim() || null, kriterien: f.kriterien.trim() || null, erfasst_von: 'hand',
      });
      if (p.error) throw new Error(p.error.message);
      toast({ title: 'Investor erfasst', description: 'Der Abgleich läuft heute Nacht; "Jetzt abgleichen" geht sofort.' });
      onFertig();
    } catch (e) {
      toast({ title: 'Nicht gespeichert', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally { setLaeuft(false); }
  };
  const feld = (k: keyof typeof f, titel: string, platz = '') => (
    <label className="block min-w-0"><span className="mb-1 block text-xs text-muted-foreground">{titel}</span>
      <input className={`${FELD} w-full`} value={f[k]} placeholder={platz} onChange={set(k)} /></label>
  );
  return (
    <form className="space-y-3 rounded border bg-card p-4" onSubmit={e => { e.preventDefault(); void speichern(); }}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {feld('name', 'Name', 'Anlagestiftung Muster')}
        <label className="block"><span className="mb-1 block text-xs text-muted-foreground">Art</span>
          <Auswahl label="Art" wert={f.art} setWert={w => setF(x => ({ ...x, art: w }))} className="w-full"
            optionen={[{ wert: 'firma', titel: 'Firma' }, { wert: 'institution', titel: 'Institution' }, { wert: 'person', titel: 'Person' }]} /></label>
        {feld('lagen', 'Lagen (Gemeinden, mit Komma)', 'Küsnacht, Kloten')}
        {feld('typen', 'Objektarten', 'MFH, Bauland')}
        {feld('budgetMin', 'Budget ab (Mio.)', '5')}
        {feld('budgetMax', 'Budget bis (Mio.)', '20')}
        {feld('rendite', 'Rendite ab (%)', '3.5')}
        {feld('horizont', 'Horizont', '12 Monate')}
      </div>
      {feld('kriterien', 'Weitere Kriterien', 'z.B. nur Bauland mit rechtskräftiger Zone')}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={laeuft || !f.name.trim()} className={`${KNOPF_HAUPT} disabled:opacity-50`}>{laeuft ? 'Speichert …' : 'Investor speichern'}</button>
        <button type="button" onClick={onAbbrechen} className={KNOPF}>Abbrechen</button>
      </div>
    </form>
  );
}
