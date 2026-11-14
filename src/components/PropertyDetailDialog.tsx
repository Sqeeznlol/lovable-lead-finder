import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUrlSetzen } from '@/hooks/use-url-wert';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { grundbuchUrl, verkauftNie, ARCHIV_STATUS } from '@/lib/grundbuch';
import { Objektansicht } from '@/components/Objektansicht';
import { Gespraeche } from '@/components/Gespraeche';
import { Nachbarn } from '@/components/Nachbarn';
import { WeitereParzellen } from '@/components/WeitereParzellen';
import { protokolliere } from '@/lib/protokoll';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, MapPin, Phone, Save, Loader2, Archive, Box } from 'lucide-react';
import { KNOPF, KNOPF_HAUPT, Marke } from '@/components/rahmen';
import { zoneKurzform } from '@/lib/potential';
import { supabase } from '@/integrations/supabase/client';
import { BaugesucheParzelle } from '@/components/BaugesucheParzelle';
import { heizungBeschreiben, useGwrKodes, useParzellenGebaeude } from '@/lib/parzelle-gebaeude';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { Tables } from '@/integrations/supabase/types';
import { FENSTER } from '@/lib/fenster';

type Property = Tables<'properties'>;

const akquiseStatuses = [
  'Neu', 'In Prüfung', 'Interessant', 'Nicht interessant', 'Eigentümer gesucht',
  'Eigentümer gefunden', 'Eigentümer ermittelt', 'Telefonnummer gesucht', 'Telefon gefunden',
  'Kontaktiert', 'Kein Interesse', 'Interesse vorhanden', 'Termin vereinbart',
  'Follow-up', 'Post', 'Exportiert', 'Archiviert',
];
const preselectionStatuses = [
  'Nicht geprüft', 'Sehr interessant', 'Potenzial vorhanden',
  'Später prüfen', 'Kein Potenzial', 'Ausschliessen',
];

interface Props {
  id: string | null;
  onClose: () => void;
}

