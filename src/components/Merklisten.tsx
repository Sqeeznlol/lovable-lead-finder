import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileSpreadsheet, Printer, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FELD, KNOPF, KNOPF_HAUPT, Leer, LISTE, Seite } from '@/components/rahmen';
import { Auswahl } from '@/components/Auswahl';
import { useToast } from '@/hooks/use-toast';
import { useUrlSetzen } from '@/hooks/use-url-wert';
import { BILD } from '@/lib/luftbild';
import { useGwrKodes } from '@/lib/parzelle-gebaeude';
import { heizGruppe } from '@/lib/karte3d';
import { downloadXlsx, exportTimestamp } from '@/lib/export-utils';

/**
 * Merklisten der Gebäudesuche (Julian, 3. November): Treffer markieren,
 * als Liste mit Namen speichern, später wieder öffnen ("im Auge
 * behalten") und als PDF mit diesem Namen weitergeben.
 *
 * Die Liste merkt sich nur, welche Gebäude drauf sind. Baujahr, Heizung
 * und Eigentümer liest sie beim Öffnen frisch (merkliste_gebaeude) --
 * so zeigt sie, was heute gilt.
 */

export interface Treffer {
  parzelle_id: string; adresse: string | null; gemeinde: string | null; egrid: string; egid: number; klasse: number | null;
  baujahr: number | null; zimmer: number | null; wohnflaeche: number | null; wohnungen: number | null; geschosse: number | null;
  heizung_energie: number | null;
}
export type Filter = Record<string, string | null>;
interface Liste { id: string; name: string; erstellt_am: string; filter: Filter; merkliste_eintrag: { count: number }[] }

export const n = (x: number | null | undefined, e = '') => (x == null ? '–' : `${x.toLocaleString('de-CH')}${e}`);
const datum = (s: string) => new Date(s).toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' });
// Die Tabellen sind noch nicht in den erzeugten Typen; bis zum nächsten
// Erzeugen ohne Typprüfung.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Die Suche in Worten, für den Kopf der Liste und des PDF. */
export function filterText(f: Filter): string {
  const von = f.bj_von, bis = f.bj_bis, zmin = f.zi_min, zmax = f.zi_max;
  return [
    f.gemeinde,
    von && bis ? `Baujahr ${von}–${bis}` : von ? `Baujahr ab ${von}` : bis ? `Baujahr bis ${bis}` : null,
    zmin && zmax ? `${zmin}–${zmax} Zimmer` : zmin ? `ab ${zmin} Zimmer` : zmax ? `bis ${zmax} Zimmer` : null,
    f.wf_min ? `ab ${f.wf_min} m²` : null,
    f.art_titel ?? null,
  ].filter(Boolean).join(' · ');
}

export function useMerklisten() {
  return useQuery({
    queryKey: ['merklisten'],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Liste[]> => {
      const r = await db.from('merkliste').select('id, name, erstellt_am, filter, merkliste_eintrag(count)').order('erstellt_am', { ascending: false });
      if (r.error) throw new Error(r.error.message);
      return r.data as Liste[];
    },
  });
}

