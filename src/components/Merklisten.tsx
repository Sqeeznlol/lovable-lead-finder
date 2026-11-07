import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileSpreadsheet, Printer, Trash2 } from 'lucide-react';
import { TrefferKarte } from '@/components/TrefferKarte';
import { supabase } from '@/integrations/supabase/client';
import { FELD, KNOPF, KNOPF_HAUPT, Leer, LISTE, Reiter, Seite } from '@/components/rahmen';
import { Auswahl } from '@/components/Auswahl';
import { useToast } from '@/hooks/use-toast';
import { useUrlSetzen, useUrlWert } from '@/hooks/use-url-wert';
import { BILD } from '@/lib/luftbild';
import { useGwrKodes } from '@/lib/parzelle-gebaeude';
import { HEIZ_GRUPPEN, heizGruppe } from '@/lib/karte3d';
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
  /** Punkt in der Parzelle (WGS84), ab Migration merkliste_stand_karte. */
  lat?: number | null; lon?: number | null;
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
    von && bis ? (von === bis ? `Baujahr ${von}` : `Baujahr ${von}–${bis}`) : von ? `Baujahr ab ${von}` : bis ? `Baujahr bis ${bis}` : null,
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

/**
 * Die Parzellen einer Merkliste, ganz (alle Spalten), für den
 * Akquise-Modus. In Paketen: 500 Kennungen in einer Adresse wären zu lang.
 */
export async function merklisteParzellen(liste: string) {
  const e = await db.from('merkliste_eintrag').select('parzelle_id').eq('liste_id', liste);
  if (e.error) throw new Error(e.error.message);
  const ids = [...new Set((e.data as { parzelle_id: string | null }[]).map(x => x.parzelle_id).filter(Boolean) as string[])];
  const pakete: string[][] = [];
  for (let i = 0; i < ids.length; i += 150) pakete.push(ids.slice(i, i + 150));
  const r = await Promise.all(pakete.map(pk => supabase.from('properties').select('*').in('id', pk)));
  const f = r.find(x => x.error);
  if (f?.error) throw new Error(f.error.message);
  return r.flatMap(x => x.data ?? []);
}

