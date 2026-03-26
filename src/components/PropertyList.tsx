import { useState } from 'react';
import { ExternalLink, Trash2, Edit, MapPin, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useProperties, useUpdateProperty, useDeleteProperty, type Property } from '@/hooks/use-properties';
import { useToast } from '@/hooks/use-toast';

const STATUSES = ['Alle', 'Neu', 'Eigentümer ermittelt', 'Kontaktiert', 'Interesse', 'Kein Interesse', 'Abgeschlossen'];

function statusColor(s: string) {
  switch (s) {
    case 'Neu': return 'bg-muted text-muted-foreground';
    case 'Eigentümer ermittelt': return 'bg-primary/20 text-primary';
    case 'Kontaktiert': return 'bg-accent/20 text-accent';
    case 'Interesse': return 'bg-accent text-accent-foreground';
    case 'Kein Interesse': return 'bg-destructive/20 text-destructive';
    case 'Abgeschlossen': return 'bg-primary text-primary-foreground';
    default: return 'bg-muted text-muted-foreground';
  }
}

export function PropertyList() {
  const [filter, setFilter] = useState('Alle');
  const [search, setSearch] = useState('');
  const [gemeindeFilter, setGemeindeFilter] = useState('Alle');
  const [editProp, setEditProp] = useState<Property | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const { data: properties, isLoading } = useProperties(filter);
  const updateProp = useUpdateProperty();
  const deleteProp = useDeleteProperty();
  const { toast } = useToast();

  const gemeinden = [...new Set((properties || []).map(p => p.gemeinde).filter(Boolean))].sort() as string[];

  const filtered = (properties || []).filter(p => {
    if (gemeindeFilter !== 'Alle' && p.gemeinde !== gemeindeFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return p.address.toLowerCase().includes(q) ||
      p.egrid?.toLowerCase().includes(q) ||
      p.owner_name?.toLowerCase().includes(q) ||
      p.gemeinde?.toLowerCase().includes(q) ||
      p.strassenname?.toLowerCase().includes(q);
  });

  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const portalLink = (p: Property) => {
    if (!p.egrid) return null;
    const bfs = p.bfs_nr || '0';
    return `https://portal.objektwesen.zh.ch/aks/detail?egrid=${p.egrid}&bfsNr=${bfs}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Liegenschaften</h2>
          <p className="text-muted-foreground mt-1">{filtered.length} von {(properties || []).length} Einträgen</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Suchen..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="w-52" />
          <Select value={gemeindeFilter} onValueChange={v => { setGemeindeFilter(v); setPage(0); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Gemeinde" /></SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="Alle">Alle Gemeinden</SelectItem>
              {gemeinden.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filter} onValueChange={v => { setFilter(v); setPage(0); }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Adresse</TableHead>
                <TableHead>PLZ/Ort</TableHead>
                <TableHead>Gemeinde</TableHead>
                <TableHead>EGRID</TableHead>
                <TableHead>Fläche</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Baujahr</TableHead>
                <TableHead>Eigentümer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Links</TableHead>
                <TableHead className="w-20">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={11} className="text-center py-12 text-muted-foreground">Laden...</TableCell></TableRow>
              ) : paged.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-12 text-muted-foreground">Keine Liegenschaften gefunden</TableCell></TableRow>
              ) : paged.map(p => (
                <TableRow key={p.id} className="group">
                  <TableCell className="font-medium max-w-[180px] truncate">{p.address}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{p.plz_ort || '–'}</TableCell>
                  <TableCell className="text-xs">{p.gemeinde || '–'}</TableCell>
                  <TableCell className="font-mono text-xs">{p.egrid || '–'}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {p.area ? `${Math.round(p.area)} m²` : '–'}
                    {p.gebaeudeflaeche ? <span className="text-muted-foreground ml-1">({Math.round(p.gebaeudeflaeche)})</span> : ''}
                  </TableCell>
                  <TableCell className="text-xs max-w-[120px] truncate">{p.kategorie || '–'}</TableCell>
                  <TableCell className="text-xs">{p.baujahr || '–'}</TableCell>
                  <TableCell>{p.owner_name || <span className="text-muted-foreground italic text-xs">Unbekannt</span>}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`text-xs ${statusColor(p.status)}`}>{p.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {portalLink(p) && (
                        <a href={portalLink(p)!} target="_blank" rel="noopener noreferrer" title="Eigentümerauskunft">
                          <Home className="h-3.5 w-3.5 text-primary hover:text-primary/80" />
                        </a>
                      )}
                      {p.google_maps_url && (
                        <a href={p.google_maps_url} target="_blank" rel="noopener noreferrer" title="Google Maps">
                          <MapPin className="h-3.5 w-3.5 text-accent hover:text-accent/80" />
                        </a>
                      )}
                      {p.streetview_url && (
                        <a href={p.streetview_url} target="_blank" rel="noopener noreferrer" title="Streetview">
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditProp(p)}><Edit className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                        deleteProp.mutate(p.id, { onSuccess: () => toast({ title: 'Gelöscht' }) });
                      }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
            <p className="text-sm text-muted-foreground">Seite {page + 1} von {totalPages}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Zurück</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Weiter</Button>
            </div>
          </div>
        )}
      </div>

      {editProp && (
        <EditDialog
          property={editProp}
          onClose={() => setEditProp(null)}
          onSave={(updates) => {
            updateProp.mutate({ id: editProp.id, ...updates }, {
              onSuccess: () => { setEditProp(null); toast({ title: 'Gespeichert' }); },
            });
          }}
        />
      )}
    </div>
  );
}

function EditDialog({ property, onClose, onSave }: {
  property: Property;
  onClose: () => void;
  onSave: (u: Partial<Property>) => void;
}) {
  const [form, setForm] = useState({
    owner_name: property.owner_name || '',
    owner_address: property.owner_address || '',
    owner_phone: property.owner_phone || '',
    status: property.status,
    notes: property.notes || '',
  });

  const portalUrl = property.egrid
    ? `https://portal.objektwesen.zh.ch/aks/detail?egrid=${property.egrid}&bfsNr=${property.bfs_nr || '0'}`
    : null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Liegenschaft bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-1 text-sm">
            <p className="font-semibold">{property.address}</p>
            <p className="text-muted-foreground">{property.plz_ort} · {property.gemeinde}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-2">
              {property.egrid && <span>EGRID: <span className="font-mono">{property.egrid}</span></span>}
              {property.kategorie && <span>Typ: {property.kategorie}</span>}
              {property.baujahr && <span>Baujahr: {property.baujahr}</span>}
              {property.area && <span>Grundstück: {Math.round(property.area)} m²</span>}
              {property.gebaeudeflaeche && <span>Gebäude: {Math.round(property.gebaeudeflaeche)} m²</span>}
              {property.geschosse && <span>Geschosse: {property.geschosse}</span>}
              {property.wohnungen && <span>Wohnungen: {property.wohnungen}</span>}
            </div>
            {portalUrl && (
              <a href={portalUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs inline-flex items-center gap-1 mt-2">
                Eigentümerauskunft öffnen <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Eigentümer Name</Label>
              <Input value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Eigentümer Adresse</Label>
              <Input value={form.owner_address} onChange={e => setForm(f => ({ ...f, owner_address: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Telefonnummer</Label>
              <Input value={form.owner_phone} onChange={e => setForm(f => ({ ...f, owner_phone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Neu', 'Eigentümer ermittelt', 'Kontaktiert', 'Interesse', 'Kein Interesse', 'Abgeschlossen'].map(s =>
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notizen</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Abbrechen</Button>
            <Button onClick={() => onSave({
              ...form,
              is_queried: !!form.owner_name,
              queried_at: form.owner_name ? new Date().toISOString() : undefined,
              status: form.owner_name && form.status === 'Neu' ? 'Eigentümer ermittelt' : form.status,
            })}>Speichern</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
