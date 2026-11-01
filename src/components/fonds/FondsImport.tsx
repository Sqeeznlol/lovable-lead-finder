import { useState } from 'react';
import { Auswahl } from '@/components/Auswahl';
import { Loader2, Upload } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { zeilenLesen, type Ergebnis } from '@/lib/portfolio-import';
import { einspielen, verorten, zuordnenAlle, type Fonds } from '@/lib/fonds';
import { FELD, KNOPF, KNOPF_HAUPT } from '@/components/rahmen';

/**
 * Datensätze direkt einspielen: Adressen oder EGRID aus Excel oder CSV
 * einfügen oder als Datei wählen, Fonds wählen -- dann ordnet der Bund
 * zu, und gleich danach stehen die Liegenschaften im Universum und ihre
 * Potenziale in der Liste. Ohne Zwischenschritt bei uns (Julian: "es
 * muss direkt eingespiesen werden").
 */
export function FondsImport({ mandant, fonds, onFertig }: { mandant: string; fonds: Fonds[]; onFertig: () => void }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [ziel, setZiel] = useState<string>(fonds[0]?.id ?? 'neu');
  const [name, setName] = useState('');
  const [lauf, setLauf] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<Ergebnis[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [bilanz, setBilanz] = useState<{ neu: number; schon: number } | null>(null);

  const zeilen = zeilenLesen(text);
  const datei = async (f: File | undefined) => { if (f) setText(await f.text()); };

  const los = async () => {
    setFehler(null);
    try {
      setLauf('Zuordnen beim Bund …');
      const e = await zuordnenAlle(zeilen, (f, t) => setLauf(`Zuordnen beim Bund: ${f} von ${t}`));
      setLauf('Einspielen …');
      // Das Ergebnis erst nach dem Einspielen zeigen: vorher erschien
      // "eingespielt" auch, wenn das Speichern scheiterte.
      const b = await einspielen(mandant, ziel === 'neu' ? null : ziel, name || `Fonds ${fonds.length + 1}`, e);
      setBilanz(b);
      setErgebnis(e);
      const neu = e.filter(x => x.parzelleId).map(x => ({ id: x.parzelleId!, egrid: x.egrid }));
      setLauf('Lage und Nachbarn beim Bund …');
      await verorten(neu, (f, t) => setLauf(`Lage und Nachbarn beim Bund: ${f} von ${t}`));
      await qc.invalidateQueries({ queryKey: ['fonds-universum'] });
      setLauf(null);
    } catch (x) {
      setLauf(null);
      const grund = x instanceof Error ? x.message : (x as { message?: string })?.message;
      setFehler(`Einspielen nicht möglich${grund ? `: ${grund}` : '.'}`);
    }
  };

  const zahl = (z: Ergebnis['zuordnung']) => ergebnis?.filter(e => e.zuordnung === z).length ?? 0;

  if (ergebnis && !lauf) {
    return (
      <div className="space-y-4">
        <p className="font-semibold">{zahl('zugeordnet')} von {ergebnis.length} Liegenschaften zugeordnet.</p>
        {bilanz && bilanz.schon > 0 && (
          <p className="text-sm text-muted-foreground">{bilanz.neu} neu im Fonds, {bilanz.schon} standen schon drin und wurden nicht doppelt eingetragen.</p>
        )}
        <dl className="grid grid-cols-3 gap-2 text-sm">
          {([['zugeordnet', 'Zugeordnet'], ['mehrdeutig', 'Mehrdeutig'], ['nicht gefunden', 'Nicht gefunden']] as const).map(([z, t]) => (
            <div key={z} className="rounded-[3px] border px-3 py-2"><dt className="text-xs text-muted-foreground">{t}</dt><dd className="text-lg font-semibold">{zahl(z)}</dd></div>
          ))}
        </dl>
        {ergebnis.some(e => e.zuordnung !== 'zugeordnet') && (
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
            {ergebnis.filter(e => e.zuordnung !== 'zugeordnet').map(e => <li key={e.roh}>{e.roh} -- {e.grund}</li>)}
          </ul>
        )}
        <button type="button" className={`${KNOPF_HAUPT} w-full`} onClick={onFertig}>Zum Universum</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">In welchen Fonds</span>
        <Auswahl label="In welchen Fonds" wert={ziel} setWert={setZiel} className="w-full"
                 optionen={[...fonds.map(f => ({ wert: f.id, titel: `Fonds ${f.nr} · ${f.name.replace(/^Immofonds \d+ · /, '')}` })), { wert: 'neu', titel: 'Neuer Fonds …' }]} />
      </label>
      {ziel === 'neu' && (
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name des Fonds" aria-label="Name des neuen Fonds" className={`${FELD} w-full`} />
      )}
      <textarea value={text} onChange={e => setText(e.target.value)} rows={6}
                placeholder={'Eine Adresse oder EGRID je Zeile, z.B.\nSeestrasse 15, 8610 Uster\nCH123456789012'}
                className="w-full rounded-[3px] border bg-card px-3.5 py-3 text-sm" />
      <div className="flex gap-2 [&>*]:flex-1">
        <label className={`${KNOPF} cursor-pointer`}>
          <Upload className="h-4 w-4" /> Datei (CSV, TXT)
          <input type="file" accept=".csv,.txt,.tsv" className="sr-only" onChange={e => void datei(e.target.files?.[0])} />
        </label>
        <button type="button" className={KNOPF_HAUPT} disabled={!zeilen.length || !!lauf || (ziel === 'neu' && !name.trim())} onClick={los}>
          {lauf ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {zeilen.length ? `${zeilen.length} einspielen` : 'Einspielen'}
        </button>
      </div>
      {lauf && <p className="text-sm text-muted-foreground">{lauf}</p>}
      {fehler && <p className="text-sm text-destructive">{fehler}</p>}
    </div>
  );
}