/** Eine Zeile mit Häkchen, wie in der Suche und in der Liste. */
export function GebaeudeZeile({ t, eigentuemer, markiert, onMarkieren, onOeffnen, art, heizung }: {
  t: Treffer; eigentuemer: string | null | undefined; markiert?: boolean; onMarkieren?: () => void; onOeffnen: () => void;
  art: string | null; heizung: string | null;
}) {
  return (
    <li className={`flex items-stretch ${markiert ? 'bg-accent/[0.06]' : ''}`}>
      {onMarkieren && (
        // Eigenes Feld links, 44 px breit: ein Tipp aufs Häkchen markiert,
        // ein Tipp auf die Zeile öffnet die Parzelle -- nicht beides.
        <label className="flex w-12 shrink-0 cursor-pointer items-center justify-center pl-2">
          <input type="checkbox" checked={!!markiert} onChange={onMarkieren} aria-label={`${t.adresse ?? t.egrid} markieren`}
                 className="h-5 w-5 cursor-pointer accent-accent" />
        </label>
      )}
      <button type="button" onClick={onOeffnen}
              className={`grid min-w-0 flex-1 grid-cols-1 gap-2 py-4 pr-5 text-left hover:bg-secondary/60 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${onMarkieren ? 'pl-2' : 'pl-5'}`}>
        <span className="min-w-0">
          <span className="block truncate font-medium">{t.adresse ?? `EGRID ${t.egrid}`}</span>
          <span className="block truncate text-sm text-muted-foreground">
            {[t.gemeinde, art, heizGruppe(heizung)?.titel].filter(Boolean).join(' · ')}
          </span>
          <span className="block truncate text-sm">{eigentuemer ?? <span className="text-muted-foreground">Eigentümer noch nicht abgefragt</span>}</span>
        </span>
        <span className="grid grid-cols-4 gap-4 text-sm tabular-nums sm:text-right">
          <span><span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Baujahr</span>{t.baujahr ?? '–'}</span>
          <span><span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Zimmer</span>{n(t.zimmer)}</span>
          <span><span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Fläche</span>{n(t.wohnflaeche, ' m²')}</span>
          <span><span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Whg.</span>{n(t.wohnungen)}</span>
        </span>
      </button>
    </li>
  );
}

/**
 * Speichern: als neue Liste mit Namen oder zu einer bestehenden dazu.
 * Gespeichert wird, was markiert ist -- ist nichts markiert, alle Treffer
 * (Julian: "entweder alle, die ich gesucht habe, oder die, die ich
 * markiere").
 */
