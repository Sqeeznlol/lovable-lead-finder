import { useState } from 'react';
import { Download, FileSpreadsheet, Users, Send, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProperties } from '@/hooks/use-properties';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const EXPORT_STATUSES = ['Eigentümer ermittelt', 'Telefon gefunden', 'Kontaktiert', 'Interesse', 'Interessant'];

export function PipedriveExport() {
  const [exportStatus, setExportStatus] = useState('Telefon gefunden');
  const { data: result, isLoading } = useProperties({ statusFilter: exportStatus, pageSize: 1000 });
  const { toast } = useToast();
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ success: number; errors: number } | null>(null);

  const properties = result?.data || [];
  const count = result?.count || 0;

  const pushToPipedrive = async () => {
    if (properties.length === 0) {
      toast({ title: 'Keine Daten zum Exportieren', variant: 'destructive' });
      return;
    }

    setPushing(true);
    setPushResult(null);

    try {
      // Send in batches of 20
      let success = 0;
      let errors = 0;

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
          owner_name: p.owner_name,
          owner_address: p.owner_address,
          owner_phone: p.owner_phone,
          owner_name_2: p.owner_name_2,
          owner_address_2: p.owner_address_2,
          owner_phone_2: p.owner_phone_2,
          notes: p.notes,
          status: p.status,
        }));

        const { data, error } = await supabase.functions.invoke('pipedrive-push', {
          body: { properties: batch },
        });

        if (error) {
          errors += batch.length;
        } else if (data?.results) {
          success += data.results.filter((r: any) => !r.error).length;
          errors += data.results.filter((r: any) => r.error).length;
        }
      }

      setPushResult({ success, errors });
      toast({
        title: errors === 0
          ? `✅ ${success} Deals in Pipedrive erstellt`
          : `⚠️ ${success} erstellt, ${errors} Fehler`,
        variant: errors > 0 ? 'destructive' : 'default',
      });
    } catch (err) {
      toast({ title: 'Fehler beim Push zu Pipedrive', description: String(err), variant: 'destructive' });
    } finally {
      setPushing(false);
    }
  };

  const exportCsv = () => {
    if (properties.length === 0) return;

    const headers = [
      'Person - Name', 'Person - Phone', 'Person - Address',
      'Person - Name 2', 'Person - Phone 2', 'Person - Address 2',
      'Deal - Title', 'Deal - Value',
      'Organization - Name', 'Organization - Address',
      'Note',
      'Liegenschaft - Adresse', 'Liegenschaft - PLZ/Ort', 'Liegenschaft - Gemeinde',
      'Liegenschaft - Zone', 'Liegenschaft - Baujahr', 'Liegenschaft - HNF m2',
      'Liegenschaft - Grundstück m2', 'Liegenschaft - Geschosse',
      'Liegenschaft - EGRID', 'Liegenschaft - EGID',
      'Status',
    ];

    const rows = properties.map(p => [
      p.owner_name || '', p.owner_phone || '', p.owner_address || '',
      p.owner_name_2 || '', p.owner_phone_2 || '', p.owner_address_2 || '',
      `Akquise: ${p.address}`, '',
      '', p.address + (p.plz_ort ? ', ' + p.plz_ort : ''),
      p.notes || '',
      p.address, p.plz_ort || '', p.gemeinde || '',
      p.zone || '', p.baujahr?.toString() || '',
      p.gebaeudeflaeche ? Math.round(Number(p.gebaeudeflaeche)).toString() : '',
      p.area ? Math.round(Number(p.area)).toString() : '',
      p.geschosse ? Number(p.geschosse).toString() : '',
      p.egrid || '', p.gwr_egid || '', p.status,
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pipedrive-export-${exportStatus.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: `✅ ${properties.length} Einträge exportiert` });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Pipedrive Export</h2>
        <p className="text-muted-foreground text-sm mt-1">Direkt zu Pipedrive pushen oder CSV exportieren</p>
      </div>

      <Card className="border-none shadow-lg">
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="space-y-1 flex-1">
              <label className="text-sm font-medium">Status filtern</label>
              <Select value={exportStatus} onValueChange={setExportStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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

          {/* Preview */}
          {properties.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 max-h-60 overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vorschau (erste 5)</p>
              {properties.slice(0, 5).map(p => (
                <div key={p.id} className="flex items-center gap-3 bg-background rounded-lg px-3 py-2 text-sm">
                  <Users className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.owner_name || 'Kein Name'}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.address}</p>
                  </div>
                  {p.owner_phone && <Badge variant="outline" className="text-xs shrink-0">{p.owner_phone}</Badge>}
                  {p.zone && <Badge variant="secondary" className="text-xs shrink-0">{p.zone}</Badge>}
                </div>
              ))}
            </div>
          )}

          {/* Push result */}
          {pushResult && (
            <div className={`rounded-lg border p-4 flex items-center gap-3 ${pushResult.errors === 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
              {pushResult.errors === 0 
                ? <CheckCircle className="h-5 w-5 text-green-600" />
                : <AlertCircle className="h-5 w-5 text-orange-600" />
              }
              <div>
                <p className="text-sm font-medium">{pushResult.success} Deals erstellt</p>
                {pushResult.errors > 0 && <p className="text-xs text-muted-foreground">{pushResult.errors} Fehler</p>}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button onClick={pushToPipedrive} disabled={isLoading || properties.length === 0 || pushing} className="flex-1 h-12 text-base gap-2" size="lg">
              {pushing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              {pushing ? 'Wird gepusht...' : `Direkt zu Pipedrive (${count})`}
            </Button>
            <Button onClick={exportCsv} disabled={isLoading || properties.length === 0} variant="outline" className="h-12 gap-2" size="lg">
              <Download className="h-4 w-4" />
              CSV
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Erstellt automatisch Organisation, Person(en) und Deal in Pipedrive
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
