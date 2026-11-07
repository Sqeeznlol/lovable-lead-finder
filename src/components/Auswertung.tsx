import { useMemo, useState } from 'react';
import { ObjektLink } from '@/components/ObjektLink';
import { useQuery } from '@tanstack/react-query';
import { Marke, Seite } from '@/components/rahmen';
import { BILD } from '@/lib/luftbild';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { KATEGORIEN, kategorie, type Absicht, type Kategorie } from '@/lib/gespraech';
import { Investoren } from '@/components/Investoren';
import { KennzahlenTim } from '@/components/KennzahlenTim';
import { useUrlWert } from '@/hooks/use-url-wert';

// Die Check-Seiten leben seit dem 7. November in Bauraum Akquise; ihre
// Leads kommen weiter hier an. Damit die Antworten lesbar bleiben, stehen
// die Texte hier -- dieselben wie in check-daten.ts der Akquise.
const ANTWORT_TEXT = {
  eigentuemer: { allein: 'Ja, allein', gemeinsam: 'Ja, gemeinsam mit anderen', erbengemeinschaft: 'Ja, als Erbengemeinschaft',
    vertretung: 'Nein, ich vertrete den Eigentümer', nein: 'Nein' } as Record<string, string>,
  absicht: { verkaufen: 'Verkaufen', bauen: 'Bauen, aus- oder umbauen', wert: 'Den Wert kennen', informieren: 'Nur informieren' } as Record<string, string>,
  zeitraum: { 12: 'In den nächsten 12 Monaten', 36: 'In 1 bis 3 Jahren', offen: 'Noch offen' } as Record<string, string>,
};

/**
 * Auswertung: was aus den Gesprächen folgt, wer kaufen will, und ob
 * die Plattform etwas bringt.
 *
 * - Reaktivierung (Tims Abschnitt 7): je Objekt das letzte Gespräch,
 *   nach Kategorie, mit dem nächsten Schritt. Fällige Wiedervorlagen
 *   zuerst.
 * - Investoren (Abschnitt 6): jedes Suchprofil mit den passenden
 *   Objekten aus dem Bestand.
 * - Kennzahlen (Abschnitt 8): Tims Tabelle mit Ausgangswert, heute
 *   und Ziel, dazu der Stand der Daten je Quelle (KennzahlenTim).
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
  // In der Adresse, damit "Zurück" im Browser den Filter zurücknimmt.
  const [filterWert, setFilterWert] = useUrlWert('reiter', 'faellig');
  const filter = filterWert as Kategorie | 'alle' | 'faellig';
  const setFilter = (f: Kategorie | 'alle' | 'faellig') => setFilterWert(f);
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

  // Ereignis seit dem Gespräch (Tims Abschnitt 7: "contact again on a
  // trigger rather than on a date"): die Gelegenheiten "Wieder
  // ansprechen" aus gelegenheiten_reaktivierung, je Parzelle.
  const { data: ereignisse } = useQuery({
    queryKey: ['reaktivierung-ereignisse'],
    queryFn: async (): Promise<Map<string, { id: string; begruendung: string | null }>> => {
      const r = await db().from('gelegenheit').select('id, begruendung, gelegenheit_parzelle(parzelle_id)')
        .like('titel', 'Wieder ansprechen:%').in('zustand', ['erkannt', 'geprueft', 'gemeldet', 'in bearbeitung']).limit(500);
      if (r.error) return new Map();
      const m = new Map<string, { id: string; begruendung: string | null }>();
      for (const g of (r.data ?? []) as { id: string; begruendung: string | null; gelegenheit_parzelle: { parzelle_id: string }[] }[])
        for (const x of g.gelegenheit_parzelle ?? []) m.set(x.parzelle_id, { id: g.id, begruendung: g.begruendung });
      return m;
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
      <h2 className="text-xl">Reaktivierung</h2>
      <p className="text-sm text-muted-foreground">Je Objekt das letzte Gespräch. Wer nicht verkauft, ist nicht verloren -- jede Gruppe hat ihren nächsten Schritt.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setFilter('faellig')}
                className={`h-9 rounded-[3px] border px-3 text-sm ${filter === 'faellig' ? 'border-[#1E2433] bg-[#1E2433] text-white' : ''}`}>
          Wiedervorlage fällig · {mitKat.filter(x => faellig(x.a)).length}
        </button>
        {(Object.keys(KATEGORIEN) as Kategorie[]).map(k => (
          <button key={k} type="button" onClick={() => setFilter(k)}
                  className={`h-9 rounded-[3px] border px-3 text-sm ${filter === k ? 'border-[#1E2433] bg-[#1E2433] text-white' : ''}`}>
            {KATEGORIEN[k].titel} · {zahl(k)}
          </button>
        ))}
        <button type="button" onClick={() => setFilter('alle')}
                className={`h-9 rounded-[3px] border px-3 text-sm ${filter === 'alle' ? 'border-[#1E2433] bg-[#1E2433] text-white' : ''}`}>Alle</button>
      </div>
      {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> wird geladen …</p>}
      {error && <p className="text-sm text-destructive">Gespräche nicht lesbar.</p>}
      {data && liste.length === 0 && <p className="text-sm text-muted-foreground">Nichts in dieser Gruppe.</p>}
      {liste.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {liste.map(({ a, k }) => (
            <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
              <span className="min-w-0">
                <ObjektLink id={a.parzelle_id} className="block font-medium">{a.parzelle?.address ?? 'Objekt'}{a.parzelle?.gemeinde ? ` · ${a.parzelle.gemeinde}` : ''}</ObjektLink>
                <span className="block text-xs text-muted-foreground">
                  {[a.parzelle?.owner_name, KATEGORIEN[k].titel, `Gespräch ${datum(a.gefuehrt_am)}`].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="text-right text-xs">
                {ereignisse?.get(a.parzelle_id ?? '') ? (
                  <a href={`/gelegenheiten?gelegenheit=${ereignisse.get(a.parzelle_id ?? '')!.id}`} className="block font-medium text-[#C4520F] underline-offset-2 hover:underline">Baugesuch seit dem Gespräch: jetzt anrufen</a>
                ) : <span className="block font-medium">{KATEGORIEN[k].schritt}</span>}
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

/** Zählen mit dem Kopf von PostgREST: nur die Zahl, keine Zeilen. */
async function zaehlen(tabelle: string, filter?: (q: any) => any, geschaetzt = false): Promise<number | null> { // eslint-disable-line @typescript-eslint/no-explicit-any
  let q = db().from(tabelle).select('*', { count: geschaetzt ? 'estimated' : 'exact', head: true });
  if (filter) q = filter(q);
  const r = await q;
  return r.error ? null : r.count ?? null;
}