export function PropertyDetailDialog({ id, onClose }: Props) {
  const [data, setData] = useState<Property | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const setzen = useUrlSetzen();
  const navigate = useNavigate();
  // Ohne Treffer drehte das Rad für immer (Prüfung der Abläufe).
  const [fehlt, setFehlt] = useState(false);
  // Die Gebäude der Parzelle aus dem Register (Ansicht parzelle_gebaeude);
  // die alten Felder baujahr, geschosse, wohnungen bleiben Rückfall.
  const { data: register } = useParzellenGebaeude([data?.egrid]);
  const { data: kodes } = useGwrKodes();
  const reg = data?.egrid ? register?.get(data.egrid) : undefined;

  useEffect(() => {
    if (!id) { setData(null); return; }
    setLoading(true);
    setFehlt(false);
    supabase.from('properties').select('*').eq('id', id).maybeSingle()
      .then(({ data, error }) => {
        if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
        setData(data || null);
        setFehlt(!data);
        setLoading(false);
      });
  }, [id, toast]);

  const update = (patch: Partial<Property>) => setData(d => d ? { ...d, ...patch } : d);

  /**
   * Archivieren heisst: das Objekt verschwindet aus den Arbeitslisten,
   * bleibt aber im Bestand. Verwendet wird dafür der bestehende Status
   * "Ausschliessen" -- so braucht es kein zusätzliches Feld, und die
   * Vorauswahl kennt ihn bereits.
   */
  const archivieren = async () => {
    if (!data) return;
    setSaving(true);
    const grund = verkauftNie(data.owner_name)
      ? 'Öffentliche Hand als Eigentümerin — verkauft nicht'
      : 'Von Hand archiviert';
    const { error } = await supabase
      .from('properties')
      .update({
        preselection_status: ARCHIV_STATUS,
        preselection_note: grund,
        preselection_decided_at: new Date().toISOString(),
      })
      .eq('id', data.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return;
    }
    update({ preselection_status: ARCHIV_STATUS, preselection_note: grund });
    void protokolliere('archiviert', data?.address ?? null, data?.kanton ?? null);
    toast({ title: '✓ Archiviert', description: grund });
    qc.invalidateQueries({ queryKey: ['master'] });
    qc.invalidateQueries({ queryKey: ['properties'] });
    qc.invalidateQueries({ queryKey: ['uebersicht'] });
    onClose();
  };

  const save = async () => {
    if (!data) return;
    setSaving(true);
    const { error } = await supabase
      .from('properties')
      .update({
        status: data.status,
        preselection_status: data.preselection_status,
        notes: data.notes,
        owner_name: data.owner_name,
        owner_phone: data.owner_phone,
        owner_address: data.owner_address,
        follow_up_at: data.follow_up_at,
        assigned_to: data.assigned_to,
      })
      .eq('id', data.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: '✓ Gespeichert' });

    qc.invalidateQueries({ queryKey: ['master'] });
    qc.invalidateQueries({ queryKey: ['properties'] });
    qc.invalidateQueries({ queryKey: ['uebersicht'] });
    onClose();
  };

  const ort = data ? (data.plz_ort || [data.plz, data.gemeinde].filter(Boolean).join(' ')) : '';
  const suche = data ? encodeURIComponent([data.address, ort].filter(Boolean).join(', ')) : '';
  const d = data as (Property & { eigentuemer_name?: string | null; eigentuemer_adresse?: string | null; eigentuemer_plz_ort?: string | null }) | null;
  const zahl = (v: number | null | undefined, e = '') => (v ? `${Math.round(v).toLocaleString('de-CH')}${e}` : '–');

  // Aufbau wie die Detailseite der Vorlage (DESIGN.md): links das grosse
  // Bild, Titel, Betrag in Violett und das Merkmal-Raster; rechts eine
  // Tafel für Eigentümer und Stand mit dem schwarzen Knopf.
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl overflow-y-auto rounded border-0 bg-card p-0">
        {fehlt && !loading ? (
          <div className="space-y-4 p-8 text-center">
            <DialogTitle className="text-xl">Objekt nicht gefunden</DialogTitle>
            <DialogDescription>Die Parzelle steht nicht (mehr) im Bestand, oder der Link ist unvollständig.</DialogDescription>
            <button type="button" className={KNOPF} onClick={onClose}>Schliessen</button>
          </div>
        ) : loading || !data ? (
          <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-6 p-5 sm:p-6">
              <DialogHeader className="sr-only">
                <DialogTitle>{data.address}</DialogTitle>
                <DialogDescription>{ort}</DialogDescription>
              </DialogHeader>

              {/* Erst das Bild, über die ganze Breite: es zeigt in zwei
                  Sekunden, was keine Zahl zeigt -- Platz, Hang, Nachbar. */}
              <div className="relative">
                <Objektansicht address={data.address} plzOrt={ort} parzelle={data.parzelle} bfsNr={data.bfs_nr}
                               gemeinde={data.gemeinde} kanton={data.kanton} className="h-72 w-full sm:h-[380px]" />
                {zoneKurzform(data.zone) && (
                  <span className="pointer-events-none absolute bottom-3 left-3"><Marke art="gruen">{zoneKurzform(data.zone)}</Marke></span>
                )}
              </div>

              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4" /> {ort || '–'}</p>
                  <h2 className="text-[28px] leading-tight">{data.address}</h2>
                  <p className="text-2xl font-semibold text-violett">{data.marge_chf ? `CHF ${(data.marge_chf / 1e6).toFixed(1)} Mio` : 'Marge offen'}</p>
                  <p className="text-sm text-muted-foreground">{[data.parzelle && `Parzelle ${data.parzelle}`, data.egrid && `EGRID ${data.egrid}`].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[[data.area, ' m²', 'Fläche'], [data.geschosse, ' Gesch.', 'Geschosse'], [data.wohnungen, ' Whg.', 'Wohnungen']]
                    .filter(([v]) => v).map(([v, e, t]) => (
                      <span key={t as string} title={t as string} className="inline-flex h-10 items-center rounded-[3px] border px-3 text-sm">{zahl(v as number, e as string)}</span>
                    ))}
                </div>
              </div>

              {/* Merkmal-Raster mit kleinen Grossbuchstaben wie in der Vorlage. */}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-5 sm:grid-cols-3">
                {([
                  ['Zone', data.zone], ['Kategorie', data.kategorie],
                  ['Baujahr', reg?.haupt_baujahr ?? data.baujahr],
                  ['Grundstück', zahl(data.area, ' m²')], ['Gebäudefläche', zahl(data.gebaeudeflaeche, ' m²')], ['HNF geschätzt', zahl(data.hnf_schaetzung, ' m²')],
                  ['Reserve HNF', data.hnf_delta && data.hnf_delta > 0 ? zahl(data.hnf_delta, ' m²') : '–'],
                  ['Geschosse', reg?.geschosse_max ?? data.geschosse], ['Wohnungen', reg?.wohnungen ?? data.wohnungen],
                  ['Gebäude', reg ? (reg.gebaeude === 1 ? '1' : `${reg.gebaeude}${reg.baujahr_aeltestes && reg.baujahr_juengstes && reg.baujahr_aeltestes !== reg.baujahr_juengstes ? `, ${reg.baujahr_aeltestes}–${reg.baujahr_juengstes}` : ''}`) : null],
                  ['Energiebezugsfläche', reg?.energieflaeche ? zahl(reg.energieflaeche, ' m²') : null],
                  ['Heizung', heizungBeschreiben(reg, kodes)],
                ] as [string, unknown][]).map(([t, v]) => (
                  <div key={t} className="min-w-0">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{t}</dt>
                    <dd className="mt-0.5 break-words font-medium">{v == null || v === '' ? '–' : String(v)}</dd>
                  </div>
                ))}
              </dl>

              <div className="flex flex-wrap gap-2">
                {/* Der gespeicherte Link fehlt bei den meisten Objekten;
                    aus Adresse und Ort lässt er sich immer bilden. */}
                {/* Haus, Dach, Höhe, Heizung und Zone in 3D (Karte3D). */}
                <button type="button" className={KNOPF} onClick={() => navigate(`/karte3d?objekt=${data.id}`)}><Box className="h-4 w-4" /> 3D</button>
                <a className={KNOPF} href={data.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${suche}`} target={FENSTER.karte}><MapPin className="h-4 w-4" /> Maps</a>
                <a className={KNOPF} href={`https://www.google.com/maps/search/?api=1&query=${suche}&basemap=satellite`} target={FENSTER.karte}><MapPin className="h-4 w-4" /> Satellit</a>
                {data.gis_url && <a className={KNOPF} href={data.gis_url} target={FENSTER.portal}><ExternalLink className="h-4 w-4" /> GIS</a>}
                {data.housing_stat_url && <a className={KNOPF} href={data.housing_stat_url} target={FENSTER.portal}><ExternalLink className="h-4 w-4" /> Kataster</a>}
                {/* Die Auskunft des Grundbuchamts nennt den eingetragenen
                    Eigentümer. Führt der Link auf die Anmeldung, ist das
                    die Identifikation des Portals, kein defekter Link. */}
                {grundbuchUrl(data.egrid, data.bfs_nr, data.kanton) && (
                  <a className={KNOPF} href={grundbuchUrl(data.egrid, data.bfs_nr, data.kanton)!} target={FENSTER.portal}><ExternalLink className="h-4 w-4" /> Grundbuch</a>
                )}
                {data.owner_name && <a className={KNOPF} href={`https://tel.search.ch/?was=${encodeURIComponent(data.owner_name)}`} target={FENSTER.suche}><Phone className="h-4 w-4" /> Tel.search</a>}
              </div>

              <div className="space-y-1.5">
                <h3 className="text-lg">Notizen</h3>
                <Textarea rows={4} value={data.notes || ''} onChange={e => update({ notes: e.target.value || null })} className="rounded-[3px]" />
              </div>

              {/* Baut hier jemand, oder nebenan? Rückwirkend seit Januar 2026. */}
              <BaugesucheParzelle parzelleId={data.id} egrid={data.egrid} />
              {/* Wer arrondieren will, fragt zuerst: wem gehört nebenan? */}
              <Nachbarn parzelleId={data.id} onOeffnen={nid => setzen({ parzelle: nid })} />
              {/* Jedes Gespräch als Daten: Absicht, Preis, Grund, Wiedervorlage. */}
              <Gespraeche parzelleId={data.id} ownerName={data.owner_name ?? null} />
            </div>

            {/* Rechte Tafel: Eigentümer und Stand, wie "Listing Agent" in der Vorlage. */}
            <aside className="space-y-5 border-t bg-secondary/40 p-5 sm:p-6 lg:border-l lg:border-t-0">
              {/* Rechts Platz lassen: dort sitzt das Schliessen-Kreuz. */}
              <div className="flex items-center justify-between gap-2 pr-8">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Eigentümer</p>
                {/* Oben, nicht unten: die häufigste Entscheidung. */}
                {data.preselection_status === ARCHIV_STATUS ? (
                  <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => update({ preselection_status: 'Nicht geprüft' })}>Aus dem Archiv holen</button>
                ) : (
                  <button type="button" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive" onClick={archivieren} disabled={saving}>
                    <Archive className="h-4 w-4" /> Nicht interessant
                  </button>
                )}
              </div>

              <div className="space-y-2 rounded border bg-card p-4">
                {d?.eigentuemer_name || d?.eigentuemer_adresse ? (
                  <div className="space-y-0.5 text-sm">
                    {d.eigentuemer_name && <p className="font-semibold">{d.eigentuemer_name}</p>}
                    {d.eigentuemer_adresse && <p className="text-muted-foreground">{d.eigentuemer_adresse}</p>}
                    {d.eigentuemer_plz_ort && <p className="text-muted-foreground">{d.eigentuemer_plz_ort}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Aus dem Grundbuch noch nicht abgerufen{!data.egrid && ', keine EGRID vorhanden'}.</p>
                )}
                {/* Abgefragt wird nicht mehr hier: die Akquise ist seit dem
                    7. November ein eigenes Programm (src/App.tsx). */}
                <p className="text-xs text-muted-foreground">Eigentümer werden in Bauraum Akquise abgefragt.</p>
              </div>
              <WeitereParzellen parzelleId={data.id} />

              <Feld titel="Name"><Input value={data.owner_name || ''} onChange={e => update({ owner_name: e.target.value || null })} /></Feld>
              <Feld titel="Telefon"><Input value={data.owner_phone || ''} onChange={e => update({ owner_phone: e.target.value || null })} /></Feld>
              <Feld titel="Adresse"><Input value={data.owner_address || ''} onChange={e => update({ owner_address: e.target.value || null })} /></Feld>

              <div className="grid grid-cols-1 gap-4 border-t pt-5">
                <Feld titel="Vorwahl">
                  <Select value={data.preselection_status || 'Nicht geprüft'} onValueChange={v => update({ preselection_status: v })}>
                    <SelectTrigger className="rounded-[3px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{preselectionStatuses.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </Feld>
                <Feld titel="Akquise">
                  <Select value={data.status} onValueChange={v => update({ status: v })}>
                    <SelectTrigger className="rounded-[3px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{akquiseStatuses.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
                  </Select>
                </Feld>
                <div className="grid grid-cols-2 gap-3">
                  <Feld titel="Follow-up">
                    <Input type="date" value={data.follow_up_at ? data.follow_up_at.slice(0, 10) : ''}
                           onChange={e => update({ follow_up_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                  </Feld>
                  <Feld titel="Zuständig"><Input value={data.assigned_to || ''} onChange={e => update({ assigned_to: e.target.value || null })} /></Feld>
                </div>
              </div>

              {/* Die öffentliche Hand verkauft ihren Grundbesitz praktisch
                  nie -- dann gehört das Objekt ins Archiv. */}
              {verkauftNie(data.owner_name) && data.preselection_status !== ARCHIV_STATUS && (
                <div className="space-y-2 rounded border border-warning/40 bg-warning/10 p-3 text-sm">
                  <p><span className="font-medium">Öffentliche Hand als Eigentümerin.</span> Verkauft in aller Regel nicht.</p>
                  <button type="button" className={`${KNOPF} w-full`} onClick={archivieren} disabled={saving}>Archivieren</button>
                </div>
              )}

              <div className="sticky bottom-0 -mx-5 space-y-2 border-t bg-card px-5 pb-1 pt-4 sm:-mx-6 sm:px-6">
                <button type="button" className={`${KNOPF_HAUPT} w-full`} onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Speichern
                </button>
                <button type="button" className="h-11 w-full text-sm text-muted-foreground hover:text-foreground" onClick={onClose}>Abbrechen</button>
              </div>
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Feld({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{titel}</span>
      {children}
    </label>
  );
}
