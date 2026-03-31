import { useState } from 'react';
import { ExternalLink, Trash2, Edit, MapPin, Home, CheckCircle2, XCircle, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useProperties, useGemeinden, useZones, useUpdateProperty, useDeleteProperty, type Property } from '@/hooks/use-properties';
import { useToast } from '@/hooks/use-toast';

const STATUSES = ['Alle', 'Neu', 'Eigentümer ermittelt', 'Kontaktiert', 'Interesse', 'Kein Interesse', 'Abgeschlossen'];

const ZONE_LABELS: Record<string, string> = {
  'W': 'Wohnzone W',
  'W2': 'Wohnzone W2',
  'W3': 'Wohnzone W3',
  'W4': 'Wohnzone W4',
  'WG': 'Wohn-/Gewerbezone',
  'WG2': 'Wohn-/Gewerbezone WG2',
  'WG3': 'Wohn-/Gewerbezone WG3',
};

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
  const [searchInput, setSearchInput] = useState('');
  const [gemeindeFilter, setGemeindeFilter] = useState('Alle');
  const [zoneFilter, setZoneFilter] = useState('Alle');
  const [editProp, setEditProp] = useState<Property | null>(null);
  const [page, setPage] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [baujahrVon, setBaujahrVon] = useState('');
  const [baujahrBis, setBaujahrBis] = useState('');
  const [flaecheMin, setFlaecheMin] = useState('');
  const [flaecheMax, setFlaecheMax] = useState('');
  const [areaMin, setAreaMin] = useState('');
  const [areaMax, setAreaMax] = useState('');
  const [geschosseMin, setGeschosseMin] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('Alle');
  const pageSize = 50;

  const { data: result, isLoading } = useProperties({
    statusFilter: filter,
    gemeindeFilter,
    zoneFilter,
    search,
    page,
    pageSize,
    baujahrVon: baujahrVon ? Number(baujahrVon) : undefined,
    baujahrBis: baujahrBis ? Number(baujahrBis) : undefined,
    flaecheMin: flaecheMin ? Number(flaecheMin) : undefined,
    flaecheMax: flaecheMax ? Number(flaecheMax) : undefined,
    areaMin: areaMin ? Number(areaMin) : undefined,
    areaMax: areaMax ? Number(areaMax) : undefined,
    geschosseMin: geschosseMin ? Number(geschosseMin) : undefined,
    ownerFilter,
  });
  const { data: gemeinden } = useGemeinden();
  const { data: zones } = useZones();
  const updateProp = useUpdateProperty();
  const deleteProp = useDeleteProperty();
  const { toast } = useToast();

  const properties = result?.data || [];
  const totalCount = result?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const portalLink = (p: Property) => {
    if (p.parzelle && p.bfs_nr) {
      return `https://maps.zh.ch/?locate=parz&locations=${p.bfs_nr},${p.parzelle}&topic=OerebKatasterZH`;
    }
    if (p.egrid) {
      return `https://maps.zh.ch/?topic=OerebKatasterZH&search=${p.egrid}`;
    }
    return null;
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setSearch(searchInput);
      setPage(0);
    }
  };

  const resetAdvanced = () => {
    setBaujahrVon(''); setBaujahrBis(''); setFlaecheMin(''); setFlaecheMax('');
    setAreaMin(''); setAreaMax(''); setGeschosseMin(''); setOwnerFilter('Alle');
    setPage(0);
  };

  const hasAdvancedFilters = !!(baujahrVon || baujahrBis || flaecheMin || flaecheMax || areaMin || areaMax || geschosseMin || ownerFilter !== 'Alle');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Liegenschaften</h2>
          <p className="text-muted-foreground mt-1">{totalCount.toLocaleString()} Einträge · Wohnzonen · sortiert nach HNF ↓</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Suchen... (Enter)"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="w-52"
          />
          <Select value={gemeindeFilter} onValueChange={v => { setGemeindeFilter(v); setPage(0); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Gemeinde" /></SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="Alle">Alle Gemeinden</SelectItem>
              {(gemeinden || []).map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={zoneFilter} onValueChange={v => { setZoneFilter(v); setPage(0); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Zone" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Alle">Alle Zonen</SelectItem>
              {(zones || []).map(z => <SelectItem key={z} value={z}>{ZONE_LABELS[z] || z}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filter} onValueChange={v => { setFilter(v); setPage(0); }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant={hasAdvancedFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="gap-1"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filter
            {hasAdvancedFilters && <Badge variant="secondary" className="ml-1 text-xs px-1.5">aktiv</Badge>}
          </Button>
        </div>
      </div>

      {showAdvanced && (
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Erweiterte Filter</h3>
            {hasAdvancedFilters && (
              <Button variant="ghost" size="sm" onClick={resetAdvanced} className="text-xs text-muted-foreground">
                Alle zurücksetzen
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Baujahr von</label>
              <Input
                type="number" placeholder="z.B. 1900" value={baujahrVon}
                onChange={e => { setBaujahrVon(e.target.value); setPage(0); }}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Baujahr bis</label>
              <Input
                type="number" placeholder="z.B. 1960" value={baujahrBis}
                onChange={e => { setBaujahrBis(e.target.value); setPage(0); }}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">HNF min (m²)</label>
              <Input
                type="number" placeholder="z.B. 200" value={flaecheMin}
                onChange={e => { setFlaecheMin(e.target.value); setPage(0); }}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">HNF max (m²)</label>
              <Input
                type="number" placeholder="z.B. 1000" value={flaecheMax}
                onChange={e => { setFlaecheMax(e.target.value); setPage(0); }}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Grundstück min (m²)</label>
              <Input
                type="number" placeholder="z.B. 500" value={areaMin}
                onChange={e => { setAreaMin(e.target.value); setPage(0); }}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Geschosse min</label>
              <Input
                type="number" placeholder="z.B. 2" value={geschosseMin}
                onChange={e => { setGeschosseMin(e.target.value); setPage(0); }}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Eigentümer</label>
              <Select value={ownerFilter} onValueChange={v => { setOwnerFilter(v); setPage(0); }}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alle">Alle</SelectItem>
                  <SelectItem value="mit">Mit Eigentümer</SelectItem>
                  <SelectItem value="ohne">Ohne Eigentümer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Adresse</TableHead>
                <TableHead>PLZ/Ort</TableHead>
                <TableHead>Gemeinde</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>EGRID</TableHead>
                <TableHead>HNF</TableHead>
                <TableHead>Fläche</TableHead>
                <TableHead>Baujahr</TableHead>
                <TableHead>Abgefragt</TableHead>
                <TableHead>Eigentümer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Links</TableHead>
                <TableHead className="w-20">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={13} className="text-center py-12 text-muted-foreground">Laden...</TableCell></TableRow>
              ) : properties.length === 0 ? (
                <TableRow><TableCell colSpan={13} className="text-center py-12 text-muted-foreground">Keine Liegenschaften gefunden</TableCell></TableRow>
              ) : properties.map(p => (
                <TableRow key={p.id} className="group">
                  <TableCell className="font-medium max-w-[180px] truncate">{p.address}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{p.plz_ort || '–'}</TableCell>
                  <TableCell className="text-xs">{p.gemeinde || '–'}</TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline" className="text-xs">{p.zone || '–'}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.egrid || '–'}</TableCell>
                  <TableCell className="text-xs font-semibold whitespace-nowrap">
                    {p.gebaeudeflaeche ? `${Math.round(Number(p.gebaeudeflaeche))} m²` : '–'}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {p.area ? `${Math.round(Number(p.area))} m²` : '–'}
                  </TableCell>
                  <TableCell className="text-xs">{p.baujahr || '–'}</TableCell>
                  <TableCell>
                    {p.is_queried ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground/40" />
                    )}
                  </TableCell>
                  <TableCell>
                    {p.owner_name ? (
                      <span className="text-sm">{p.owner_name}</span>
                    ) : p.is_queried ? (
                      <span className="text-muted-foreground italic text-xs">Kein Ergebnis</span>
                    ) : (
                      <span className="text-muted-foreground italic text-xs">Unbekannt</span>
                    )}
                  </TableCell>
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
            <p className="text-sm text-muted-foreground">
              Seite {page + 1} von {totalPages.toLocaleString()} · {totalCount.toLocaleString()} Einträge
            </p>
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

  const portalUrl = property.parzelle && property.bfs_nr
    ? `https://maps.zh.ch/?locate=parz&locations=${property.bfs_nr},${property.parzelle}&topic=OerebKatasterZH`
    : property.egrid
      ? `https://maps.zh.ch/?topic=OerebKatasterZH&search=${property.egrid}`
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
              {property.zone && <span>Zone: {property.zone}</span>}
              {property.kategorie && <span>Typ: {property.kategorie}</span>}
              {property.baujahr && <span>Baujahr: {property.baujahr}</span>}
              {property.area && <span>Grundstück: {Math.round(Number(property.area))} m²</span>}
              {property.gebaeudeflaeche && <span>HNF: {Math.round(Number(property.gebaeudeflaeche))} m²</span>}
              {property.geschosse && <span>Geschosse: {Number(property.geschosse)}</span>}
              {property.wohnungen && <span>Wohnungen: {Number(property.wohnungen)}</span>}
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
