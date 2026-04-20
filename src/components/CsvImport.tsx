import { useState, useRef } from 'react';
import { Upload, FileText, FileSpreadsheet, Check, Loader2, ListPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseCsv, type CsvProperty } from '@/lib/csv-parser';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

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
    .filter(p => p.address || p.egrid || p.plot_number);
}

interface MergeStats {
  matchedExisting: number;
  newlyCreated: number;
  skipped: number;
}

export function CsvImport() {
  const [preview, setPreview] = useState<CsvProperty[]>([]);
  const [fileName, setFileName] = useState('');
  const [listName, setListName] = useState('');
  const [importing, setImporting] = useState(false);
  const [stats, setStats] = useState<MergeStats | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const xlsxRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setStats(null);
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
    setStats(null);
    try {
      const parsed = await parseExcel(file);
      setPreview(parsed);
    } catch (err) {
      toast({ title: 'Fehler', description: 'Excel konnte nicht gelesen werden: ' + String(err), variant: 'destructive' });
    }
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    if (!listName.trim()) {
      toast({ title: 'Listen-Name fehlt', description: 'Bitte gib einen Namen für die neue Liste ein', variant: 'destructive' });
      return;
    }

    setImporting(true);
    setStats(null);

    try {
      // 1. Find or create the list
      let listId: string;
      const { data: existingList } = await supabase
        .from('property_lists')
        .select('id')
        .eq('name', listName.trim())
        .maybeSingle();

      if (existingList) {
        listId = existingList.id;
      } else {
        const { data: newList, error: listErr } = await supabase
          .from('property_lists')
          .insert({ name: listName.trim(), priority: 0, color: '#f59e0b', property_count: 0 })
          .select('id')
          .single();
        if (listErr) throw listErr;
        listId = newList.id;
      }

      // 2. Collect all EGRIDs and parzellen from upload
      const egrids = preview.map(p => p.egrid?.trim()).filter(Boolean) as string[];
      const parzellen = preview.map(p => p.plot_number?.trim()).filter(Boolean) as string[];

      // 3. Lookup existing properties (batched to avoid URL length limits)
      const existingByEgrid = new Map<string, string>(); // egrid -> property.id
      const existingByParzelle = new Map<string, string>(); // parzelle -> property.id

      const batchSize = 200;
      for (let i = 0; i < egrids.length; i += batchSize) {
        const batch = egrids.slice(i, i + batchSize);
        if (batch.length === 0) continue;
        const { data, error } = await supabase
          .from('properties')
          .select('id, egrid')
          .in('egrid', batch);
        if (error) throw error;
        data?.forEach(r => { if (r.egrid) existingByEgrid.set(r.egrid, r.id); });
      }

      for (let i = 0; i < parzellen.length; i += batchSize) {
        const batch = parzellen.slice(i, i + batchSize);
        if (batch.length === 0) continue;
        const { data, error } = await supabase
          .from('properties')
          .select('id, parzelle')
          .in('parzelle', batch);
        if (error) throw error;
        data?.forEach(r => { if (r.parzelle) existingByParzelle.set(r.parzelle, r.id); });
      }

      // 4. Sort: existing → assign list_id; new → insert
      const matchedIds: string[] = [];
      const toInsert: Record<string, unknown>[] = [];
      let skipped = 0;

      for (const p of preview) {
        const egrid = p.egrid?.trim();
        const parzelle = p.plot_number?.trim();
        let matchId: string | undefined;
        if (egrid) matchId = existingByEgrid.get(egrid);
        if (!matchId && parzelle) matchId = existingByParzelle.get(parzelle);

        if (matchId) {
          matchedIds.push(matchId);
        } else if (p.address || egrid || parzelle) {
          toInsert.push({
            address: p.address || `Parzelle ${parzelle || egrid || '?'}`,
            area: p.area ?? null,
            plot_number: parzelle ?? null,
            parzelle: parzelle ?? null,
            egrid: egrid ?? null,
            bfs_nr: p.bfs_nr ?? null,
            streetview_url: p.streetview_url ?? null,
            list_id: listId,
            geb_status: 'Bestehend',
            status: 'Neu',
          });
        } else {
          skipped++;
        }
      }

      // 5. Update existing properties → assign to this list AND set to "Vorausgewählt" so they show in Akquise immediately
      let matchedCount = 0;
      for (let i = 0; i < matchedIds.length; i += batchSize) {
        const batch = matchedIds.slice(i, i + batchSize);
        const { error } = await supabase
          .from('properties')
          .update({ list_id: listId, status: 'Vorausgewählt', is_queried: false })
          .in('id', batch);
        if (error) throw error;
        matchedCount += batch.length;
      }

      // 6. Insert new properties (batched) — directly as "Vorausgewählt"
      let createdCount = 0;
      const toInsertPreselected = toInsert.map(r => ({ ...r, status: 'Vorausgewählt' }));
      for (let i = 0; i < toInsertPreselected.length; i += 100) {
        const batch = toInsertPreselected.slice(i, i + 100);
        const { error } = await supabase.from('properties').insert(batch as never);
        if (error) {
          // Likely EGRID conflict — try one-by-one to skip dupes
          for (const row of batch) {
            const { error: e2 } = await supabase.from('properties').insert(row as never);
            if (!e2) createdCount++;
          }
        } else {
          createdCount += batch.length;
        }
      }

      // 7. Update list count
      const { count } = await supabase
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .eq('list_id', listId);
      await supabase.from('property_lists').update({ property_count: count || 0 }).eq('id', listId);

      const finalStats: MergeStats = { matchedExisting: matchedCount, newlyCreated: createdCount, skipped };
      setStats(finalStats);

      toast({
        title: '✅ Import abgeschlossen',
        description: `Liste "${listName}": ${matchedCount} bestehende übernommen, ${createdCount} neu angelegt${skipped ? `, ${skipped} übersprungen` : ''}`,
      });

      qc.invalidateQueries({ queryKey: ['property_lists'] });
      qc.invalidateQueries({ queryKey: ['properties'] });

      setPreview([]);
      setFileName('');
    } catch (err) {
      toast({ title: 'Fehler beim Import', description: String(err), variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Datei Import</h2>
        <p className="text-muted-foreground mt-1">
          Lade eine Liste hoch — bestehende Einträge werden via EGRID/Parzelle abgeglichen, neue automatisch ergänzt.
        </p>
      </div>

      <Card className="border-dashed border-2 border-muted-foreground/25 bg-card">
        <CardContent className="p-12 flex flex-col items-center gap-4">
          <div className="rounded-full bg-muted p-4">
            <Upload className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium">CSV- oder Excel-Datei hierhin ziehen oder klicken</p>
            <p className="text-sm text-muted-foreground mt-1">Spalten: Adresse, Fläche, Parzelle, EGRID, BFS Nr., Streetview</p>
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
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="list-name" className="text-sm font-semibold flex items-center gap-1.5">
                <ListPlus className="h-4 w-4" /> Listen-Name
              </Label>
              <Input
                id="list-name"
                placeholder="z.B. PrioListe, Kampagne Mai, Top 100..."
                value={listName}
                onChange={e => setListName(e.target.value)}
                disabled={importing}
                className="max-w-md"
              />
              <p className="text-xs text-muted-foreground">
                Existiert dieser Name bereits, werden Einträge ergänzt — sonst wird sie neu angelegt.
              </p>
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <h3 className="font-semibold">{preview.length} Einträge erkannt</h3>
              <Button onClick={handleImport} disabled={importing || !listName.trim()}>
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                {importing ? 'Importiere…' : 'Importieren & Abgleichen'}
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
                      <td className="p-2">{p.address || <span className="text-muted-foreground italic">–</span>}</td>
                      <td className="p-2 font-mono text-xs">{p.egrid || '–'}</td>
                      <td className="p-2">{p.area || '–'}</td>
                      <td className="p-2">{p.plot_number || '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 20 && (
                <p className="p-2 text-center text-sm text-muted-foreground">… und {preview.length - 20} weitere</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {stats && (
        <Card className="border-none shadow-md bg-accent/5">
          <CardContent className="p-6 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold text-primary">{stats.matchedExisting}</p>
              <p className="text-xs text-muted-foreground mt-1">Bestehend übernommen</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-accent">{stats.newlyCreated}</p>
              <p className="text-xs text-muted-foreground mt-1">Neu angelegt</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-muted-foreground">{stats.skipped}</p>
              <p className="text-xs text-muted-foreground mt-1">Übersprungen</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
