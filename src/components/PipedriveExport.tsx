import { useState } from 'react';
import { Download, FileSpreadsheet, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProperties } from '@/hooks/use-properties';
import { useToast } from '@/hooks/use-toast';

const EXPORT_STATUSES = ['Eigentümer ermittelt', 'Telefon gefunden', 'Kontaktiert', 'Interesse', 'Interessant'];

export function PipedriveExport() {
  const [exportStatus, setExportStatus] = useState('Eigentümer ermittelt');
  const { data: result, isLoading } = useProperties({ statusFilter: exportStatus, pageSize: 1000 });
  const { toast } = useToast();

  const properties = result?.data || [];
  const count = result?.count || 0;

  const exportCsv = () => {
    if (properties.length === 0) {
      toast({ title: 'Keine Daten zum Exportieren', variant: 'destructive' });
      return;
    }

    // Pipedrive-compatible CSV headers
    const headers = [
      'Person - Name', 'Person - Phone', 'Person - Address',
      'Person - Name 2', 'Person - Phone 2', 'Person - Address 2',
      'Deal - Title', 'Deal - Value',
      'Organization - Name', 'Organization - Address',
      'Note',
      // Extra fields
      'Liegenschaft - Adresse', 'Liegenschaft - PLZ/Ort', 'Liegenschaft - Gemeinde',
      'Liegenschaft - Zone', 'Liegenschaft - Baujahr', 'Liegenschaft - HNF m2',
      'Liegenschaft - Grundstück m2', 'Liegenschaft - Geschosse',
      'Liegenschaft - EGRID', 'Liegenschaft - EGID',
      'Status',
    ];

    const rows = properties.map(p => [
      p.owner_name || '',
      p.owner_phone || '',
      p.owner_address || '',
      (p as any).owner_name_2 || '',
      (p as any).owner_phone_2 || '',
      (p as any).owner_address_2 || '',
      `Akquise: ${p.address}`,
      '',
      '',
      p.address + (p.plz_ort ? ', ' + p.plz_ort : ''),
      p.notes || '',
      p.address,
      p.plz_ort || '',
      p.gemeinde || '',
      p.zone || '',
      p.baujahr?.toString() || '',
      p.gebaeudeflaeche ? Math.round(Number(p.gebaeudeflaeche)).toString() : '',
      p.area ? Math.round(Number(p.area)).toString() : '',
      p.geschosse ? Number(p.geschosse).toString() : '',
      p.egrid || '',
      p.gwr_egid || '',
      p.status,
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
        <p className="text-muted-foreground text-sm mt-1">CSV-Export im Pipedrive-Format für den CRM-Import</p>
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
                  <Badge variant="secondary" className="text-xs shrink-0">{p.zone}</Badge>
                </div>
              ))}
            </div>
          )}

          <Button onClick={exportCsv} disabled={isLoading || properties.length === 0} className="w-full h-12 text-base gap-2" size="lg">
            <FileSpreadsheet className="h-5 w-5" />
            CSV für Pipedrive exportieren ({count} Einträge)
            <Download className="h-4 w-4 ml-auto" />
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Importiere die CSV-Datei in Pipedrive unter Kontakte → Import → CSV-Datei
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
