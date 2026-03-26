import { useState } from 'react';
import { ExternalLink, Trash2, Edit, ChevronDown } from 'lucide-react';
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
  const [editProp, setEditProp] = useState<Property | null>(null);
  const { data: properties, isLoading } = useProperties(filter);
  const updateProp = useUpdateProperty();
  const deleteProp = useDeleteProperty();
  const { toast } = useToast();

  const filtered = (properties || []).filter(p =>
    !search || p.address.toLowerCase().includes(search.toLowerCase()) ||
    p.egrid?.toLowerCase().includes(search.toLowerCase()) ||
    p.owner_name?.toLowerCase().includes(search.toLowerCase())
  );

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
          <p className="text-muted-foreground mt-1">{filtered.length} Einträge</p>
        </div>
        <div className="flex gap-3">
          <Input placeholder="Suchen..." value={search} onChange={e => setSearch(e.target.value)} className="w-60" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Adresse</TableHead>
              <TableHead>EGRID</TableHead>
              <TableHead>Fläche</TableHead>
              <TableHead>Eigentümer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Portal</TableHead>
              <TableHead className="w-20">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Laden...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Keine Liegenschaften gefunden</TableCell></TableRow>
            ) : filtered.map(p => (
              <TableRow key={p.id} className="group">
                <TableCell className="font-medium max-w-[200px] truncate">{p.address}</TableCell>
                <TableCell className="font-mono text-xs">{p.egrid || '–'}</TableCell>
                <TableCell>{p.area ? `${p.area} m²` : '–'}</TableCell>
                <TableCell>{p.owner_name || <span className="text-muted-foreground italic">Unbekannt</span>}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusColor(p.status)}>{p.status}</Badge>
                </TableCell>
                <TableCell>
                  {portalLink(p) && (
                    <a href={portalLink(p)!} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1 text-xs">
                      Öffnen <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" onClick={() => setEditProp(p)}><Edit className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => {
                      deleteProp.mutate(p.id, { onSuccess: () => toast({ title: 'Gelöscht' }) });
                    }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Liegenschaft bearbeiten</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{property.address}</p>
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
