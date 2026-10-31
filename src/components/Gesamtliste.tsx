import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { exportTimestamp } from '@/lib/export-utils';
import { useToast } from '@/hooks/use-toast';

/**
 * Der ganze Bestand als eine Datei -- Zürich und Thurgau, alle Zeilen,
 * alle Spalten.
 *
 * Nicht über `fetchAllProperties`: die sammelt erst alle 396'271
 * Objekte mit je 118 Feldern im Speicher und schreibt dann. Hier wird
 * jede Seite sofort zu CSV-Text und das Objekt fallengelassen.
 *
 * Und wo der Browser es kann, geht der Text direkt auf die Platte
 * statt in den Arbeitsspeicher. Bei dieser Menge ist das kein
 * Feinschliff: eine Datei von mehreren hundert Megabyte als Blob im
 * Speicher zu halten, bringt einen Browser zu Fall.
 *
 * Die Spaltennamen werden nicht aufgezählt, sondern aus der ersten
 * Seite genommen. So bleibt "alles" auch dann alles, wenn später eine
 * Spalte dazukommt.
 */
const SEITE = 1000;
const GLEICHZEITIG = 6;
/** Antwortet die Datenbank nicht, soll es auffallen statt sich zu drehen. */
const GEDULD_MS = 30_000;

function zelle(w: unknown): string {
  if (w === null || w === undefined) return '""';
  if (typeof w === 'boolean') return w ? '"ja"' : '"nein"';
  if (typeof w === 'object') return `"${JSON.stringify(w).replace(/"/g, '""')}"`;
  return `"${String(w).replace(/"/g, '""')}"`;
}

/** Ein Ziel zum Schreiben: Platte, wo möglich, sonst Speicher. */
interface Ziel {
  schreiben: (text: string) => Promise<void>;
  schliessen: () => Promise<void>;
}

async function zielWaehlen(dateiname: string): Promise<Ziel | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (typeof w.showSaveFilePicker === 'function') {
    try {
      const griff = await w.showSaveFilePicker({
        suggestedName: dateiname,
        types: [{ description: 'CSV', accept: { 'text/csv': ['.csv'] } }],
      });
      const strom = await griff.createWritable();
      return {
        schreiben: (t: string) => strom.write(t),
        schliessen: () => strom.close(),
      };
    } catch (e) {
      // Abgebrochener Speichern-Dialog ist kein Fehler.
      if ((e as DOMException)?.name === 'AbortError') return null;
      // Alles andere: der Weg über den Speicher bleibt.
    }
  }
  const stuecke: string[] = [];
  return {
    schreiben: async (t: string) => { stuecke.push(t); },
    schliessen: async () => {
      const blob = new Blob(stuecke, { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = dateiname;
      a.click();
      URL.revokeObjectURL(url);
    },
  };
}

export function Gesamtliste() {
  const { toast } = useToast();
  const [laeuft, setLaeuft] = useState(false);
  const [geholt, setGeholt] = useState(0);
  const [gesamt, setGesamt] = useState(0);

  const holen = async () => {
    setLaeuft(true);
    setGeholt(0);
    setGesamt(0);
    try {
      // Antwortet die Datenbank gar nicht -- pausiert, überlastet --,
      // bricht das hier ab. Ohne diese Frist dreht sich der Knopf
      // endlos und sagt nichts; im Probelauf war genau das der Fall.
      const zaehlen = supabase
        .from('properties')
        .select('id', { count: 'exact', head: true });
      const frist = new Promise<never>((_, weg) =>
        setTimeout(() => weg(new Error(
          'Die Datenbank antwortet nicht. Läuft sie, oder ist sie pausiert?',
        )), GEDULD_MS));
      const { count, error: zaehlfehler } =
        await Promise.race([zaehlen, frist]) as Awaited<typeof zaehlen>;

      if (zaehlfehler) throw zaehlfehler;
      const n = count ?? 0;
      if (n === 0) throw new Error('Die Datenbank meldet null Objekte.');
      setGesamt(n);

      const dateiname = `bauraum-gesamtliste_${exportTimestamp()}.csv`;
      const ziel = await zielWaehlen(dateiname);
      if (!ziel) { setLaeuft(false); return; }

      let kopfGeschrieben = false;
      let felder: string[] = [];
      const seiten = Math.ceil(n / SEITE);
      let fertig = 0;

      // Die Seiten haengen nicht voneinander ab -- also mehrere
      // gleichzeitig. Nacheinander waeren es bald vierhundert
      // Wartezeiten.
      for (let block = 0; block < seiten; block += GLEICHZEITIG) {
        const dran = Array.from(
          { length: Math.min(GLEICHZEITIG, seiten - block) },
          (_, i) => (block + i) * SEITE,
        );
        const teile = await Promise.all(dran.map(async von => {
          const { data, error } = await supabase
            .from('properties')
            .select('*')
            .order('kanton', { ascending: true })
            .order('gemeinde', { ascending: true, nullsFirst: false })
            .order('address', { ascending: true })
            .range(von, von + SEITE - 1);
          if (error) throw error;
          return (data ?? []) as unknown as Record<string, unknown>[];
        }));

        for (const zeilen of teile) {
          if (!kopfGeschrieben && zeilen.length > 0) {
            felder = Object.keys(zeilen[0]);
            await ziel.schreiben(
              '﻿' + felder.map(f => `"${f}"`).join(',') + '\n');
            kopfGeschrieben = true;
          }
          if (zeilen.length === 0) continue;
          await ziel.schreiben(
            zeilen.map(z => felder.map(f => zelle(z[f])).join(',')).join('\n')
            + '\n');
        }

        fertig += dran.length * SEITE;
        setGeholt(Math.min(fertig, n));
      }

      await ziel.schliessen();
      toast({
        title: 'Gesamtliste fertig',
        description: `${n.toLocaleString('de-CH')} Objekte, `
          + `${felder.length} Spalten, Zürich und Thurgau`,
      });
    } catch (e) {
      toast({
        title: 'Download fehlgeschlagen',
        description: (e as Error)?.message || 'Unbekannter Fehler',
        variant: 'destructive',
      });
    } finally {
      setLaeuft(false);
    }
  };

  const anteil = gesamt ? Math.round((geholt / gesamt) * 100) : 0;

  return (
    <button
      type="button"
      onClick={holen}
      disabled={laeuft}
      className="flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm
                 hover:bg-muted/50 disabled:opacity-60"
      title="Alle Objekte aus Zürich und Thurgau, alle Spalten, als CSV"
    >
      {laeuft
        ? <Loader2 className="h-4 w-4 animate-spin" />
        : <Download className="h-4 w-4" />}
      {laeuft
        ? (gesamt
            ? `${geholt.toLocaleString('de-CH')} von ${gesamt.toLocaleString('de-CH')} · ${anteil}%`
            : 'Zähle …')
        : 'Gesamtliste ZH + TG'}
    </button>
  );
}
