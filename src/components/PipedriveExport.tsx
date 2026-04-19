import { useState, useMemo } from 'react';
import { Download, Send, CheckCircle, AlertCircle, Loader2, Users, SkipForward, ArchiveRestore, Archive, Phone, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProperties, useUpdateProperty } from '@/hooks/use-properties';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useListFilter } from '@/hooks/use-lists';
import { ListSelector } from '@/components/ListSelector';

const EXPORT_STATUSES = ['Telefon gefunden', 'Eigentümer ermittelt', 'Kontaktiert', 'Interesse', 'Interessant'];

export function PipedriveExport() {
  const [exportStatus, setExportStatus] = useState('Telefon gefunden');
  const [showArchive, setShowArchive] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState<'with-phone' | 'without-phone'>('with-phone');
  const selectedListId = useListFilter(s => s.selectedListId);
  const { data: result, isLoading, refetch } = useProperties({
    statusFilter: showArchive ? 'Exportiert' : exportStatus,
    pageSize: 1000,
    listId: selectedListId,
  });
  const updateProp = useUpdateProperty();
  const { toast } = useToast();
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ created: number; skipped: number; errors: number; errorDetails: Array<{ address: string; error: string }> } | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  const properties = result?.data || [];
  const count = result?.count || 0;

  const archiveWithPhone = useMemo(() => properties.filter(p => p.owner_phone), [properties]);
  const archiveWithoutPhone = useMemo(() => properties.filter(p => !p.owner_phone), [properties]);
  const archiveDisplayed = showArchive
    ? (archiveFilter === 'with-phone' ? archiveWithPhone : archiveWithoutPhone)
    : properties;

  const pushToPipedrive = async () => {
    if (properties.length === 0) {
      toast({ title: 'Keine Daten zum Exportieren', variant: 'destructive' });
      return;
    }

    setPushing(true);
    setPushResult(null);

    try {
      let totalCreated = 0;
      let totalSkipped = 0;
      let totalErrors = 0;
      const successIds: string[] = [];
      const errorDetails: Array<{ address: string; error: string }> = [];

      for (let i = 0; i < properties.length; i += 20) {
        const batch = properties.slice(i, i + 20).map(p => ({
          id: p.id,
          address: p.address,
          plz_ort: p.plz_ort,
          gemeinde: p.gemeinde,
          zone: p.zone,
          baujahr: p.baujahr,
          gebaeudeflaeche: p.gebaeudeflaeche ? Number(p.gebaeudeflaeche) : null,
          area: p.area ? Number(p.area) : null,
          geschosse: p.geschosse ? Number(p.geschosse) : null,
          egrid: p.egrid,
          gwr_egid: p.gwr_egid,
          parzelle: p.parzelle,
          bfs_nr: p.bfs_nr,
          owner_name: p.owner_name,
          owner_address: p.owner_address,
          owner_phone: p.owner_phone,
          owner_name_2: p.owner_name_2,
          owner_address_2: p.owner_address_2,
          owner_phone_2: p.owner_phone_2,
          owners_json: p.owners_json,
          notes: p.notes,
          status: p.status,
          google_maps_url: p.google_maps_url,
          kategorie: p.kategorie,
          wohnungen: p.wohnungen ? Number(p.wohnungen) : null,
        }));

        const { data, error } = await supabase.functions.invoke('pipedrive-push', {
          body: { properties: batch },
        });

        if (error) {
          totalErrors += batch.length;
          batch.forEach(b => errorDetails.push({ address: b.address, error: String(error) }));
        } else if (data?.summary) {
          totalCreated += data.summary.created;
          totalSkipped += data.summary.skipped;
          totalErrors += data.summary.errors;
          if (data.results) {
            for (const r of data.results) {
              if (!r.error && !r.skipped) successIds.push(r.propertyId);
              if (r.error) {
                const prop = batch.find(b => b.id === r.propertyId);
                errorDetails.push({ address: prop?.address || r.propertyId, error: r.error });
              }
            }
          }
        }
      }

      // Move successfully pushed properties to "Exportiert" status
      if (successIds.length > 0) {
        for (const id of successIds) {
          await updateProp.mutateAsync({ id, status: 'Exportiert' });
        }
      }

      setPushResult({ created: totalCreated, skipped: totalSkipped, errors: totalErrors, errorDetails });
      refetch();

      toast({
        title: totalErrors === 0
          ? `✅ ${totalCreated} Deals erstellt${totalSkipped > 0 ? `, ${totalSkipped} Duplikate übersprungen` : ''}`
          : `⚠️ ${totalCreated} erstellt, ${totalErrors} Fehler`,
        variant: totalErrors > 0 ? 'destructive' : 'default',
      });
    } catch (err) {
      toast({ title: 'Fehler beim Push zu Pipedrive', description: String(err), variant: 'destructive' });
    } finally {
      setPushing(false);
    }
  };

  const restoreFromArchive = async (id: string) => {
    setRestoring(id);
    try {
      await updateProp.mutateAsync({ id, status: 'Telefon gefunden' });
      toast({ title: '✅ Wiederhergestellt' });
      refetch();
    } catch {
      toast({ title: 'Fehler', variant: 'destructive' });
    } finally {
      setRestoring(null);
    }
  };

  const exportCsv = () => {
    if (properties.length === 0) return;
    const headers = [
      'Person - Name', 'Person - Phone', 'Person - Address',
      'Person - Name 2', 'Person - Phone 2', 'Person - Address 2',
      'Deal - Title', 'Organization - Name', 'Organization - Address',
      'Note', 'Zone', 'Baujahr', 'HNF m2', 'Grundstück m2', 'Geschosse',
      'EGRID', 'EGID', 'Gemeinde', 'Status',
    ];
    const rows = properties.map(p => [
      p.owner_name || '', p.owner_phone || '', p.owner_address || '',
      p.owner_name_2 || '', p.owner_phone_2 || '', p.owner_address_2 || '',
      `Akquise: ${p.address}`, `Liegenschaft: ${p.address}`,
      p.address + (p.plz_ort ? ', ' + p.plz_ort : ''),
      p.notes || '', p.zone || '', p.baujahr?.toString() || '',
      p.gebaeudeflaeche ? Math.round(Number(p.gebaeudeflaeche)).toString() : '',
      p.area ? Math.round(Number(p.area)).toString() : '',
      p.geschosse ? Number(p.geschosse).toString() : '',
      p.egrid || '', p.gwr_egid || '', p.gemeinde || '', p.status,
    ]);
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pipedrive-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: `✅ ${properties.length} Einträge exportiert` });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pipedrive Export</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {showArchive ? 'Bereits exportierte Deals – bei Bedarf wiederherstellen' : 'Direkt zu Pipedrive pushen mit Custom Fields & Duplikat-Check'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ListSelector />
          <Button variant={showArchive ? 'default' : 'outline'} size="sm" className="gap-1.5" onClick={() => { setShowArchive(!showArchive); setPushResult(null); }}>
            {showArchive ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            {showArchive ? 'Zurück' : 'Archiv'}
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-lg">
        <CardContent className="p-6 space-y-6">
          {!showArchive && (
            <div className="flex items-center gap-4">
              <div className="space-y-1 flex-1">
                <label className="text-sm font-medium">Status filtern</label>
                <Select value={exportStatus} onValueChange={setExportStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPORT_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-center pt-5">
                <p className="text-3xl font-bold">{isLoading ? '...' : count.toLocaleString('de-CH')}</p>
                <p className="text-xs text-muted-foreground">Einträge</p>
              </div>
            </div>
          )}

          {showArchive && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold">{isLoading ? '...' : (archiveFilter === 'with-phone' ? archiveWithPhone.length : archiveWithoutPhone.length).toLocaleString('de-CH')}</p>
                <p className="text-xs text-muted-foreground">von {count.toLocaleString('de-CH')} im Archiv</p>
              </div>
              <Tabs value={archiveFilter} onValueChange={(v) => setArchiveFilter(v as 'with-phone' | 'without-phone')}>
                <TabsList className="w-full">
                  <TabsTrigger value="with-phone" className="flex-1 gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    Mit Telefon ({archiveWithPhone.length})
                  </TabsTrigger>
                  <TabsTrigger value="without-phone" className="flex-1 gap-1.5">
                    <PhoneOff className="h-3.5 w-3.5" />
                    Ohne Telefon ({archiveWithoutPhone.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          {/* Preview / Archive list */}
          {properties.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 max-h-80 overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {showArchive ? 'Exportierte Deals' : `Vorschau (erste ${Math.min(properties.length, 10)})`}
              </p>
              {(showArchive ? archiveDisplayed : properties.slice(0, 10)).map(p => (
                <div key={p.id} className="flex items-center gap-3 bg-background rounded-lg px-3 py-2 text-sm">
                  <Users className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.owner_name || 'Kein Name'}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.address}</p>
                  </div>
                  {p.owner_phone && <Badge variant="outline" className="text-xs shrink-0">{p.owner_phone}</Badge>}
                  {p.zone && <Badge variant="secondary" className="text-xs shrink-0">{p.zone}</Badge>}
                  {showArchive && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 shrink-0"
                      disabled={restoring === p.id}
                      onClick={() => restoreFromArchive(p.id)}>
                      <ArchiveRestore className="h-3 w-3" />
                      {restoring === p.id ? '...' : 'Zurück'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {properties.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <p>{showArchive ? 'Noch keine exportierten Deals' : 'Keine Einträge mit diesem Status'}</p>
            </div>
          )}

          {/* Push result */}
          {pushResult && (
            <div className="rounded-lg border p-4 space-y-1 bg-muted/50">
              <div className="flex items-center gap-2">
                {pushResult.errors === 0 ? <CheckCircle className="h-5 w-5 text-green-600" /> : <AlertCircle className="h-5 w-5 text-orange-600" />}
                <p className="text-sm font-semibold">{pushResult.created} Deals erstellt</p>
              </div>
              {pushResult.skipped > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <SkipForward className="h-3 w-3" /> {pushResult.skipped} Duplikate übersprungen
                </p>
              )}
              {pushResult.errors > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-destructive">{pushResult.errors} Fehler:</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {pushResult.errorDetails.map((e, i) => (
                      <p key={i} className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">
                        <span className="font-medium">{e.address}:</span> {e.error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {!showArchive && (
            <div className="flex gap-3">
              <Button onClick={pushToPipedrive} disabled={isLoading || properties.length === 0 || pushing} className="flex-1 h-12 text-base gap-2" size="lg">
                {pushing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                {pushing ? 'Wird gepusht...' : `Zu Pipedrive pushen (${count})`}
              </Button>
              <Button onClick={exportCsv} disabled={isLoading || properties.length === 0} variant="outline" className="h-12 gap-2" size="lg">
                <Download className="h-4 w-4" /> CSV
              </Button>
            </div>
          )}

          {!showArchive && (
            <div className="text-xs text-muted-foreground text-center space-y-1">
              <p>✓ Custom Fields (Zone, Baujahr, HNF, etc.) werden automatisch erstellt</p>
              <p>✓ Pipeline "Immobilien-Akquise" mit Stages: Neuer Lead → Kontaktiert → Interesse</p>
              <p>✓ Duplikate werden erkannt und übersprungen</p>
              <p>✓ Nach Push → automatisch ins Archiv verschoben</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
