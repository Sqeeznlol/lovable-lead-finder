import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useUrlSetzen } from '@/hooks/use-url-wert';
import { Calculator, Flame, Inbox, Loader2, MapPin, Phone, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useCanton } from '@/hooks/use-canton';
import { Abschnitt, Karussell, KNOPF, KNOPF_HAUPT, KNOPF_LEISE, Leer, LISTE, Marke, Seite, Strichbalken, Weg } from '@/components/rahmen';
import { LuftbildKarte } from '@/components/LuftbildKarte';
import { KOPFBILD } from '@/lib/luftbild';
import { kalkulationenLaden, uhr, UNTERWEGS } from '@/lib/calc-ablauf';
import { zoneKurzform } from '@/lib/potential';
import { FENSTER } from '@/lib/fenster';
import { anrufListe, telLink, woSuchen, type Anruf } from '@/lib/anrufen';

/**
 * Das Cockpit, gebaut wie das Dashboard der Vorlage (DESIGN.md):
 * Begrüssung und ein Satz, der sagt, was heute zählt, über einem
 * Luftbild; darunter der Weg vom Lead zum Angebot mit dem nächsten
 * Schritt (22. November: «ein klarer Weg»); dann die heissesten
 * Gelegenheiten; rechts die Objekte mit dem grössten Potenzial.
 *
 * Jede Zahl ist in der Datenbank gezählt, nicht geschätzt, und jede
 * führt dorthin, wo man sie abarbeitet.
 */
export type Ziel = 'zentrale' | 'baugesuche' | 'gelegenheiten' | 'auswertung' | 'karte' | 'leads';

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
export function satzDesTages(z: { gelNeu: number | null; faellig: number | null; anfragen: number | null; bgBestand: number | null; vorhaben: number | null; kalkSpaet?: number; kalkWartend?: number }): string {
  const s = (k: number, ein: string, mehr: string) => `${k} ${k === 1 ? ein : mehr}`;
  // Zuerst, was auf dem Weg zum Angebot liegt: das bringt Geld.
  if (z.kalkSpaet) return `${s(z.kalkSpaet, 'Kalkulation ist', 'Kalkulationen sind')} überfällig`;
  if (z.anfragen) return `${s(z.anfragen, 'neuer Lead wartet', 'neue Leads warten')} auf einen Anruf`;
  if (z.kalkWartend) return `${s(z.kalkWartend, 'Kalkulation wartet', 'Kalkulationen warten')} auf den nächsten Schritt`;
  if (z.gelNeu) return `${s(z.gelNeu, 'Gelegenheit wartet', 'Gelegenheiten warten')} auf deine Prüfung`;
  if (z.faellig) return `${s(z.faellig, 'Wiedervorlage ist', 'Wiedervorlagen sind')} heute fällig`;
  if (z.anfragen) return `${s(z.anfragen, 'neue Anfrage', 'neue Anfragen')} von Eigentümern`;
  if (z.bgBestand) return `${s(z.bgBestand, 'Baugesuch trifft', 'Baugesuche treffen')} den Bestand`;
  if (z.vorhaben) return `${s(z.vorhaben, 'Vorhaben läuft', 'Vorhaben laufen')} für Kunden`;
  return 'Heute ist alles erledigt';
}

const gruss = (h = new Date().getHours()) => (h < 11 ? 'Guten Morgen' : h < 17 ? 'Guten Tag' : 'Guten Abend');

interface Heiss { id: string; titel: string; begruendung: string | null; prioritaet: number | null; zustand: string; gemeinde: string | null }
interface Objekt { id: string; address: string; gemeinde: string | null; zone: string | null; area: number | null; hnf_delta: number | null; marge_chf: number | null; baujahr: number | null }