export function Speichern({ treffer, filter, onFertig }: { treffer: Treffer[]; filter: Filter; onFertig: (id: string) => void }) {
  const { data: listen } = useMerklisten();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [ziel, setZiel] = useState('');
  const [name, setName] = useState(() => filterText(filter) || 'Neue Liste');
  const [laeuft, setLaeuft] = useState(false);
  const speichern = async () => {
    if (!ziel && !name.trim()) return;
    setLaeuft(true);
    try {
      let id = ziel;
      if (!id) {
        const r = await db.from('merkliste').insert({ name: name.trim(), filter }).select('id').single();
        if (r.error) throw new Error(r.error.message);
        id = r.data.id;
      }
      const zeilen = treffer.map(t => ({ liste_id: id, egid: t.egid, parzelle_id: t.parzelle_id }));
      for (let i = 0; i < zeilen.length; i += 500) {
        // Schon drauf: stehen lassen, nicht doppelt und kein Fehler.
        const r = await db.from('merkliste_eintrag').upsert(zeilen.slice(i, i + 500), { onConflict: 'liste_id,egid', ignoreDuplicates: true });
        if (r.error) throw new Error(r.error.message);
      }
      await qc.invalidateQueries({ queryKey: ['merklisten'] });
      await qc.invalidateQueries({ queryKey: ['merkliste', id] });
      toast({ title: `${n(treffer.length)} Gebäude gespeichert` });
      onFertig(id);
    } catch (e) {
      toast({ title: 'Nicht gespeichert', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setLaeuft(false);
    }
  };
  return (
    <div className="flex flex-wrap items-end gap-2 rounded border bg-card p-4">
      <div className="min-w-[200px] flex-1 sm:flex-none">
        <span className="mb-1 block text-xs text-muted-foreground">Speichern in</span>
        <Auswahl label="Liste" wert={ziel} setWert={setZiel} className="w-full sm:w-[240px]"
          optionen={[{ wert: '', titel: 'Neue Liste' }, ...(listen ?? []).map(l => ({ wert: l.id, titel: l.name }))]} />
      </div>
      {!ziel && (
        <label className="block min-w-[200px] flex-[2]">
          <span className="mb-1 block text-xs text-muted-foreground">Name der Liste (steht auf dem PDF)</span>
          <input className={`${FELD} w-full`} value={name} maxLength={120} autoFocus onChange={e => setName(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && speichern()} />
        </label>
      )}
      <button type="button" onClick={speichern} disabled={laeuft || (!ziel && !name.trim())} className={`${KNOPF_HAUPT} disabled:opacity-50`}>
        {laeuft ? 'Speichert …' : `${n(treffer.length)} Gebäude speichern`}
      </button>
    </div>
  );
}

/** Die gespeicherten Listen, für die rechte Spalte der Suche. */
export function MerklistenSpalte({ aktiv }: { aktiv?: string | null }) {
  const setzen = useUrlSetzen();
  const { data, error } = useMerklisten();
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Meine Listen</p>
      {error ? <p className="text-sm text-muted-foreground">Listen nicht geladen: {error instanceof Error ? error.message : String(error)}</p>
        : !data ? <p className="text-sm text-muted-foreground">Lädt …</p>
        : !data.length ? <p className="text-sm text-muted-foreground">Noch keine. Treffer markieren und speichern, dann stehen sie hier.</p>
        : (
          <ul className={LISTE}>
            {data.map(l => (
              <li key={l.id}>
                <button type="button" onClick={() => setzen({ liste: l.id })}
                        className={`block min-h-11 w-full px-4 py-3 text-left hover:bg-secondary/60 ${aktiv === l.id ? 'bg-secondary' : ''}`}>
                  <span className="block truncate font-medium">{l.name}</span>
                  <span className="block text-sm text-muted-foreground">{n(l.merkliste_eintrag?.[0]?.count ?? 0)} Gebäude · {datum(l.erstellt_am)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

type Eintrag = Treffer & { eigentuemer: string | null };

/** Eine gespeicherte Liste: heutige Werte, Excel, PDF, Einträge entfernen. */
export function MerklisteAnsicht({ id }: { id: string }) {
  const setzen = useUrlSetzen();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: kodes } = useGwrKodes();
  const { data: listen } = useMerklisten();
  const liste = listen?.find(l => l.id === id);
  const { data, error } = useQuery({
    queryKey: ['merkliste', id],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Eintrag[]> => {
      const r = await db.rpc('merkliste_gebaeude', { p_liste: id });
      if (r.error) throw new Error(r.error.message);
      return r.data as Eintrag[];
    },
  });
  const [markiert, setMarkiert] = useState<Set<number>>(new Set());
  const heizung = (t: Treffer) => (t.heizung_energie == null ? null : kodes?.get(`GENH:${t.heizung_energie}`) ?? `Code ${t.heizung_energie}`);
  const art = (t: Treffer) => (t.klasse == null ? null : kodes?.get(`GKLAS:${t.klasse}`) ?? null);
  const kennzahlen = useMemo(() => {
    const d = data ?? [];
    const bj = d.map(t => t.baujahr).filter((x): x is number => x != null);
    const fossil = d.filter(t => t.heizung_energie === 7520 || t.heizung_energie === 7530).length;
    return {
      gebaeude: d.length,
      baujahr: bj.length ? Math.round(bj.reduce((a, b) => a + b, 0) / bj.length) : null,
      fossil,
      eigner: d.filter(t => t.eigentuemer).length,
    };
  }, [data]);

  // Der Dateiname des PDF ist der Titel der Seite -- darum für den Druck
  // den Namen der Liste, danach wieder den alten.
  const drucken = () => {
    const alt = document.title;
    document.title = liste?.name ?? 'Merkliste';
    const zurueck = () => { document.title = alt; window.removeEventListener('afterprint', zurueck); };
    window.addEventListener('afterprint', zurueck);
    window.print();
  };
  const exportieren = () => data && downloadXlsx(`${(liste?.name ?? 'merkliste').replace(/[^\wäöüÄÖÜ-]+/g, '-')}-${exportTimestamp()}.xlsx`, 'Gebäude', data.map(t => ({
    Adresse: t.adresse, Gemeinde: t.gemeinde, Eigentümer: t.eigentuemer ?? '', EGRID: t.egrid, EGID: t.egid, Gebäudeart: art(t), Baujahr: t.baujahr,
    Zimmer: t.zimmer, 'Wohnfläche m²': t.wohnflaeche, Wohnungen: t.wohnungen, Geschosse: t.geschosse, Heizung: heizung(t),
  })));
  const entfernen = async () => {
    const r = await db.from('merkliste_eintrag').delete().eq('liste_id', id).in('egid', [...markiert]);
    if (r.error) { toast({ title: 'Nicht entfernt', description: r.error.message, variant: 'destructive' }); return; }
    setMarkiert(new Set());
    await qc.invalidateQueries({ queryKey: ['merkliste', id] });
    await qc.invalidateQueries({ queryKey: ['merklisten'] });
  };
  const loeschen = async () => {
    if (!window.confirm(`Liste "${liste?.name}" löschen?`)) return;
    const r = await db.from('merkliste').delete().eq('id', id);
    if (r.error) { toast({ title: 'Nicht gelöscht', description: r.error.message, variant: 'destructive' }); return; }
    await qc.invalidateQueries({ queryKey: ['merklisten'] });
    setzen({ liste: null });
  };
  const umschalten = (egid: number) => setMarkiert(m => { const x = new Set(m); if (x.has(egid)) x.delete(egid); else x.add(egid); return x; });
  const alle = !!data?.length && markiert.size === data.length;

  // Nach dem Speichern stand man sonst mitten auf der Seite, wo vorher
  // die Treffer waren (iPhone, 3. November) -- die Liste beginnt oben.
  useEffect(() => { window.scrollTo(0, 0); }, [id]);
  // Nach dem Löschen eines Eintrags fallen nicht mehr vorhandene Häkchen weg.
  useEffect(() => { if (data) setMarkiert(m => new Set([...m].filter(e => data.some(t => t.egid === e)))); }, [data]);

  return (
    <>
      <div className="print:hidden">
        <Seite bild={BILD.gebaeudesuche} ueber={`Merkliste · gespeichert am ${liste ? datum(liste.erstellt_am) : '…'}`}
          titel={liste?.name ?? (listen ? 'Liste nicht gefunden' : 'Lädt …')}
          unter={liste ? filterText(liste.filter) || 'Aus der Gebäudesuche.' : undefined}
          kennzahlen={data ? [
            { titel: 'Gebäude', wert: n(kennzahlen.gebaeude) },
            // "um": eine reine Zahl bekäme in der Leiste ein Tausender-Apostroph (1'947).
            { titel: 'Baujahr im Schnitt', wert: kennzahlen.baujahr ? `um ${kennzahlen.baujahr}` : '–' },
            { titel: 'Öl oder Gas', wert: n(kennzahlen.fossil) },
            { titel: 'Eigentümer bekannt', wert: n(kennzahlen.eigner) },
          ] : undefined}
          aktionen={<>
            <button type="button" onClick={drucken} disabled={!data?.length} className={`${KNOPF_HAUPT} disabled:opacity-50`}><Printer className="h-4 w-4" /> Als PDF</button>
            <button type="button" onClick={exportieren} disabled={!data?.length} className={`${KNOPF} disabled:opacity-50`}><FileSpreadsheet className="h-4 w-4" /> Als Excel</button>
          </>}
          seite={<MerklistenSpalte aktiv={id} />}>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setzen({ liste: null })} className={KNOPF}><ArrowLeft className="h-4 w-4" /> Zur Suche</button>
            {!!data?.length && (
              <button type="button" onClick={() => setMarkiert(alle ? new Set() : new Set(data.map(t => t.egid)))} className={KNOPF}>
                {alle ? 'Keine markieren' : 'Alle markieren'}
              </button>
            )}
            {markiert.size > 0 && <button type="button" onClick={entfernen} className={KNOPF}><Trash2 className="h-4 w-4" /> {n(markiert.size)} entfernen</button>}
            {liste && <button type="button" onClick={loeschen} className={`${KNOPF} sm:ml-auto`}>Liste löschen</button>}
          </div>
          {error ? <Leer titel="Die Liste ging nicht auf.">{error instanceof Error ? error.message : String(error)}</Leer>
            : !data ? <Leer titel="Lädt …" />
            : !data.length ? <Leer titel="Die Liste ist leer." />
            : (
              <ul className={LISTE}>
                {data.map(t => (
                  <GebaeudeZeile key={t.egid} t={t} eigentuemer={t.eigentuemer} art={art(t)} heizung={heizung(t)}
                    markiert={markiert.has(t.egid)} onMarkieren={() => umschalten(t.egid)} onOeffnen={() => setzen({ parzelle: t.parzelle_id })} />
                ))}
              </ul>
            )}
        </Seite>
      </div>
      {liste && data && <MerklisteDruck name={liste.name} filter={liste.filter} gespeichert={liste.erstellt_am} zeilen={data}
        kennzahlen={kennzahlen} art={art} heizung={heizung} />}
    </>
  );
}

/**
 * Das PDF: auf dem Bildschirm unsichtbar, beim Drucken das Einzige
 * (Regel .bericht-druck in index.css). Gestaltet wie die Seite: Name
 * gross, feine Linien, die Zahlen als Leiste, dann die Gebäude.
 */
function MerklisteDruck({ name, filter, gespeichert, zeilen, kennzahlen, art, heizung }: {
  name: string; filter: Filter; gespeichert: string; zeilen: Eintrag[];
  kennzahlen: { gebaeude: number; baujahr: number | null; fossil: number; eigner: number };
  art: (t: Treffer) => string | null; heizung: (t: Treffer) => string | null;
}) {
  const zahlen: [string, string][] = [
    ['Gebäude', n(kennzahlen.gebaeude)],
    ['Baujahr im Schnitt', kennzahlen.baujahr ? `um ${kennzahlen.baujahr}` : '–'],
    ['Öl oder Gas', n(kennzahlen.fossil)],
    ['Eigentümer bekannt', n(kennzahlen.eigner)],
  ];
  return (
    <div className="bericht-druck hidden bg-white text-[#111] print:block">
      <div className="flex items-baseline justify-between border-b border-[#111] pb-2 text-[10px] uppercase tracking-[0.14em] text-[#555]">
        <span>Bauraum · Merkliste</span>
        <span>{new Date().toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>
      <h1 className="mt-6 text-[30px] leading-[1.1] tracking-tight">{name}</h1>
      <p className="mt-1 text-[12px] text-[#555]">{[filterText(filter), `gespeichert am ${datum(gespeichert)}`].filter(Boolean).join(' · ')}</p>
      <div className="mt-5 grid grid-cols-4 border border-[#ddd]">
        {zahlen.map(([t, w], i) => (
          <div key={t} className={`px-3 py-2.5 ${i ? 'border-l border-[#ddd]' : ''}`}>
            <p className="text-[9px] uppercase tracking-[0.1em] text-[#777]">{t}</p>
            <p className="mt-1 text-[20px] leading-none tabular-nums">{w}</p>
          </div>
        ))}
      </div>
      <table className="mt-6 w-full border-collapse text-[10px] leading-snug">
        <thead>
          <tr className="border-b border-[#111] text-left text-[8.5px] uppercase tracking-[0.1em] text-[#555]">
            <th className="py-1.5 pr-2 font-medium">Adresse</th>
            <th className="py-1.5 pr-2 font-medium">Eigentümer</th>
            <th className="py-1.5 pr-2 text-right font-medium">Baujahr</th>
            <th className="py-1.5 pr-2 text-right font-medium">Zimmer</th>
            <th className="py-1.5 pr-2 text-right font-medium">Fläche</th>
            <th className="py-1.5 font-medium">Heizung</th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map(t => (
            <tr key={t.egid} className="break-inside-avoid border-b border-[#e5e5e5] align-top">
              <td className="py-1.5 pr-2"><span className="font-medium">{t.adresse ?? `EGRID ${t.egrid}`}</span><br /><span className="text-[#777]">{[t.gemeinde, art(t)].filter(Boolean).join(' · ')}</span></td>
              <td className="py-1.5 pr-2">{t.eigentuemer ?? <span className="text-[#999]">offen</span>}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{t.baujahr ?? '–'}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{n(t.zimmer)}</td>
              <td className="whitespace-nowrap py-1.5 pr-2 text-right tabular-nums">{n(t.wohnflaeche, ' m²')}</td>
              <td className="py-1.5">{heizGruppe(heizung(t))?.titel ?? '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-[8.5px] text-[#777]">Quelle: Gebäude- und Wohnungsregister (GWR), eigener Bestand. Zimmer und Fläche sind die Summe aller Wohnungen eines Gebäudes.</p>
    </div>
  );
}
