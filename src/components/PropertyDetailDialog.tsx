import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExternalLink, MapPin, Phone, User, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import type { Tables } from '@/integrations/supabase/types';

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
              <DialogTitle>{data.address}</DialogTitle>
              <DialogDescription>
                {data.gemeinde} {data.plz && `· ${data.plz}`} {data.egrid && `· EGRID ${data.egrid}`}
              </DialogDescription>
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

              <div className="flex flex-wrap gap-2">
                {data.google_maps_url && (
                  <a href={data.google_maps_url} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline"><MapPin className="h-3.5 w-3.5 mr-1" /> Maps</Button>
                  </a>
                )}
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
                {data.owner_name && (
                  <a href={`https://tel.search.ch/?was=${encodeURIComponent(data.owner_name)}`} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="outline"><Phone className="h-3.5 w-3.5 mr-1" /> Tel.search</Button>
                  </a>
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
      <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{label}</p>
      <p className="font-medium mt-0.5">{value}</p>
    </div>
  );
}