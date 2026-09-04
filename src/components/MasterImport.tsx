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
  masterRowToImportJson,
  ParzellenSammler,
  FIELD_LABELS,
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

// Ein Block geht als ein einziger DB-Aufruf durch. Die Grösse ist ein
// Kompromiss: grosse Blöcke sparen Roundtrips, laufen aber eher in das
// Zeitlimit, das Supabase pro Anfrage setzt -- jede eingefügte Zeile wird
// vom Trigger durchgerechnet. Bei einem Fehler halbiert der Import den
// Block und versucht es erneut, bis MIN_CHUNK erreicht ist.
const CHUNK = 1000;
const MIN_CHUNK = 50;
const PARALLEL = 3;

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

    // ------------------------------------------------------------------
    // Erste Phase: alle Dateien einlesen und lokal zu einer Zeile je
    // Parzelle zusammenführen.
    //
    // Die Listen überschneiden sich stark -- teils enthält eine Datei eine
    // andere vollständig. Würde jede Gebäudezeile einzeln hochgeladen,
    // wären das über eine Million Anfragen-Nutzlast für einen Bruchteil an
    // tatsächlichen Parzellen. Zusammenführen kostet lokal Sekunden und
    // spart die Übertragung um ein Vielfaches.
    // ------------------------------------------------------------------
    const sammler = new ParzellenSammler();
    const gesamt: ImportSummary = {
      total: 0, inserted: 0, updated: 0, duplicates: 0, invalid: 0,
      newGemeinden: 0, fieldsFilled: 0, fieldDetail: {}, errors: [],
    };
    const seenGemeinden = new Set<string>();

    for (let f = 0; f < queue.length; f++) {
      const item = queue[f];
      setQueue(q => q.map((x, i) => (i === f ? { ...x, status: 'parsing' } : x)));
      setProgressLabel(`Lese ${item.file.name} …`);

      try {
        const { rows, headers } = await parseFile(item.file);
        const mapping = detectMapping(headers);
        gesamt.total += rows.length;

        const masterRows: MasterRow[] = [];
        for (const r of rows) {
          const m = rowToMaster(r, mapping, item.file.name);
          if (!isValidRow(m)) {
            gesamt.invalid++;
            continue;
          }
          masterRows.push(m);
          if (m.gemeinde && !existingGemeinden.has(m.gemeinde) && !seenGemeinden.has(m.gemeinde)) {
            seenGemeinden.add(m.gemeinde);
            gesamt.newGemeinden++;
          }
        }
        sammler.add(masterRows);

        setQueue(q => q.map((x, i) => (i === f
          ? { ...x, status: 'done', rowCount: rows.length }
          : x)));
        setProgressLabel(
          `${sammler.eingelesen.toLocaleString('de-CH')} Zeilen gelesen → ` +
          `${sammler.parzellen.toLocaleString('de-CH')} Parzellen`,
        );
        setProgress(Math.round(((f + 1) / queue.length) * 40));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setQueue(q => q.map((x, i) => (i === f ? { ...x, status: 'error', error: msg } : x)));
      }
    }

    const parzellen = sammler.ergebnis();
    gesamt.duplicates = sammler.eingelesen - parzellen.length;

    // ------------------------------------------------------------------
    // Zweite Phase: nur die zusammengeführten Parzellen übertragen.
    // ------------------------------------------------------------------
    const sendeBlock = async (block: MasterRow[]) => {
      const payload = block.map(masterRowToImportJson);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('import_properties', {
        p_rows: payload,
        p_list_id: listId,
        p_update_existing: updateExisting,
      });
      if (error) throw error;
      const r = Array.isArray(data) ? data[0] : data;
      gesamt.inserted += Number(r?.eingefuegt ?? 0);
      gesamt.updated += Number(r?.ergaenzt ?? 0);
      gesamt.fieldsFilled += Number(r?.felder_gefuellt ?? 0);
      for (const [feld, anzahl] of Object.entries(r?.felder_detail ?? {})) {
        gesamt.fieldDetail[feld] = (gesamt.fieldDetail[feld] ?? 0) + Number(anzahl);
      }
    };

    const meldeFortschritt = (anzahl: number) => {
      totalProcessed += anzahl;
      const pct = 40 + Math.min(59, Math.round((totalProcessed / Math.max(1, parzellen.length)) * 59));
      setProgress(pct);
      setProgressLabel(
        `${totalProcessed.toLocaleString('de-CH')} / ${parzellen.length.toLocaleString('de-CH')} Parzellen`,
      );
    };

    // Schlägt ein Block fehl, liegt das meist am Zeitlimit der Anfrage.
    // Dann wird er halbiert und erneut versucht; erst wenn auch kleine
    // Blöcke scheitern, ist es ein echter Fehler und wird gemeldet.
    const importBlock = async (block: MasterRow[]) => {
      try {
        await sendeBlock(block);
        meldeFortschritt(block.length);
      } catch (err) {
        if (block.length <= MIN_CHUNK) {
          const msg = err instanceof Error ? err.message : String(err);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const details = (err as any)?.details || (err as any)?.hint || '';
          gesamt.errors.push({
            row: totalProcessed,
            reason: `${block.length} Zeilen ab «${block[0]?.address}»: ${msg}${details ? ` (${details})` : ''}`,
          });
          meldeFortschritt(block.length);
          return;
        }
        const mitte = Math.ceil(block.length / 2);
        await importBlock(block.slice(0, mitte));
        await importBlock(block.slice(mitte));
      }
    };

    const bloecke: MasterRow[][] = [];
    for (let i = 0; i < parzellen.length; i += CHUNK) {
      bloecke.push(parzellen.slice(i, i + CHUNK));
    }
    for (let i = 0; i < bloecke.length; i += PARALLEL) {
      await Promise.all(bloecke.slice(i, i + PARALLEL).map(importBlock));
    }

    // ------------------------------------------------------------------
    // Dritte Phase: Kennzahlen nachrechnen.
    //
    // Während des Imports überspringt der Trigger die Berechnung -- das
    // halbiert die Importzeit. Jetzt werden die neuen Zeilen portionsweise
    // durchgerechnet; jeder Aufruf meldet, wie viele er geschafft hat, und
    // null bedeutet fertig.
    // ------------------------------------------------------------------
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: offen } = await (supabase as any).rpc('potenzial_offen');
      const gesamtOffen = Number(offen ?? 0);
      let gerechnet = 0;

      if (gesamtOffen > 0) {
        setProgressLabel(`Kennzahlen werden berechnet: 0 / ${gesamtOffen.toLocaleString('de-CH')}`);
        for (;;) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data, error } = await (supabase as any).rpc('potenzial_nachrechnen', { p_batch: 2000 });
          if (error) throw error;
          const n = Number(data ?? 0);
          if (n === 0) break;
          gerechnet += n;
          setProgress(Math.min(99, 40 + Math.round((gerechnet / gesamtOffen) * 59)));
          setProgressLabel(
            `Kennzahlen werden berechnet: ${gerechnet.toLocaleString('de-CH')} / ${gesamtOffen.toLocaleString('de-CH')}`,
          );
        }
      }
    } catch (err) {
      // Der Import selbst ist durch; fehlende Kennzahlen lassen sich
      // jederzeit nachholen, deshalb nur vermerken statt abbrechen.
      const msg = err instanceof Error ? err.message : String(err);
      gesamt.errors.push({ row: 0, reason: `Kennzahlen konnten nicht berechnet werden: ${msg}` });
    }

    setQueue(q => q.map(x => ({ ...x, summary: x.status === 'error' ? x.summary : gesamt })));

    {
      // Einen Log-Eintrag für den gesamten Lauf schreiben: die Zahlen
      // beziehen sich auf alle Dateien zusammen, da über Dateigrenzen
      // hinweg zusammengeführt wurde.
      await supabase.from('import_logs').insert({
        file_name: queue.map(q => q.file.name).join(', ').slice(0, 500),
        list_id: listId,
        list_name: listName.trim() || null,
        rows_total: gesamt.total,
        rows_inserted: gesamt.inserted,
        rows_updated: gesamt.updated,
        rows_duplicates: gesamt.duplicates,
        rows_invalid: gesamt.invalid,
        new_gemeinden: gesamt.newGemeinden,
        details: { parzellen: parzellen.length, felder: gesamt.fieldDetail },
      } as never);
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
      acc.fieldsFilled += q.summary.fieldsFilled;
      for (const [feld, anzahl] of Object.entries(q.summary.fieldDetail || {})) {
        acc.fieldDetail[feld] = (acc.fieldDetail[feld] ?? 0) + anzahl;
      }
      return acc;
    },
    {
      total: 0, inserted: 0, updated: 0, duplicates: 0, invalid: 0, newGemeinden: 0,
      fieldsFilled: 0, fieldDetail: {} as Record<string, number>,
    },
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
                <div key={i} className="rounded-lg border text-sm">
                  <div className="flex items-center gap-3 p-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium truncate flex-1">{q.file.name}</span>
                  <span className="text-xs text-muted-foreground">{(q.file.size / 1024 / 1024).toFixed(1)} MB</span>
                  <StatusBadge status={q.status} />
                  {q.summary && (
                    <span className="text-xs text-muted-foreground">
                      +{q.summary.inserted} neu / ↻{q.summary.updated} ergänzt / ⊕{q.summary.fieldsFilled} Zellen
                    </span>
                  )}
                  {q.status === 'pending' && !importing && (
                    <Button size="icon" variant="ghost" onClick={() => removeFile(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  </div>
                  {/* Fehlermeldungen ausschreiben: ohne den Text der Datenbank
                      lässt sich ein fehlgeschlagener Import nicht einordnen. */}
                  {q.error && (
                    <p className="px-3 pb-2 text-xs text-destructive break-words">{q.error}</p>
                  )}
                  {q.summary?.errors?.length ? (
                    <ul className="px-3 pb-2 space-y-1">
                      {q.summary.errors.slice(0, 5).map((e, k) => (
                        <li key={k} className="text-xs text-destructive break-words">· {e.reason}</li>
                      ))}
                      {q.summary.errors.length > 5 && (
                        <li className="text-xs text-muted-foreground">
                          … und {q.summary.errors.length - 5} weitere
                        </li>
                      )}
                    </ul>
                  ) : null}
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
              <SummaryStat label="Zellen gefüllt" value={totalSummary.fieldsFilled} color="text-accent" />
            </div>

            {/* Was die Listen tatsächlich beigetragen haben. "Ergänzt" allein
                sagt nicht, ob eine Liste eine PLZ nachgetragen hat oder für
                tausende Parzellen die fehlende Zone. */}
            {Object.keys(totalSummary.fieldDetail).length > 0 && (
              <div className="mt-5 border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Neu befüllte Felder
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(totalSummary.fieldDetail)
                    .sort((a, b) => b[1] - a[1])
                    .map(([feld, anzahl]) => (
                      <span
                        key={feld}
                        className="rounded-full bg-accent/10 px-2.5 py-1 text-xs text-foreground"
                      >
                        {FIELD_LABELS[feld] ?? feld}{' '}
                        <span className="font-semibold">{anzahl.toLocaleString('de-CH')}</span>
                      </span>
                    ))}
                </div>
              </div>
            )}
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