/** Eine Zeile mit Häkchen, wie in der Suche und in der Liste. */
export function GebaeudeZeile({ t, eigentuemer, markiert, onMarkieren, onOeffnen, art, heizung, unten }: {
  t: Treffer; eigentuemer: string | null | undefined; markiert?: boolean; onMarkieren?: () => void; onOeffnen: () => void;
  art: string | null; heizung: string | null;
  /** Unter der Zeile, z.B. Stand und Notiz in der Merkliste. */
  unten?: ReactNode;
}) {
  return (
    <li className={markiert ? 'bg-accent/[0.06]' : ''}>
    <div className="flex items-stretch">
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
    </div>
    {unten && <div className={`pb-4 pr-5 ${onMarkieren ? 'pl-14' : 'pl-5'}`}>{unten}</div>}
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
      {/* Ohne die Tabelle (Migration merkliste noch nicht eingespielt) kam
          hier die rohe Meldung der Datenbank. */}
      {error ? <p className="text-sm text-muted-foreground">{/schema cache|does not exist/i.test(error instanceof Error ? error.message : '') ? 'Listen sind auf dem Server noch nicht eingerichtet.' : `Listen nicht geladen: ${error instanceof Error ? error.message : String(error)}`}</p>
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

export type Eintrag = Treffer & {
  eigentuemer: string | null;
  // Ab Migration merkliste_stand_karte; davor fehlen sie (= offen).
  stand?: string | null; notiz?: string | null; stand_am?: string | null; telefon_bekannt?: boolean | null; parzelle_status?: string | null;
};

export function kennzahlenVon(d: Eintrag[]) {
  const bj = d.map(t => t.baujahr).filter((x): x is number => x != null);
  return {
    gebaeude: d.length,
    baujahr: bj.length ? Math.round(bj.reduce((a, b) => a + b, 0) / bj.length) : null,
    fossil: d.filter(t => t.heizung_energie === 7520 || t.heizung_energie === 7530).length,
    eigner: d.filter(t => t.eigentuemer).length,
    angesprochen: d.filter(t => t.stand && t.stand !== 'offen').length,
  };
}

/**
 * Drucken bzw. als PDF sichern. Der Dateiname des PDF ist der Titel der
 * Seite -- darum für den Druck der Name, den man eingegeben hat, danach
 * wieder der alte.
 */
export function pdfDrucken(name: string) {
  const alt = document.title;
  document.title = name.trim() || 'Gebäude';
  const zurueck = () => { document.title = alt; window.removeEventListener('afterprint', zurueck); };
  window.addEventListener('afterprint', zurueck);
  window.print();
}

/**
 * Wie weit man bei einem Gebäude der Liste ist (Spalte stand in
 * merkliste_eintrag). Eigene Werte, nicht properties.status -- jener
 * steuert Akquise-Modus und Pipedrive-Export.
 */
export const STAENDE = [
  { wert: 'offen', titel: 'Offen' },
  { wert: 'brief', titel: 'Brief geschickt' },
  { wert: 'angerufen', titel: 'Angerufen' },
  { wert: 'interesse', titel: 'Interesse' },
  { wert: 'termin', titel: 'Termin' },
  { wert: 'kein_interesse', titel: 'Kein Interesse' },
] as const;
export const standTitel = (s: string | null | undefined) => STAENDE.find(x => x.wert === (s ?? 'offen'))?.titel ?? 'Offen';

/** Stand und Notiz unter einer Zeile der Liste; speichert sofort bzw. beim Verlassen des Felds. */
function StandUndNotiz({ t, onSpeichern }: { t: Eintrag; onSpeichern: (w: { stand?: string; notiz?: string | null }) => Promise<boolean> }) {
  const [notiz, setNotiz] = useState(t.notiz ?? '');
  useEffect(() => { setNotiz(t.notiz ?? ''); }, [t.notiz]);
  const notizSichern = () => { if ((t.notiz ?? '') !== notiz.trim()) void onSpeichern({ notiz: notiz.trim() || null }); };
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Auswahl label={`Stand ${t.adresse ?? t.egid}`} klein wert={t.stand ?? 'offen'} setWert={w => void onSpeichern({ stand: w })}
        className="w-full sm:w-[190px]" optionen={STAENDE.map(x => ({ wert: x.wert, titel: x.titel }))} />
      <input className={`${FELD} h-10 w-full flex-1 text-sm`} value={notiz} maxLength={2000} placeholder="Notiz, z.B. Rückruf am Montag"
             aria-label={`Notiz ${t.adresse ?? t.egid}`} onChange={e => setNotiz(e.target.value)} onBlur={notizSichern}
             onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
      {t.stand_am && <span className="shrink-0 text-xs text-muted-foreground">{new Date(t.stand_am).toLocaleDateString('de-CH')}</span>}
    </div>
  );
}

/** Eine gespeicherte Liste: heutige Werte, Stand je Gebäude, Karte, Excel, PDF. */
export function MerklisteAnsicht({ id }: { id: string }) {
  const setzen = useUrlSetzen();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: kodes } = useGwrKodes();
  const { data: listen } = useMerklisten();
  const [ansicht] = useUrlWert('ansicht', 'liste');
  const [standFilter] = useUrlWert('stand');
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
  const kennzahlen = useMemo(() => kennzahlenVon(data ?? []), [data]);
  const sichtbar = useMemo(() => (data ?? []).filter(t => !standFilter || (t.stand ?? 'offen') === standFilter), [data, standFilter]);
  const zaehler = useMemo(() => new Map(STAENDE.map(x => [x.wert, (data ?? []).filter(t => (t.stand ?? 'offen') === x.wert).length])), [data]);

  // Sofort im Bildschirm, dann in die Datenbank; geht es nicht, kommt der
  // alte Stand zurück und eine Meldung.
  const eintragSpeichern = async (egid: number, w: { stand?: string; notiz?: string | null }) => {
    const alt = qc.getQueryData<Eintrag[]>(['merkliste', id]);
    const aenderung = { ...w, ...(w.stand ? { stand_am: new Date().toISOString() } : {}) };
    qc.setQueryData<Eintrag[]>(['merkliste', id], d => d?.map(t => (t.egid === egid ? { ...t, ...aenderung } : t)));
    const r = await db.from('merkliste_eintrag').update(aenderung).eq('liste_id', id).eq('egid', egid);
    if (r.error) {
      qc.setQueryData(['merkliste', id], alt);
      toast({ title: 'Nicht gespeichert', description: /stand|notiz|column/i.test(r.error.message) ? 'Stand und Notiz brauchen die Migration merkliste_stand_karte.' : r.error.message, variant: 'destructive' });
      return false;
    }
    return true;
  };
  const drucken = () => pdfDrucken(liste?.name ?? 'Merkliste');
  const exportieren = () => data && downloadXlsx(`${(liste?.name ?? 'merkliste').replace(/[^\wäöüÄÖÜ-]+/g, '-')}-${exportTimestamp()}.xlsx`, 'Gebäude', data.map(t => ({
    Adresse: t.adresse, Gemeinde: t.gemeinde, Eigentümer: t.eigentuemer ?? '', Stand: standTitel(t.stand), Notiz: t.notiz ?? '', EGRID: t.egrid, EGID: t.egid, Gebäudeart: art(t), Baujahr: t.baujahr,
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
  const alle = !!sichtbar.length && sichtbar.every(t => markiert.has(t.egid));

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
            { titel: 'Eigentümer bekannt', wert: n(kennzahlen.eigner) },
            { titel: 'Angesprochen', wert: n(kennzahlen.angesprochen) },
            { titel: 'Öl oder Gas', wert: n(kennzahlen.fossil) },
          ] : undefined}
          aktionen={<>
            <button type="button" onClick={drucken} disabled={!data?.length} className={`${KNOPF_HAUPT} disabled:opacity-50`}><Printer className="h-4 w-4" /> Als PDF</button>
            <button type="button" onClick={exportieren} disabled={!data?.length} className={`${KNOPF} disabled:opacity-50`}><FileSpreadsheet className="h-4 w-4" /> Als Excel</button>
          </>}
          seite={<MerklistenSpalte aktiv={id} />}>
          {/* Eigentümer abfragen geht in Bauraum Akquise, einem eigenen
              Programm (seit 7. November): dort /akquise?merkliste=<id>. */}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setzen({ liste: null, ansicht: null, stand: null })} className={KNOPF}><ArrowLeft className="h-4 w-4" /> Zur Suche</button>
            <Reiter wahl={ansicht as 'liste' | 'karte'} setWahl={w => setzen({ ansicht: w === 'liste' ? null : w })}
              optionen={[{ wert: 'liste', titel: 'Liste' }, { wert: 'karte', titel: 'Karte' }]} />
            {!!data?.length && (
              <Auswahl label="Nach Stand" wert={standFilter ?? ''} setWert={w => setzen({ stand: w || null })} className="min-w-[180px]"
                optionen={[{ wert: '', titel: `Alle Stände (${n(data.length)})` }, ...STAENDE.filter(x => zaehler.get(x.wert)).map(x => ({ wert: x.wert, titel: `${x.titel} (${n(zaehler.get(x.wert))})` }))]} />
            )}
            {!!sichtbar.length && (
              <button type="button" onClick={() => setMarkiert(alle ? new Set() : new Set(sichtbar.map(t => t.egid)))} className={KNOPF}>
                {alle ? 'Keine markieren' : 'Alle markieren'}
              </button>
            )}
            {markiert.size > 0 && <button type="button" onClick={entfernen} className={KNOPF}><Trash2 className="h-4 w-4" /> {n(markiert.size)} entfernen</button>}
            {liste && <button type="button" onClick={loeschen} className={`${KNOPF} sm:ml-auto`}>Liste löschen</button>}
          </div>
          {error ? <Leer titel="Die Liste ging nicht auf.">{error instanceof Error ? error.message : String(error)}</Leer>
            : !data ? <Leer titel="Lädt …" />
            : !data.length ? <Leer titel="Die Liste ist leer." />
            : ansicht === 'karte' ? (
              <TrefferKarte markiert={markiert} onMarkieren={umschalten}
                treffer={sichtbar.map(t => ({ egid: t.egid, adresse: t.adresse, lat: t.lat, lon: t.lon, baujahr: t.baujahr, eigentuemer: t.eigentuemer, heizung: heizung(t), zusatz: standTitel(t.stand) }))} />
            )
            : !sichtbar.length ? <Leer titel="Kein Gebäude mit diesem Stand." />
            : (
              <ul className={LISTE}>
                {sichtbar.map(t => (
                  <GebaeudeZeile key={t.egid} t={t} eigentuemer={t.eigentuemer} art={art(t)} heizung={heizung(t)}
                    markiert={markiert.has(t.egid)} onMarkieren={() => umschalten(t.egid)} onOeffnen={() => setzen({ parzelle: t.parzelle_id })}
                    unten={<StandUndNotiz t={t} onSpeichern={w => eintragSpeichern(t.egid, w)} />} />
                ))}
              </ul>
            )}
        </Seite>
      </div>
      {liste && data && <GebaeudeDruck name={liste.name} ueber="Merkliste" zeilen={data} art={art} heizung={heizung} mitStand
        unterzeile={[filterText(liste.filter), `gespeichert am ${datum(liste.erstellt_am)}`].filter(Boolean).join(' · ')} />}
    </>
  );
}

/**
 * Das PDF: auf dem Bildschirm unsichtbar, beim Drucken das Einzige
 * (Regel .bericht-druck in index.css). Aufgebaut wie jede Seite
 * (DESIGN.md): Luftbild-Bühne mit dem Namen der Liste, Kennzahlenleiste,
 * eine Tafel mit Grafik (Heizungen), dann die Gebäude.
 *
 * print-color-adjust: exact, weil der Browser sonst Verläufe und
 * Farbflächen weglässt, solange "Hintergrundgrafiken" aus ist -- und
 * das ist die Voreinstellung.
 */
const EXAKT = { WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as const;

export function GebaeudeDruck({ name, ueber, unterzeile, zeilen, art, heizung, mitStand = false }: {
  name: string; ueber: string; unterzeile: string; zeilen: Eintrag[]; mitStand?: boolean;
  art: (t: Treffer) => string | null; heizung: (t: Treffer) => string | null;
}) {
  const kennzahlen = kennzahlenVon(zeilen);
  const zahlen: [string, string, string?][] = [
    ['Gebäude', n(kennzahlen.gebaeude)],
    ['Baujahr im Schnitt', kennzahlen.baujahr ? String(kennzahlen.baujahr) : '–'],
    ['Öl oder Gas', n(kennzahlen.fossil), kennzahlen.gebaeude ? `${Math.round((100 * kennzahlen.fossil) / kennzahlen.gebaeude)} %` : undefined],
    ['Eigentümer bekannt', n(kennzahlen.eigner)],
  ];
  // Heizungen nach Gruppe, grösste zuerst -- der Balken zeigt auf einen
  // Blick, wo Ersatz ansteht.
  const mix = HEIZ_GRUPPEN.map(g => ({ ...g, zahl: zeilen.filter(t => heizGruppe(heizung(t))?.titel === g.titel).length }))
    .filter(g => g.zahl > 0).sort((a, b) => b.zahl - a.zahl);
  const ohne = zeilen.length - mix.reduce((a, g) => a + g.zahl, 0);
  const heute = new Date().toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <div className="bericht-druck hidden bg-white font-sans text-[#111] print:block" style={EXAKT}>
      {/* Bühne */}
      <div className="relative h-[190px] overflow-hidden rounded-[3px] bg-[#F4F4F5]" style={EXAKT}>
        <img src={BILD.gebaeudesuche} alt="" loading="eager" className="absolute inset-y-0 right-0 h-full w-[70%] object-cover" />
        <div className="absolute inset-0" style={{ ...EXAKT, background: 'linear-gradient(90deg, #F4F4F5 0%, #F4F4F5 32%, rgba(244,244,245,0.85) 55%, rgba(244,244,245,0) 100%)' }} />
        <div className="relative flex h-full flex-col justify-between p-6">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[#646B78]">
            <span className="inline-block h-2 w-2 rounded-[1px] bg-[#3D45F5]" style={EXAKT} />
            Bauraum · {ueber}
          </div>
          <div>
            <h1 className="max-w-[70%] text-[34px] font-normal leading-[1.05] tracking-tight">{name}</h1>
            <p className="mt-2 max-w-[70%] text-[11px] text-[#646B78]">{[unterzeile, `Stand ${heute}`].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <span className="absolute bottom-1.5 right-2.5 text-[7px] text-[#646B78]">Luftbild © swisstopo</span>
      </div>

      {/* Kennzahlenleiste */}
      <div className="mt-4 grid grid-cols-4 rounded-[3px] border border-[#E4E4E7]">
        {zahlen.map(([t, w, marke], i) => (
          <div key={t} className={`px-4 py-3 ${i ? 'border-l border-[#E4E4E7]' : ''}`}>
            <p className="text-[9.5px] text-[#646B78]">{t}</p>
            <p className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-[24px] leading-none tracking-tight tabular-nums">{w}</span>
              {marke && <span className="rounded-[2px] bg-[#FDEBDF] px-1.5 py-0.5 text-[8.5px] font-medium text-[#C4520F]" style={EXAKT}>{marke}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* Tafel mit Grafik: Heizungen */}
      {mix.length > 0 && (
        <div className="mt-4 rounded-[3px] border border-[#E4E4E7] px-4 py-3">
          <p className="text-[10.5px] font-medium">Heizungen</p>
          <div className="mt-2 flex h-2.5 overflow-hidden rounded-[2px] bg-[#F4F4F5]" style={EXAKT}>
            {mix.map(g => <span key={g.titel} style={{ ...EXAKT, width: `${(100 * g.zahl) / zeilen.length}%`, background: g.farbe }} />)}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9.5px] text-[#646B78]">
            {mix.map(g => (
              <span key={g.titel} className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ ...EXAKT, background: g.farbe }} />
                <span className="text-[#111]">{g.titel}</span> {n(g.zahl)}
              </span>
            ))}
            {ohne > 0 && <span>ohne Angabe {n(ohne)}</span>}
          </div>
        </div>
      )}

      {/* Die Gebäude */}
      <table className="mt-5 w-full border-collapse text-[9.5px] leading-snug">
        <thead>
          <tr className="border-b border-[#111] text-left text-[8.5px] text-[#646B78]">
            <th className="w-6 py-1.5 pr-2 font-normal tabular-nums">#</th>
            <th className="py-1.5 pr-3 font-normal">Adresse</th>
            <th className="py-1.5 pr-3 font-normal">Eigentümer</th>
            <th className="py-1.5 pr-3 text-right font-normal">Baujahr</th>
            <th className="py-1.5 pr-3 text-right font-normal">Zimmer</th>
            <th className="py-1.5 pr-3 text-right font-normal">Fläche</th>
            <th className="py-1.5 pr-3 text-right font-normal">Whg.</th>
            <th className="py-1.5 pr-3 text-right font-normal">Gesch.</th>
            <th className="py-1.5 font-normal">Heizung</th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map((t, i) => {
            const g = heizGruppe(heizung(t));
            return (
              <tr key={t.egid} className="break-inside-avoid border-b border-[#ECECEE] align-top">
                <td className="py-2 pr-2 text-[#9A9FA8] tabular-nums">{i + 1}</td>
                <td className="py-2 pr-3"><span className="font-medium">{t.adresse ?? `EGRID ${t.egrid}`}</span><br /><span className="text-[#646B78]">{[t.gemeinde, art(t)].filter(Boolean).join(' · ')}</span>
                  {/* Wie im Excel: die Nummern, mit denen man die Parzelle im Grundbuch und im Register findet. */}
                  <br /><span className="text-[8px] tracking-wide text-[#9A9FA8]">EGRID {t.egrid} · EGID {t.egid}</span></td>
                <td className="py-2 pr-3">{t.eigentuemer ?? <span className="text-[#9A9FA8]">noch offen</span>}
                  {/* Aus der Merkliste: wie weit man ist, und die Notiz. */}
                  {mitStand && <span className="mt-0.5 block text-[8.5px] text-[#646B78]"><span className="font-medium text-[#111]">{standTitel(t.stand)}</span>{t.notiz ? ` · ${t.notiz}` : ''}</span>}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{t.baujahr ?? '–'}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{n(t.zimmer)}</td>
                <td className="whitespace-nowrap py-2 pr-3 text-right tabular-nums">{n(t.wohnflaeche, ' m²')}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{n(t.wohnungen)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{n(t.geschosse)}</td>
                <td className="py-2">
                  {g ? <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ ...EXAKT, background: g.farbe }} />{g.titel}</span> : '–'}
                  {/* Die genaue Angabe des Registers, wenn sie mehr sagt als die Gruppe (z.B. "Erdwärmesonde"). */}
                  {g && heizung(t) && heizung(t)!.toLowerCase() !== g.titel.toLowerCase() && <span className="block pl-3.5 text-[8px] text-[#9A9FA8]">{heizung(t)}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-4 text-[8px] text-[#9A9FA8]">Quelle: Gebäude- und Wohnungsregister (GWR), eigener Bestand. Zimmer und Fläche sind die Summe aller Wohnungen eines Gebäudes.</p>
    </div>
  );
}
