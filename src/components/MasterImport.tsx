import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, FileText, Loader2, Check, X, ListPlus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import {
  detectMapping,
  rowToMaster,
  isValidRow,
  masterRowToDbInsert,
  masterRowToDbUpdate,
  type ImportSummary,
  type MasterRow,
} from '@/lib/master-import';
import { Progress } from '@/components/ui/progress';

interface QueuedFile {
  file: File;
  status: 'pending' | 'parsing' | 'importing' | 'done' | 'error';
  rowCount?: number;
  summary?: ImportSummary;
  error?: string;
}

async function parseFile(file: File): Promise<{ rows: Record<string, unknown>[]; headers: string[] }> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { rows, headers };
}

const CHUNK = 500;

export function MasterImport() {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [listName, setListName] = useState('');
  const [updateExisting, setUpdateExisting] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setQueue(q => [...q, ...files.map(f => ({ file: f, status: 'pending' as const }))]);
  };

  const removeFile = (idx: number) => {
    setQueue(q => q.filter((_, i) => i !== idx));
  };

  const importAll = async () => {
    if (queue.length === 0) return;
    setImporting(true);
    setProgress(0);

    // 1. Find or create list (optional)
    let listId: string | null = null;
    if (listName.trim()) {
      const { data: existing } = await supabase
        .from('property_lists')
        .select('id')
        .eq('name', listName.trim())
        .maybeSingle();
      if (existing) listId = existing.id;
      else {
        const { data: created, error } = await supabase
          .from('property_lists')
          .insert({ name: listName.trim(), priority: 0, color: '#0ea5e9', property_count: 0 })
          .select('id')
          .single();
        if (error) {
          toast({ title: 'Liste konnte nicht erstellt werden', description: error.message, variant: 'destructive' });
          setImporting(false);
          return;
        }
        listId = created.id;
      }
    }

    // Pre-fetch existing gemeinden for "neue Gemeinden" stat
    const { data: existingGemeindenRows } = await supabase
      .from('properties')
      .select('gemeinde')
      .not('gemeinde', 'is', null);
    const existingGemeinden = new Set((existingGemeindenRows || []).map(r => r.gemeinde));

    let totalProcessed = 0;
    const totalRowsAcrossFiles = await preCountRows(queue);
    setProgressLabel(`0 / ${totalRowsAcrossFiles}`);

    for (let f = 0; f < queue.length; f++) {
      const item = queue[f];
      if (item.status === 'done') continue;
      setQueue(q => q.map((x, i) => i === f ? { ...x, status: 'parsing' } : x));

      try {
        const { rows, headers } = await parseFile(item.file);
        const mapping = detectMapping(headers);

        const summary: ImportSummary = {
          total: rows.length, inserted: 0, updated: 0, duplicates: 0, invalid: 0,
          newGemeinden: 0, errors: [],
        };
        const seenGemeinden = new Set<string>();

        // Convert + validate
        const masterRows: MasterRow[] = [];
        rows.forEach((r, idx) => {
          const m = rowToMaster(r, mapping, item.file.name);
          if (!isValidRow(m)) {
            summary.invalid++;
            return;
          }
          masterRows.push(m);
          if (m.gemeinde && !existingGemeinden.has(m.gemeinde) && !seenGemeinden.has(m.gemeinde)) {
            seenGemeinden.add(m.gemeinde);
            summary.newGemeinden++;
          }
        });

        setQueue(q => q.map((x, i) => i === f ? { ...x, status: 'importing', rowCount: rows.length } : x));

        // Process in chunks
        for (let i = 0; i < masterRows.length; i += CHUNK) {
          const chunk = masterRows.slice(i, i + CHUNK);

          // 1. Lookup existing by EGRID
          const egrids = chunk.map(r => r.egrid).filter(Boolean) as string[];
          const existingByEgrid = new Map<string, string>();
          if (egrids.length) {
            for (let j = 0; j < egrids.length; j += 200) {
              const batch = egrids.slice(j, j + 200);
              const { data } = await supabase
                .from('properties')
                .select('id, egrid')
                .in('egrid', batch);
              data?.forEach(d => { if (d.egrid) existingByEgrid.set(d.egrid, d.id); });
            }
          }

          // 2. Split: insert vs update
          const toInsert: Record<string, unknown>[] = [];
          const toUpdate: { id: string; row: MasterRow }[] = [];

          for (const row of chunk) {
            const matchId = row.egrid ? existingByEgrid.get(row.egrid) : undefined;
            if (matchId) {
              if (updateExisting) toUpdate.push({ id: matchId, row });
              else summary.duplicates++;
              if (listId) {
                // Only assign list_id, don't touch acquisition state
                await supabase.from('properties').update({ list_id: listId }).eq('id', matchId);
              }
            } else {
              const payload = masterRowToDbInsert(row);
              if (listId) payload.list_id = listId;
              toInsert.push(payload);
            }
          }

          // 3. Insert (handle EGRID conflicts gracefully)
          if (toInsert.length) {
            const { error } = await supabase.from('properties').insert(toInsert as never);
            if (error) {
              // Conflict — fallback to row-by-row
              for (const row of toInsert) {
                const { error: e2 } = await supabase.from('properties').insert(row as never);
                if (e2) summary.duplicates++;
                else summary.inserted++;
              }
            } else {
              summary.inserted += toInsert.length;
            }
          }

          // 4. Update existing — only enrich blank fields
          for (const { id, row } of toUpdate) {
            const updates = masterRowToDbUpdate(row);
            if (Object.keys(updates).length) {
              await supabase.from('properties').update(updates).eq('id', id);
              summary.updated++;
            }
          }

          totalProcessed += chunk.length;
          const pct = Math.min(99, Math.round((totalProcessed / Math.max(1, totalRowsAcrossFiles)) * 100));
          setProgress(pct);
          setProgressLabel(`${totalProcessed.toLocaleString('de-CH')} / ${totalRowsAcrossFiles.toLocaleString('de-CH')}`);
        }

        // Log import
        await supabase.from('import_logs').insert({
          file_name: item.file.name,
          list_id: listId,
          list_name: listName.trim() || null,
          rows_total: summary.total,
          rows_inserted: summary.inserted,
          rows_updated: summary.updated,
          rows_duplicates: summary.duplicates,
          rows_invalid: summary.invalid,
          new_gemeinden: summary.newGemeinden,
          details: { headers, mapping_count: mapping.length },
        } as never);

        // Add freshly seen gemeinden so subsequent files don't recount
        seenGemeinden.forEach(g => existingGemeinden.add(g));

        setQueue(q => q.map((x, i) => i === f ? { ...x, status: 'done', summary } : x));
      } catch (err) {
        const msg = String(err);
        setQueue(q => q.map((x, i) => i === f ? { ...x, status: 'error', error: msg } : x));
        toast({ title: `Fehler bei ${item.file.name}`, description: msg, variant: 'destructive' });
      }
    }

    // Refresh list count
    if (listId) {
      const { count } = await supabase
        .from('properties')
        .select('id', { count: 'exact', head: true })
        .eq('list_id', listId);
      await supabase.from('property_lists').update({ property_count: count || 0 }).eq('id', listId);
    }

    setProgress(100);
    setProgressLabel('Fertig');
    setImporting(false);
    qc.invalidateQueries({ queryKey: ['properties'] });
    qc.invalidateQueries({ queryKey: ['property_lists'] });
    qc.invalidateQueries({ queryKey: ['gemeinden'] });
    qc.invalidateQueries({ queryKey: ['master'] });
    qc.invalidateQueries({ queryKey: ['import_logs'] });
    toast({ title: '✅ Import abgeschlossen' });
  };

  const totalSummary = queue.reduce(
    (acc, q) => {
      if (!q.summary) return acc;
      acc.total += q.summary.total;
      acc.inserted += q.summary.inserted;
      acc.updated += q.summary.updated;
      acc.duplicates += q.summary.duplicates;
      acc.invalid += q.summary.invalid;
      acc.newGemeinden += q.summary.newGemeinden;
      return acc;
    },
    { total: 0, inserted: 0, updated: 0, duplicates: 0, invalid: 0, newGemeinden: 0 },
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Master-Import</h2>
        <p className="text-muted-foreground mt-1">
          Lade beliebig viele Excel- oder CSV-Dateien hoch. Die Dateien werden automatisch zu einer
          einzigen Master-Liste zusammengeführt – Duplikate werden anhand der EGRID erkannt.
        </p>
      </div>

      <Card className="border-dashed border-2 border-muted-foreground/25">
        <CardContent className="p-10 flex flex-col items-center gap-4">
          <div className="rounded-full bg-muted p-4">
            <Upload className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-medium">Excel- oder CSV-Dateien auswählen</p>
            <p className="text-sm text-muted-foreground mt-1">
              Du kannst mehrere Dateien gleichzeitig wählen. Spaltennamen werden automatisch erkannt.
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".xlsx,.xls,.csv,.tsv,.txt"
            onChange={onPick}
            className="hidden"
          />
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Dateien wählen
            </Button>
          </div>
        </CardContent>
      </Card>

      {queue.length > 0 && (
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="list-name" className="flex items-center gap-1.5">
                  <ListPlus className="h-4 w-4" /> Liste (optional)
                </Label>
                <Input
                  id="list-name"
                  placeholder="z.B. Master ZH 2026"
                  value={listName}
                  onChange={e => setListName(e.target.value)}
                  disabled={importing}
                />
                <p className="text-xs text-muted-foreground">
                  Leer lassen, um direkt in die globale Master-Liste zu importieren.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-7">
                <Switch checked={updateExisting} onCheckedChange={setUpdateExisting} disabled={importing} />
                <div>
                  <Label className="text-sm">Bestehende Datensätze anreichern</Label>
                  <p className="text-xs text-muted-foreground">
                    Akquise-Status, Notizen und Eigentümer werden nie überschrieben.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {queue.map((q, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium truncate flex-1">{q.file.name}</span>
                  <span className="text-xs text-muted-foreground">{(q.file.size / 1024 / 1024).toFixed(1)} MB</span>
                  <StatusBadge status={q.status} />
                  {q.summary && (
                    <span className="text-xs text-muted-foreground">
                      +{q.summary.inserted} / ↻{q.summary.updated} / ⤬{q.summary.duplicates}
                    </span>
                  )}
                  {q.status === 'pending' && !importing && (
                    <Button size="icon" variant="ghost" onClick={() => removeFile(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {importing && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{progressLabel}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={importAll} disabled={importing || queue.every(q => q.status === 'done')}>
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                {importing ? 'Importiere…' : 'Import starten'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {queue.some(q => q.summary) && (
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Check className="h-4 w-4 text-accent" /> Import-Zusammenfassung
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 text-center">
              <SummaryStat label="Gesamt" value={totalSummary.total} />
              <SummaryStat label="Neu" value={totalSummary.inserted} color="text-accent" />
              <SummaryStat label="Aktualisiert" value={totalSummary.updated} color="text-primary" />
              <SummaryStat label="Duplikate" value={totalSummary.duplicates} color="text-muted-foreground" />
              <SummaryStat label="Fehlerhaft" value={totalSummary.invalid} color="text-destructive" />
              <SummaryStat label="Neue Gemeinden" value={totalSummary.newGemeinden} color="text-foreground" />
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/30">
        <CardContent className="p-4 text-xs text-muted-foreground flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            Eine Liegenschaft (EGRID) existiert in der Master-Liste nur einmal. Re-Importierte
            Datensätze werden anhand der EGRID erkannt; bestehende Akquise-Daten bleiben unverändert.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

async function preCountRows(queue: QueuedFile[]): Promise<number> {
  // Quick estimate without full parse: file size in bytes / ~120 bytes per row.
  // Replaced with actual count once each file is parsed.
  return queue.reduce((acc, q) => acc + Math.max(1, Math.round(q.file.size / 200)), 0);
}

function StatusBadge({ status }: { status: QueuedFile['status'] }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: 'wartet', cls: 'bg-muted text-muted-foreground' },
    parsing: { label: 'lese', cls: 'bg-primary/10 text-primary' },
    importing: { label: 'importiere', cls: 'bg-primary/10 text-primary' },
    done: { label: '✓ fertig', cls: 'bg-accent/10 text-accent' },
    error: { label: 'Fehler', cls: 'bg-destructive/10 text-destructive' },
  };
  const c = map[status];
  return <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full ${c.cls}`}>{c.label}</span>;
}

function SummaryStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <p className={`text-2xl font-bold ${color || 'text-foreground'}`}>{value.toLocaleString('de-CH')}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}