import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useUrlSetzen } from '@/hooks/use-url-wert';
import { Activity, Archive, Briefcase, FileSearch, Flame, Loader2, MapPin, Sparkles, UserCheck, Workflow } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useCanton } from '@/hooks/use-canton';
import { Abschnitt, Karussell, KNOPF, KNOPF_HAUPT, KNOPF_LEISE, Leer, LISTE, Marke, Seite, Strichbalken } from '@/components/rahmen';
import { LuftbildKarte } from '@/components/LuftbildKarte';
import { KOPFBILD } from '@/lib/luftbild';
import { zoneKurzform } from '@/lib/potential';

/**
 * Das Cockpit, gebaut wie das Dashboard der Vorlage (DESIGN.md):
 * Begrüssung und ein Satz, der sagt, was heute zählt, über einem
 * Luftbild; darunter die Kennzahlen; links die heissesten
 * Gelegenheiten und was zuletzt geschah; rechts die Handlungen und die
 * Objekte mit dem grössten Potenzial.
 *
 * Jede Zahl ist in der Datenbank gezählt, nicht geschätzt, und jede
 * führt dorthin, wo man sie abarbeitet.
 */
export type Ziel = 'zentrale' | 'baugesuche' | 'gelegenheiten' | 'auswertung' | 'karte';

// Die erzeugten Typen kennen die Plattform-Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;
const tag = (minus: number) => new Date(Date.now() - minus * 864e5).toISOString().slice(0, 10);
const n = (x: number | null | undefined) => (x == null ? '–' : x.toLocaleString('de-CH'));
const mio = (v: number | null | undefined) => (!v ? '–' : `CHF ${(v / 1e6).toFixed(1)} Mio`);

async function zaehlen(t: string, f?: (q: any) => any): Promise<number | null> { // eslint-disable-line @typescript-eslint/no-explicit-any
  let q = db().from(t).select('*', { count: 'exact', head: true });
  if (f) q = f(q);
  const r = await q;
  return r.error ? null : r.count ?? null;
}

/** "vor 5 Min", "vor 3 Std", "gestern", sonst das Datum. */
export function vorWann(s: string, jetzt = new Date()): string {
  const min = Math.round((jetzt.getTime() - new Date(s).getTime()) / 6e4);
  if (min < 1) return 'gerade';
  if (min < 60) return `vor ${min} Min`;
  if (min < 24 * 60) return `vor ${Math.round(min / 60)} Std`;
  if (min < 48 * 60) return 'gestern';
  return new Date(s).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' });
}

/**
 * Der grosse Satz oben: was heute als Erstes zählt. Eine Aussage, keine
 * Liste -- die Vorlage sagt "You have 3 hot buyers ready to close".
 */
export function satzDesTages(z: { gelNeu: number | null; faellig: number | null; anfragen: number | null; bgBestand: number | null; vorhaben: number | null }): string {
  const s = (k: number, ein: string, mehr: string) => `${k} ${k === 1 ? ein : mehr}`;
  if (z.gelNeu) return `${s(z.gelNeu, 'Gelegenheit wartet', 'Gelegenheiten warten')} auf deine Prüfung`;
  if (z.faellig) return `${s(z.faellig, 'Wiedervorlage ist', 'Wiedervorlagen sind')} heute fällig`;
  if (z.anfragen) return `${s(z.anfragen, 'neue Anfrage', 'neue Anfragen')} von Eigentümern`;
  if (z.bgBestand) return `${s(z.bgBestand, 'Baugesuch trifft', 'Baugesuche treffen')} den Bestand`;
  if (z.vorhaben) return `${s(z.vorhaben, 'Vorhaben läuft', 'Vorhaben laufen')} für Kunden`;
  return 'Heute ist alles erledigt';
}

const gruss = (h = new Date().getHours()) => (h < 11 ? 'Guten Morgen' : h < 17 ? 'Guten Tag' : 'Guten Abend');

interface Heiss { id: string; titel: string; begruendung: string | null; prioritaet: number | null; zustand: string; gemeinde: string | null }
interface Ereignis { id: string; art: string; titel: string; unter: string; zeit: string }
interface Objekt { id: string; address: string; gemeinde: string | null; zone: string | null; area: number | null; hnf_delta: number | null; marge_chf: number | null; baujahr: number | null }

const ARTEN: Record<string, { symbol: typeof Activity; farbe: string; wort: string }> = {
  abfrage: { symbol: FileSearch, farbe: 'bg-accent/10 text-accent', wort: 'Grundbuch abgefragt' },
  eigentuemer: { symbol: UserCheck, farbe: 'bg-gruen/10 text-gruen', wort: 'Eigentümer gespeichert' },
  archiviert: { symbol: Archive, farbe: 'bg-secondary text-muted-foreground', wort: 'Ins Archiv' },
  deal: { symbol: Sparkles, farbe: 'bg-violett/10 text-violett', wort: 'Deal angelegt' },
  vorhaben: { symbol: Workflow, farbe: 'bg-heiss/10 text-heiss', wort: 'Vorhaben' },
};