function useKennzahlen() {
  return useQuery({
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
}

const z = (n: number | null | undefined) => (n == null ? '–' : n.toLocaleString('de-CH'));

interface AnfrageZeile {
  id: string; art: 'bewertung' | 'potenzial' | 'investor'; name: string; email: string | null; telefon: string | null;
  adresse: string | null; angaben: Record<string, unknown>; nachricht: string | null; erstellt_am: string; bearbeitet: boolean;
}
const ART_TITEL: Record<AnfrageZeile['art'], string> = { bewertung: 'Bewertung', potenzial: 'Potenzialcheck', investor: 'Investor' };

/** Leads der Check-Seiten (parzellenchecker.ch ...): Marke, Antworten in Worten, Herkunft der Anzeige. */
function checkZeile(g: Record<string, unknown>): { titel: string; heiss: boolean; antworten: string; grundstueck: string; herkunft: string } | null {
  if (g.quelle !== 'check') return null;
  const t = (feld: keyof typeof ANTWORT_TEXT) => {
    const w = g[feld];
    return typeof w === 'string' ? (ANTWORT_TEXT[feld] as Record<string, string>)[w] ?? w : null;
  };
  return {
    titel: `Check · ${String(g.domain ?? g.marke ?? '')}`,
    heiss: g.prioritaet === 'heiss',
    antworten: [t('eigentuemer') && `Eigentum: ${t('eigentuemer')}`, t('absicht'), t('zeitraum')].filter(Boolean).join(' · '),
    grundstueck: [g.parzelle && `Parzelle ${g.parzelle}`, g.flaeche && `${Number(g.flaeche).toLocaleString('de-CH')} m²`, g.zone, g.gemeinde,
      g.gebaeude ? `${g.gebaeude} Gebäude` : null, g.wohnungen ? `${g.wohnungen} Wohnungen` : null, g.baujahr ? `ab ${g.baujahr}` : null,
      g.projekt ? 'Projekt im Register' : null].filter(Boolean).join(' · '),
    herkunft: [g.utm_source, g.utm_campaign, g.gclid ? 'Google-Klick' : null, g.fbclid ? 'Meta-Klick' : null].filter(Boolean).join(' · '),
  };
}

/** "2 Mio.", "850'000" -> Zahl; die öffentliche Seite nimmt Freitext. */
const zahl = (v: unknown) => {
  const t = String(v ?? '').toLowerCase().replace(/chf|['’\s]/g, '');
  const n = Number(t.replace(/mio\.?$/, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(/mio/.test(t) ? n * 1e6 : n) : null;
};

/**
 * Anfragen von den öffentlichen Seiten (/bewertung, /potenzial,
 * /investor). Eine Investor-Anfrage wird mit einem Tipp zum Akteur mit
 * Suchprofil -- dann taucht sie im Investoren-Abgleich auf.
 */
function Anfragen() {
  const [alle, setAlle] = useState(false);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['anfragen', alle],
    queryFn: async (): Promise<AnfrageZeile[]> => {
      let q = db().from('anfrage').select('*').order('erstellt_am', { ascending: false }).limit(200);
      if (!alle) q = q.eq('bearbeitet', false);
      const r = await q;
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });
  const erledigt = async (a: AnfrageZeile) => { await db().from('anfrage').update({ bearbeitet: true }).eq('id', a.id); await refetch(); };
  const alsInvestor = async (a: AnfrageZeile) => {
    const liste = (v: unknown) => String(v ?? '').split(/[,;]/).map(x => x.trim()).filter(Boolean);
    const ak = await db().from('akteur').insert({ name: a.name, art: 'firma', bemerkung: 'Aus Investor-Anfrage' }).select('id').single();
    if (ak.error) return;
    await db().from('kontakt').insert({ akteur_id: ak.data.id, name: a.name, email: a.email, telefon: a.telefon });
    await db().from('investorprofil').insert({
      akteur_id: ak.data.id, lagen: liste(a.angaben.lagen), objekttypen: liste(a.angaben.objekttypen),
      budget_min_chf: zahl(a.angaben.budget_von), budget_max_chf: zahl(a.angaben.budget_bis),
      kriterien: a.nachricht, erfasst_von: 'Anfrage',
    });
    await erledigt(a);
  };
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl">Anfragen</h2>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={alle} onChange={e => setAlle(e.target.checked)} /> auch erledigte
        </label>
      </div>
      <p className="text-sm text-muted-foreground">Von den Check-Seiten (parzellenchecker.ch und weitere) und von /bewertung, /potenzial, /investor.</p>
      {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> wird geladen …</p>}
      {error && <p className="text-sm text-destructive">Anfragen nicht lesbar.</p>}
      {data && data.length === 0 && <p className="text-sm text-muted-foreground">Keine offene Anfrage.</p>}
      <ul className="space-y-2">
        {data?.map(a => {
          const c = checkZeile(a.angaben ?? {});
          return (
          <li key={a.id} className="rounded-xl border p-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="flex flex-wrap items-center gap-2 font-medium">
                {c?.heiss && <Marke art="heiss">heiss</Marke>}{c ? c.titel : ART_TITEL[a.art]} · {a.name}
              </span>
              <span className="text-xs text-muted-foreground">{datum(a.erstellt_am)}{a.bearbeitet ? ' · erledigt' : ''}</span>
            </div>
            <p className="text-muted-foreground">{[a.adresse, a.telefon, a.email].filter(Boolean).join(' · ')}</p>
            {c ? (
              <>
                {c.antworten && <p className="font-medium">{c.antworten}</p>}
                {c.grundstueck && <p className="text-xs text-muted-foreground">{c.grundstueck}</p>}
                {c.herkunft && <p className="text-xs text-muted-foreground">Herkunft: {c.herkunft}</p>}
              </>
            ) : (
            <p className="text-xs text-muted-foreground">
              {Object.entries(a.angaben ?? {}).filter(([k, v]) => v != null && k !== 'lv95').map(([k, v]) => `${k}: ${v}`).join(' · ')}
            </p>
            )}
            {a.nachricht && <p className="mt-1">{a.nachricht}</p>}
            {!a.bearbeitet && (
              <div className="mt-2 flex flex-wrap gap-2">
                {a.art === 'investor' && (
                  <button type="button" onClick={() => void alsInvestor(a)} className="h-10 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white">Als Investor übernehmen</button>
                )}
                <button type="button" onClick={() => void erledigt(a)} className="h-10 rounded-lg border px-3 text-sm">Erledigt</button>
              </div>
            )}
          </li>
          );
        })}
      </ul>
    </section>
  );
}

export function Auswertung() {
  const { data } = useKennzahlen();
  const pct = (a: number | null | undefined, b: number | null | undefined) => (a != null && b ? Math.round((a / b) * 100) : null);
  return (
    <Seite bild={BILD.auswertung} ueber="Auswertung · Gespräche, Anfragen, Investoren"
      titel={data && data.anrufe != null ? `${z(data.anrufe)} Gespräche, ${z(data.profile ?? 0)} Suchprofile` : 'Gespräche und Suchprofile'}
      unter="Reaktivierung, Investoren und Kennzahlen, aus den erfassten Gesprächen und Gelegenheiten."
      kennzahlen={data ? [
        { titel: 'Gespräche', wert: z(data.anrufe), marke: <Marke art="lila">{pct(data.erreicht, data.anrufe) ?? 0} % erreicht</Marke> },
        { titel: 'Suchprofile', wert: z(data.profile), marke: <Marke art="violett">Investoren</Marke> },
        { titel: 'Gelegenheiten', wert: z(data.gel), marke: <Marke art="minze">{z(data.abgeschlossen)} erreicht</Marke> },
        { titel: 'Überwacht', wert: z(data.zugeordnet), marke: <Marke>Parzellen</Marke> },
      ] : undefined}>
      <Anfragen />
      <Reaktivierung />
      <Investoren />
      <KennzahlenTim />
    </Seite>
  );
}
