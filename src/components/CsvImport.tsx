import { useState, useRef } from 'react';
import { Upload, FileText, FileSpreadsheet, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { parseCsv, type CsvProperty } from '@/lib/csv-parser';
import { useInsertProperties } from '@/hooks/use-properties';
import { useToast } from '@/hooks/use-toast';

async function parseExcel(file: File): Promise<CsvProperty[]> {
  const XLSX = await import('xlsx');
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

  if (rows.length === 0) return [];

  const findKey = (row: Record<string, string>, names: string[]) =>
    Object.keys(row).find(k => names.some(n => k.toLowerCase().includes(n)));

  const sample = rows[0];
  const addressKey = findKey(sample, ['adresse', 'address', 'strasse']) || Object.keys(sample)[0];
  const areaKey = findKey(sample, ['fläche', 'flaeche', 'area']);
  const plotKey = findKey(sample, ['grundstück', 'grundstueck', 'plot', 'parzelle', 'nummer']);
  const egridKey = findKey(sample, ['egrid', 'eidg']);
  const bfsKey = findKey(sample, ['bfs', 'gemeinde']);
  const streetviewKey = findKey(sample, ['streetview', 'street_view', 'google']);

  return rows
    .map(r => ({
      address: String(r[addressKey!] || ''),
      area: areaKey ? parseFloat(String(r[areaKey])) || undefined : undefined,
      plot_number: plotKey ? String(r[plotKey]) || undefined : undefined,
      egrid: egridKey ? String(r[egridKey]) || undefined : undefined,
      bfs_nr: bfsKey ? String(r[bfsKey]) || undefined : undefined,
      streetview_url: streetviewKey ? String(r[streetviewKey]) || undefined : undefined,
    }))
    .filter(p => p.address);
}

export function CsvImport() {
  const [preview, setPreview] = useState<CsvProperty[]>([]);
  const [fileName, setFileName] = useState('');
  const csvRef = useRef<HTMLInputElement>(null);
  const xlsxRef = useRef<HTMLInputElement>(null);
  const insertProps = useInsertProperties();
  const { toast } = useToast();

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setPreview(parseCsv(text));
    };
    reader.readAsText(file);
  };

  const handleExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const parsed = await parseExcel(file);
      setPreview(parsed);
    } catch (err) {
      toast({ title: 'Fehler', description: 'Excel konnte nicht gelesen werden: ' + String(err), variant: 'destructive' });
    }
  };

  const handleImport = () => {
    if (preview.length === 0) return;
    insertProps.mutate(
      preview.map(p => ({
        address: p.address,
        area: p.area ?? null,
        plot_number: p.plot_number ?? null,
        egrid: p.egrid ?? null,
        bfs_nr: p.bfs_nr ?? null,
        streetview_url: p.streetview_url ?? null,
      })),
      {
        onSuccess: () => {
          toast({ title: 'Import erfolgreich', description: `${preview.length} Liegenschaften importiert` });
          setPreview([]);
          setFileName('');
        },
        onError: (err) => toast({ title: 'Fehler', description: String(err), variant: 'destructive' }),
      }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Datei Import</h2>
        <p className="text-muted-foreground mt-1">Lade deine Liegenschafts-Liste hoch (CSV oder Excel)</p>
      </div>

      <Card className="border-dashed border-2 border-muted-foreground/25 bg-card">
        <CardContent className="p-12 flex flex-col items-center gap-4">
          <div className="rounded-full bg-muted p-4">
            <Upload className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium">CSV- oder Excel-Datei hierhin ziehen oder klicken</p>
            <p className="text-sm text-muted-foreground mt-1">Spalten: Adresse, Fläche, Grundstück Nr., EGRID, BFS Nr., Streetview</p>
          </div>
          <input ref={csvRef} type="file" accept=".csv,.txt,.tsv" onChange={handleCsvFile} className="hidden" />
          <input ref={xlsxRef} type="file" accept=".xlsx,.xls" onChange={handleExcelFile} className="hidden" />
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => csvRef.current?.click()}>
              <FileText className="h-4 w-4 mr-2" /> CSV-Datei
            </Button>
            <Button variant="outline" onClick={() => xlsxRef.current?.click()}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel-Datei
            </Button>
          </div>
          {fileName && <p className="text-sm text-muted-foreground">{fileName}</p>}
        </CardContent>
      </Card>

      {preview.length > 0 && (
        <Card className="border-none shadow-md">
          <CardContent className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">{preview.length} Einträge erkannt</h3>
              <Button onClick={handleImport} disabled={insertProps.isPending}>
                <Check className="h-4 w-4 mr-2" /> Importieren
              </Button>
            </div>
            <div className="max-h-64 overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2">Adresse</th>
                    <th className="text-left p-2">EGRID</th>
                    <th className="text-left p-2">Fläche</th>
                    <th className="text-left p-2">Parzelle</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 20).map((p, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{p.address}</td>
                      <td className="p-2 font-mono text-xs">{p.egrid || '–'}</td>
                      <td className="p-2">{p.area || '–'}</td>
                      <td className="p-2">{p.plot_number || '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 20 && (
                <p className="p-2 text-center text-sm text-muted-foreground">... und {preview.length - 20} weitere</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}