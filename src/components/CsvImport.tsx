import { useState, useRef } from 'react';
import { Upload, FileText, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { parseCsv } from '@/lib/csv-parser';
import { useInsertProperties } from '@/hooks/use-properties';
import { useToast } from '@/hooks/use-toast';

export function CsvImport() {
  const [preview, setPreview] = useState<ReturnType<typeof parseCsv>>([]);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const insertProps = useInsertProperties();
  const { toast } = useToast();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      setPreview(parsed);
    };
    reader.readAsText(file);
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
        <h2 className="text-3xl font-bold tracking-tight">CSV Import</h2>
        <p className="text-muted-foreground mt-1">Lade deine Liegenschafts-Liste hoch</p>
      </div>

      <Card className="border-dashed border-2 border-muted-foreground/25 bg-card">
        <CardContent className="p-12 flex flex-col items-center gap-4">
          <div className="rounded-full bg-muted p-4">
            <Upload className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium">CSV-Datei hierhin ziehen oder klicken</p>
            <p className="text-sm text-muted-foreground mt-1">Spalten: Adresse, Fläche, Grundstück Nr., EGRID, BFS Nr., Streetview</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" onChange={handleFile} className="hidden" />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <FileText className="h-4 w-4 mr-2" /> Datei auswählen
          </Button>
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