export function Cockpit({ onGehe, onNeu }: { onGehe: (z: Ziel) => void; onNeu?: () => void }) {
  const { user } = useAuth();
  const { current } = useCanton();
  // Jede Zeile führt dorthin, wo man mit ihr weiterarbeitet -- nicht in
  // die ganze Liste (Prüfung der Abläufe, 1. November).
  const navigate = useNavigate();
  const setzen = useUrlSetzen();
  const name = (user?.email?.split('@')[0] ?? '').replace(/^./, c => c.toUpperCase());

  const { data, isLoading } = useQuery({
    queryKey: ['cockpit', current],
    queryFn: async () => {
      const [vorhaben, vorhabenNeu, bgNeu, bgBestand, gelOffen, gelNeu, faellig, anfragen, heiss, prot, eintr, objekte] = await Promise.all([
        zaehlen('vorhaben', q => q.not('zustand', 'in', '(abgeschlossen,pausiert)')),
        zaehlen('vorhaben', q => q.gte('erstellt_am', tag(7))),
        zaehlen('baugesuch', q => q.neq('quelle', 'probe').gte('publiziert_am', tag(7))),
        zaehlen('baugesuch', q => q.neq('quelle', 'probe').gte('publiziert_am', tag(7)).not('parzelle_id', 'is', null)),
        zaehlen('gelegenheit', q => q.not('zustand', 'in', '(abgeschlossen,verworfen)')),
        zaehlen('gelegenheit', q => q.eq('zustand', 'erkannt')),
        zaehlen('anruf', q => q.lte('wiedervorlage_am', tag(0))),
        zaehlen('anfrage', q => q.eq('bearbeitet', false)),
        db().from('gelegenheit').select('id, titel, begruendung, prioritaet, zustand, gelegenheit_parzelle(rolle, properties(gemeinde))')
          .not('zustand', 'in', '(abgeschlossen,verworfen)').order('prioritaet', { ascending: false, nullsFirst: false }).limit(4),
        db().from('aktivitaet').select('id, aktion, gegenstand, zeit').in('aktion', ['abfrage', 'eigentuemer', 'archiviert', 'deal'])
          .order('zeit', { ascending: false }).limit(5),
        db().from('vorhaben_eintrag').select('id, text, am, art, vorhaben(titel)').eq('art', 'schritt').order('am', { ascending: false }).limit(5),
        // Die grössten Margen ohne Eigentümer: was sich abzufragen lohnt.
        // Index idx_properties_arbeitsliste_marge (kanton, marge_chf).
        db().from('properties').select('id, address, gemeinde, zone, area, hnf_delta, marge_chf, baujahr')
          .eq('kanton', current).eq('ausgeschlossen', false).neq('preselection_status', 'Ausschliessen')
          .is('owner_name', null).order('marge_chf', { ascending: false, nullsFirst: false }).limit(3),
      ]);
      const heisse: Heiss[] = ((heiss.data ?? []) as { id: string; titel: string; begruendung: string | null; prioritaet: number | null; zustand: string; gelegenheit_parzelle?: { rolle: string; properties: { gemeinde: string | null } | null }[] }[])
        .map(g => ({ ...g, gemeinde: g.gelegenheit_parzelle?.find(p => p.rolle === 'ausloeser')?.properties?.gemeinde ?? null }));
      const ereignisse: Ereignis[] = [
        ...((prot.data ?? []) as { id: string; aktion: string; gegenstand: string | null; zeit: string }[])
          .map(p => ({ id: `p${p.id}`, art: p.aktion, titel: ARTEN[p.aktion]?.wort ?? p.aktion, unter: p.gegenstand ?? '', zeit: p.zeit })),
        ...((eintr.data ?? []) as { id: string; text: string; am: string; vorhaben: { titel: string } | null }[])
          .map(e => ({ id: `v${e.id}`, art: 'vorhaben', titel: e.vorhaben?.titel ?? 'Vorhaben', unter: e.text, zeit: e.am })),
      ].sort((a, b) => b.zeit.localeCompare(a.zeit)).slice(0, 5);
      return { vorhaben, vorhabenNeu, bgNeu, bgBestand, gelOffen, gelNeu, faellig, anfragen, heisse, ereignisse, objekte: (objekte.data ?? []) as Objekt[] };
    },
    staleTime: 60 * 1000,
  });

  const maxPrio = Math.max(1, ...(data?.heisse ?? []).map(h => Number(h.prioritaet) || 0));
  const FARBEN = ['heiss', 'akzent', 'gruen', 'heiss'] as const;

  const aktionen = (
    <>
      <button type="button" className={`${KNOPF} px-2 text-sm`} onClick={() => onGehe('karte')}><MapPin className="h-4 w-4 shrink-0" /> Karte</button>
      <button type="button" className={`${KNOPF} px-2 text-sm`} onClick={() => onGehe('baugesuche')}><FileSearch className="h-4 w-4 shrink-0" /> Baugesuche</button>
      <button type="button" className={`${KNOPF_HAUPT} px-2 text-sm`} onClick={() => (onNeu ? onNeu() : onGehe('zentrale'))}><Briefcase className="h-4 w-4 shrink-0" /> Vorhaben</button>
    </>
  );

  return (
    <Seite bild={KOPFBILD} ueber={`${gruss()}${name ? `, ${name}` : ''}`} titel={data ? satzDesTages(data) : ' '}
      kennzahlen={data ? [
        { titel: 'Vorhaben', wert: n(data.vorhaben), marke: data.vorhabenNeu ? <Marke art="lila">+{data.vorhabenNeu} neu</Marke> : undefined, onClick: () => onGehe('zentrale') },
        { titel: 'Gelegenheiten', wert: n(data.gelOffen), marke: data.gelNeu ? <Marke art="rosa">{data.gelNeu} ungeprüft</Marke> : undefined, onClick: () => onGehe('gelegenheiten') },
        { titel: 'Baugesuche', wert: n(data.bgNeu), marke: <Marke art="minze">7 Tage</Marke>, onClick: () => onGehe('baugesuche') },
        { titel: 'Wiedervorlagen', wert: n(data.faellig), marke: data.anfragen ? <Marke art="rosa">+{data.anfragen} Anfragen</Marke> : undefined, onClick: () => onGehe('auswertung') },
      ] : undefined}
      aktionen={aktionen}
      seite={
        <Abschnitt titel="Grösstes Potenzial" unter={`Kanton ${current}, Eigentümer noch offen`} symbol={Sparkles} kachel="akzent">
          {data && data.objekte.length === 0 && <Leer titel="Keine Objekte gefunden." />}
          <Karussell>
            {(data?.objekte ?? []).map(o => <ObjektKarte key={o.id} o={o} onClick={() => setzen({ parzelle: o.id })} />)}
          </Karussell>
        </Abschnitt>
      }>
      {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> wird gezählt …</p>}
      {data && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Abschnitt titel="Heisse Gelegenheiten" unter="Höchste Priorität, noch offen" symbol={Flame} kachel="heiss"
                     rechts={<button type="button" className={KNOPF_LEISE} onClick={() => onGehe('gelegenheiten')}>Alle zeigen</button>}>
            {data.heisse.length === 0 ? <Leer titel="Keine offene Gelegenheit." /> : (
              <ul className={LISTE}>
                {data.heisse.map((h, i) => (
                  <li key={h.id}>
                    <button type="button" onClick={() => navigate(`/gelegenheiten?gelegenheit=${h.id}`)} className="grid w-full grid-cols-[minmax(0,1fr)_minmax(110px,40%)] items-center gap-4 px-4 py-3.5 text-left hover:bg-secondary/50">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{h.titel}</span>
                        <span className="block truncate text-sm text-muted-foreground">{[h.gemeinde, h.begruendung].filter(Boolean).join(' · ')}</span>
                      </span>
                      <Strichbalken titel="Priorität" anteil={(Number(h.prioritaet) || 0) / maxPrio} farbe={FARBEN[i]} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Abschnitt>

          <Abschnitt titel="Letzte Aktivität" unter="Abfragen, Eigentümer, Vorhaben" symbol={Activity} kachel="akzent">
            {data.ereignisse.length === 0 ? <Leer titel="Noch nichts geschehen." /> : (
              <ul className={LISTE}>
                {data.ereignisse.map(e => {
                  const a = ARTEN[e.art] ?? ARTEN.vorhaben;
                  return (
                    <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[3px] ${a.farbe}`}><a.symbol className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">{e.titel}</span>
                        <span className="block truncate text-sm text-muted-foreground">{e.unter}</span>
                      </span>
                      <span className="shrink-0 text-xs font-medium text-accent">{vorWann(e.zeit)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Abschnitt>
        </div>
      )}
    </Seite>
  );
}

/** Objektkarte wie "AI Recommended" in der Vorlage: Luftbild, Ort, Adresse, Merkmale, Marge. */
function ObjektKarte({ o, onClick }: { o: Objekt; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="block overflow-hidden rounded border bg-card text-left transition-colors hover:border-foreground/30">
      <span className="relative block">
        <LuftbildKarte adresse={[o.address, o.gemeinde].filter(Boolean).join(', ')} className="aspect-[16/9] w-full" />
        {o.hnf_delta != null && o.hnf_delta > 0 && (
          <span className="absolute left-3 top-3"><Marke art="gruen">Reserve {n(Math.round(o.hnf_delta))} m²</Marke></span>
        )}
      </span>
      <span className="block space-y-2 p-4">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {o.gemeinde ?? '–'}</span>
        <span className="block truncate text-lg font-medium">{o.address}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {[o.area ? `${n(Math.round(o.area))} m²` : null, zoneKurzform(o.zone), o.baujahr ? `Baujahr ${o.baujahr}` : null]
            .filter(Boolean).map((x, i) => <span key={i} className={`whitespace-nowrap ${i ? 'border-l pl-3' : ''}`}>{x}</span>)}
        </span>
        <span className="flex items-center justify-between border-t pt-3">
          <span className="text-xl font-semibold text-violett">{mio(o.marge_chf)}</span>
          <Marke art="violett">Marge</Marke>
        </span>
      </span>
    </button>
  );
}