export function Cockpit({ onGehe }: { onGehe: (z: Ziel) => void }) {
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
      const [vorhaben, vorhabenNeu, bgNeu, bgBestand, gelOffen, gelNeu, faellig, anfragen, heiss, objekte] = await Promise.all([
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
        // Die grössten Margen ohne Eigentümer: was sich abzufragen lohnt.
        // Index idx_properties_arbeitsliste_marge (kanton, marge_chf).
        db().from('properties').select('id, address, gemeinde, zone, area, hnf_delta, marge_chf, baujahr')
          .eq('kanton', current).eq('ausgeschlossen', false).neq('preselection_status', 'Ausschliessen')
          .is('owner_name', null).order('marge_chf', { ascending: false, nullsFirst: false }).limit(3),
      ]);
      const heisse: Heiss[] = ((heiss.data ?? []) as { id: string; titel: string; begruendung: string | null; prioritaet: number | null; zustand: string; gelegenheit_parzelle?: { rolle: string; properties: { gemeinde: string | null } | null }[] }[])
        .map(g => ({ ...g, gemeinde: g.gelegenheit_parzelle?.find(p => p.rolle === 'ausloeser')?.properties?.gemeinde ?? null }));
      return { vorhaben, vorhabenNeu, bgNeu, bgBestand, gelOffen, gelNeu, faellig, anfragen, heisse, objekte: (objekte.data ?? []) as Objekt[] };
    },
    staleTime: 60 * 1000,
  });

  // CALC YOU LATER: was zwischen Einreichen und Versand liegt, muss in
  // einem Tag durch -- darum steht es hier, wo jeder den Tag beginnt.
  // Dieselbe kleine Abfrage wie im Reiter; fehlt sie, bleibt die Zeile weg.
  const calc = useQuery({ queryKey: ['kalkulationen'], queryFn: kalkulationenLaden, staleTime: 60 * 1000, retry: 0 });
  // Anrufen (22. November, Julian: «die welche System sagt gut und ich dann
  // Namen gespeichert habe, da soll dann Tim anrufen»): Marge gerechnet,
  // Eigentümer von Hand eingetragen, noch kein Gespräch (lib/anrufen.ts).
  const anrufen = useQuery({
    queryKey: ['anrufen'], staleTime: 60 * 1000, retry: 0,
    queryFn: async (): Promise<Anruf[]> => {
      // Zuletzt Bearbeitetes zuerst: so stehen die eben von der Startseite
      // eingetragenen oben (22. November: vier Zürcher Objekte, Stand «Neu»).
      // Ohne Stand «Exportiert»: diese gingen in der alten Akquise schon
      // ins Verkaufsgespräch. Teilindex idx_properties_mit_eigentuemer
      // (118 Zeilen am 22. November).
      const r = await db().from('properties').select('id, address, gemeinde, owner_name, owner_phone, owner_address, marge_chf')
        .not('owner_name', 'is', null).neq('status', 'Exportiert').eq('ausgeschlossen', false).neq('preselection_status', 'Ausschliessen')
        .gt('marge_chf', 0).order('updated_at', { ascending: false }).limit(40);
      if (r.error || !r.data?.length) return [];
      const g = await db().from('anruf').select('parzelle_id').in('parzelle_id', r.data.map((z: Anruf) => z.id));
      return anrufListe(r.data, (g.data ?? []).map((x: { parzelle_id: string }) => x.parzelle_id));
    },
  });
  const zuRufen = anrufen.data ?? [];
  const wartend = (calc.data ?? []).filter(k => !k.test && UNTERWEGS.includes(k.zustand));
  // Wer entscheidet, sieht beim Öffnen zuerst, was auf ihn wartet (22.
  // November): angebot_darf ist nur für das eingetragene Konto wahr, sobald
  // jemand mit Konto die Rolle hat (Tim, «Entscheidet und verschickt»).
  const entscheider = useQuery({
    queryKey: ['angebot-darf', 'visum'], staleTime: 10 * 60 * 1000, retry: 0,
    queryFn: async () => {
      const r = await db().rpc('angebot_darf', { p_rolle: 'visum' });
      return r.error ? false : Boolean(r.data);
    },
  });
  const fuerMich = entscheider.data ? wartend.filter(k => k.zustand === 'pruefung' || k.zustand === 'angebot').length : 0;
  const zuSpaet = wartend.filter(k => uhr(k)?.ueberfaellig).length;

  const maxPrio = Math.max(1, ...(data?.heisse ?? []).map(h => Number(h.prioritaet) || 0));
  const FARBEN = ['heiss', 'akzent', 'gruen', 'heiss'] as const;

  const entwuerfe = (calc.data ?? []).filter(k => !k.test && k.zustand === 'entwurf').length;
  const gesendet = (calc.data ?? []).filter(k => !k.test && k.zustand === 'gesendet' && k.gesendet_am && Date.parse(k.gesendet_am) > Date.now() - 30 * 864e5).length;

  // Zwei Handlungen, die den Weg beginnen: Leads ansehen, eine Adresse rechnen.
  const aktionen = (
    <>
      <button type="button" className={`${KNOPF} px-2 text-sm`} onClick={() => onGehe('leads')}><Inbox className="h-4 w-4 shrink-0" /> Leads</button>
      <button type="button" className={`${KNOPF_HAUPT} px-2 text-sm`} onClick={() => navigate('/calc')}><Calculator className="h-4 w-4 shrink-0" /> Neue Kalkulation</button>
    </>
  );

  return (
    <Seite bild={KOPFBILD} buehne ueber={`${gruss()}${name ? `, ${name}` : ''}`} titel={fuerMich ? `${fuerMich} ${fuerMich === 1 ? 'Preis wartet' : 'Preise warten'} auf deine Entscheidung`
      : entscheider.data && zuRufen.length ? `${zuRufen.length} ${zuRufen.length === 1 ? 'Eigentümer wartet' : 'Eigentümer warten'} auf deinen Anruf`
      : data ? satzDesTages({ ...data, kalkSpaet: zuSpaet, kalkWartend: wartend.length }) : ' '}
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
      <Weg schritte={[
        { titel: 'Leads', unter: 'Anrufen und erfassen', zahl: data?.anfragen ?? null, onClick: () => onGehe('leads') },
        { titel: 'Kalkulieren', unter: 'Entwürfe fertig rechnen', zahl: calc.data ? entwuerfe : null, onClick: () => navigate('/calc?liste=entwuerfe') },
        { titel: 'Tim entscheidet', unter: zuSpaet ? `${zuSpaet} überfällig` : 'Preis festlegen, verschicken', zahl: calc.data ? wartend.length : null, dringend: zuSpaet > 0, onClick: () => navigate('/calc') },
        { titel: 'Gesendet', unter: 'Angebote, 30 Tage', zahl: calc.data ? gesendet : null, onClick: () => navigate('/calc?liste=gesendet') },
      ]} />
      {data && (
        <div className="space-y-6">
          {zuRufen.length > 0 && (
            <Abschnitt titel="Anrufen" zahl={zuRufen.length} unter="Marge gerechnet, Eigentümer eingetragen, noch kein Gespräch"
                       hinweis="Ein Tipp auf den Namen öffnet das Objekt; dort unter «Gespräche» erfassen, wie es lief. Dann verschwindet es von hier.">
              <ul className={LISTE}>
                {zuRufen.slice(0, 8).map(o => (
                  <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <button type="button" onClick={() => setzen({ parzelle: o.id })} className="min-h-11 min-w-0 text-left">
                      <span className="block truncate font-medium">{o.owner_name}</span>
                      <span className="block truncate text-sm text-muted-foreground">{[o.address, o.gemeinde].filter(Boolean).join(', ')} · Marge {mio(o.marge_chf)}</span>
                    </button>
                    {o.owner_phone
                      ? <a className={`${KNOPF_HAUPT} shrink-0`} href={telLink(o.owner_phone)} aria-label={`${o.owner_name} anrufen`}><Phone className="h-4 w-4" /> Anrufen</a>
                      : <a className={`${KNOPF} shrink-0`} target={FENSTER.suche} aria-label={`Nummer von ${o.owner_name} suchen`}
                           href={`https://tel.search.ch/?was=${encodeURIComponent(o.owner_name)}&wo=${encodeURIComponent(woSuchen(o))}`}><Phone className="h-4 w-4" /> Nummer suchen</a>}
                  </li>
                ))}
              </ul>
            </Abschnitt>
          )}
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
