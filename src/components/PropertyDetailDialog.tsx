import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { grundbuchUrl, verkauftNie, ARCHIV_STATUS } from '@/lib/grundbuch';
import { Label } from '@/components/ui/label';
import { Objektansicht } from '@/components/Objektansicht';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, MapPin, Phone, User, Save, Loader2, Bot, RefreshCw, Archive } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { Tables } from '@/integrations/supabase/types';
import { useStartEigentuemerLookup, useExtensionAvailable } from '@/hooks/use-eigentuemer-lookup';

type Property = Tables<'properties'>;

const akquiseStatuses = [
  'Neu', 'In Prüfung', 'Interessant', 'Nicht interessant', 'Eigentümer gesucht',
  'Eigentümer gefunden', 'Eigentümer ermittelt', 'Telefonnummer gesucht', 'Telefon gefunden',
  'Kontaktiert', 'Kein Interesse', 'Interesse vorhanden', 'Termin vereinbart',
  'Follow-up', 'Exportiert', 'Archiviert',
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
  const startLookup = useStartEigentuemerLookup();
  const extensionAvailable = useExtensionAvailable();

  useEffect(() => {
    if (!id) { setData(null); return; }
    setLoading(true);
    supabase.from('properties').select('*').eq('id', id).maybeSingle()
      .then(({ data, error }) => {
        if (error) toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
        setData(data || null);
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
    onClose();
  };

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {loading || !data ? (
          <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <DialogTitle>{data.address}</DialogTitle>
                  <DialogDescription>
                    {data.gemeinde} {data.plz && `· ${data.plz}`} {data.egrid && `· EGRID ${data.egrid}`}
                  </DialogDescription>
                </div>
                {/* Oben, nicht unten: es ist die häufigste Entscheidung.
                    Die meisten Objekte sind nichts, und wer das nach
                    drei Sekunden sieht, soll nicht erst scrollen. */}
                {data.preselection_status === ARCHIV_STATUS ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => update({ preselection_status: 'Nicht geprüft' })}
                  >
                    Aus dem Archiv holen
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={archivieren}
                    disabled={saving}
                  >
                    <Archive className="mr-1 h-4 w-4" /> Nicht interessant
                  </Button>
                )}
              </div>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <Stat label="Fläche" value={data.area ? `${data.area.toLocaleString('de-CH')} m²` : '—'} />
                <Stat label="Gebäude" value={data.gebaeudeflaeche ? `${data.gebaeudeflaeche.toLocaleString('de-CH')} m²` : '—'} />
                <Stat label="HNF" value={data.hnf_schaetzung ? `${data.hnf_schaetzung.toLocaleString('de-CH')} m²` : '—'} />
                <Stat label="Baujahr" value={data.baujahr || '—'} />
                <Stat label="Geschosse" value={data.geschosse || '—'} />
                <Stat label="Wohnungen" value={data.wohnungen || '—'} />
                <Stat label="Zone" value={data.zone || '—'} />
                <Stat label="Kategorie" value={data.kategorie || '—'} />
              </div>

              {/* Zuerst die Zahlen, dann das Bild -- und das über die
                  ganze Breite: ein Luftbild in Briefmarkengrösse
                  beantwortet keine Frage. Es zeigt in zwei Sekunden,
                  was keine Zahl zeigt: steht da noch Platz, hängt das
                  Grundstück am Hang, hat der Nachbar schon gebaut. */}
              <Objektansicht
                address={data.address}
                plzOrt={data.plz_ort || [data.plz, data.gemeinde].filter(Boolean).join(' ')}
                parzelle={data.parzelle}
                bfsNr={data.bfs_nr}
                gemeinde={data.gemeinde}
                kanton={data.kanton}
                className="h-72 w-full"
              />

              <div className="flex flex-wrap gap-2">
                {/* Der gespeicherte Link fehlt bei den meisten Objekten;
                    aus Adresse und Ort lässt er sich immer bilden. */}
                <a
                  href={data.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${
                    encodeURIComponent([data.address, data.plz_ort || [data.plz, data.gemeinde].filter(Boolean).join(' ')].filter(Boolean).join(', '))}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button size="sm" variant="outline"><MapPin className="h-3.5 w-3.5 mr-1" /> Maps</Button>
                </a>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${
                    encodeURIComponent([data.address, data.plz_ort || [data.plz, data.gemeinde].filter(Boolean).join(' ')].filter(Boolean).join(', '))}&basemap=satellite`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button size="sm" variant="outline"><MapPin className="h-3.5 w-3.5 mr-1" /> Satellit</Button>
                </a>
                {data.gis_url && (
                  <a href={data.gis_url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline"><ExternalLink className="h-3.5 w-3.5 mr-1" /> GIS</Button>
                  </a>
                )}
                {data.housing_stat_url && (
                  <a href={data.housing_stat_url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Kataster</Button>
                  </a>
                )}
                {grundbuchUrl(data.egrid, data.bfs_nr, data.kanton) && (
                  /* Die Auskunft des Grundbuchamts nennt den eingetragenen
                     Eigentümer -- genau die Angabe, die in den Listen fehlt.
                     Führt der Link auf die Anmeldung, ist das die
                     Identifikation des Portals und kein defekter Link. */
                  <a href={grundbuchUrl(data.egrid, data.bfs_nr, data.kanton)!} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Grundbuch</Button>
                  </a>
                )}
                {data.owner_name && (
                  <a href={`https://tel.search.ch/?was=${encodeURIComponent(data.owner_name)}`} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline"><Phone className="h-3.5 w-3.5 mr-1" /> Tel.search</Button>
                  </a>
                )}
              </div>

              {/* Eigentümer (Portal-Lookup) */}
              <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Bot className="h-3.5 w-3.5" /> Eigentümer (ZH-Portal)
                  </Label>
                  <Button
                    size="sm"
                    variant={(data as Property & { eigentuemer_name?: string | null }).eigentuemer_name ? 'outline' : 'default'}
                    className="h-7 text-xs gap-1"
                    disabled={!data.egrid}
                    onClick={() => startLookup({
                      propertyId: data.id,
                      egrid: data.egrid,
                      bfsNr: data.bfs_nr,
                      kanton: data.kanton,
                      parzelle: data.parzelle,
                      address: data.address,
                      plzOrt: data.plz_ort || data.gemeinde,
                    })}
                  >
                    {(data as Property & { eigentuemer_name?: string | null }).eigentuemer_name
                      ? (<><RefreshCw className="h-3 w-3" /> Erneut abrufen</>)
                      : (<><Bot className="h-3 w-3" /> Eigentümer abrufen</>)}
                  </Button>
                </div>
                {(() => {
                  const d = data as Property & { eigentuemer_name?: string | null; eigentuemer_adresse?: string | null; eigentuemer_plz_ort?: string | null };
                  if (!d.eigentuemer_name && !d.eigentuemer_adresse) {
                    return <p className="text-xs text-muted-foreground">Noch nicht abgerufen{!data.egrid && ' — keine EGRID vorhanden'}.</p>;
                  }
                  return (
                    <div className="text-sm space-y-0.5">
                      {d.eigentuemer_name && <p className="font-medium">{d.eigentuemer_name}</p>}
                      {d.eigentuemer_adresse && <p className="text-muted-foreground">{d.eigentuemer_adresse}</p>}
                      {d.eigentuemer_plz_ort && <p className="text-muted-foreground">{d.eigentuemer_plz_ort}</p>}
                    </div>
                  );
                })()}
                {!extensionAvailable && (
                  <p className="text-xs text-muted-foreground">Chrome-Extension empfohlen für Auto-Speicherung.</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Vorwahl-Status</Label>
                  <Select value={data.preselection_status || 'Nicht geprüft'}
                          onValueChange={v => update({ preselection_status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {preselectionStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Akquise-Status</Label>
                  <Select value={data.status} onValueChange={v => update({ status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {akquiseStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs"><User className="h-3 w-3 inline mr-1" /> Eigentümer</Label>
                  <Input value={data.owner_name || ''} onChange={e => update({ owner_name: e.target.value || null })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs"><Phone className="h-3 w-3 inline mr-1" /> Telefon</Label>
                  <Input value={data.owner_phone || ''} onChange={e => update({ owner_phone: e.target.value || null })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Eigentümer-Adresse</Label>
                  <Input value={data.owner_address || ''} onChange={e => update({ owner_address: e.target.value || null })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Follow-up</Label>
                  <Input type="date"
                         value={data.follow_up_at ? data.follow_up_at.slice(0, 10) : ''}
                         onChange={e => update({ follow_up_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Zuständige Person</Label>
                  <Input value={data.assigned_to || ''} onChange={e => update({ assigned_to: e.target.value || null })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Notizen</Label>
                <Textarea rows={4} value={data.notes || ''}
                          onChange={e => update({ notes: e.target.value || null })} />
              </div>
            </div>

            {/* Die öffentliche Hand verkauft ihren Grundbesitz praktisch nie.
                Steht ein solcher Eigentümer im Grundbuch, ist die Arbeit an
                diesem Objekt beendet -- es gehört ins Archiv und nicht mehr
                auf die Anrufliste. */}
            {verkauftNie(data.owner_name) && data.preselection_status !== ARCHIV_STATUS && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="text-sm">
                  <span className="font-medium">Öffentliche Hand als Eigentümerin.</span>{' '}
                  Verkauft in aller Regel nicht — ins Archiv?
                </p>
                <Button size="sm" variant="outline" onClick={archivieren} disabled={saving}>
                  Archivieren
                </Button>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Speichern
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-xs uppercase text-muted-foreground tracking-wider">{label}</p>
      <p className="font-medium mt-0.5">{value}</p>
    </div>
  );
}