import { useEffect, useRef, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { ortSuchen, type Ort } from '@/lib/karte3d';

const ART: Record<Ort['art'], string> = { adresse: 'Adresse', parzelle: 'Parzelle', plz: 'PLZ', gemeinde: 'Gemeinde' };

/**
 * Suche über der 3D-Karte: Strasse, Adresse, Parzellennummer, PLZ oder
 * Gemeinde (Julian, 3. November: "eine Parzellensuche mit Strasse").
 * Gesucht wird beim Bund, nicht in unserer Datenbank -- die kennt die
 * Adressen aller Häuser ohnehin nicht, und jede Eingabe dort hätte die
 * grosse Tabelle der Parzellen ganz gelesen.
 */
export function Suche3D({ onWahl }: { onWahl: (o: Ort) => void }) {
  const [text, setText] = useState('');
  // Die Treffer gehören zu einem Suchtext. Enter nimmt nur Treffer des
  // aktuellen Texts -- sonst wählte schnelles Tippen den Treffer der
  // vorigen Suche (im Test: "AR6739" landete an der Freilagerstrasse).
  const [ergebnis, setErgebnis] = useState<{ fuer: string; liste: Ort[] } | null>(null);
  const enterWartet = useRef(false);
  const waehlenRef = useRef<(o: Ort) => void>(() => {});
  const [laeuft, setLaeuft] = useState(false);
  const [aktiv, setAktiv] = useState(0);
  const [offen, setOffen] = useState(false);
  const feld = useRef<HTMLInputElement>(null);
  // Der Titel des gewählten Treffers steht danach im Feld -- er ist keine
  // neue Suche (sonst kam zu "Parzelle AR6739" eine Liste von Gemeinden).
  const gewaehlt = useRef<string | null>(null);

  useEffect(() => {
    const t = text.trim();
    if (t.length < 2) { setErgebnis(null); setLaeuft(false); return; }
    if (t === gewaehlt.current) return;
    const ab = new AbortController();
    const zeit = window.setTimeout(async () => {
      setLaeuft(true);
      try {
        const r = await ortSuchen(t, ab.signal);
        if (ab.signal.aborted) return;
        setErgebnis({ fuer: t, liste: r });
        setAktiv(0);
        if (enterWartet.current && r.length) { enterWartet.current = false; waehlenRef.current(r[0]); return; }
        setOffen(true);
      } catch { if (!ab.signal.aborted) setErgebnis({ fuer: t, liste: [] }); }
      finally { if (!ab.signal.aborted) setLaeuft(false); }
    }, 250);
    return () => { ab.abort(); window.clearTimeout(zeit); };
  }, [text]);

  const treffer = ergebnis?.fuer === text.trim() ? ergebnis.liste : null;
  const waehlen = (o: Ort) => {
    enterWartet.current = false;
    onWahl(o);
    gewaehlt.current = o.titel;
    setText(o.titel);
    setOffen(false);
    feld.current?.blur();
  };
  waehlenRef.current = waehlen;

  return (
    <div className="relative w-full sm:w-[340px]">
      <div className="flex h-11 items-center gap-2 rounded-[3px] bg-white px-3 text-[#111] shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
        {laeuft ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#666]" /> : <Search className="h-4 w-4 shrink-0 text-[#666]" />}
        <input ref={feld} value={text} onChange={e => setText(e.target.value)} onFocus={() => treffer && setOffen(true)}
          onBlur={() => window.setTimeout(() => setOffen(false), 150)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !treffer && text.trim().length >= 2) { e.preventDefault(); enterWartet.current = true; return; }
            if (!treffer?.length) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setAktiv(a => Math.min(a + 1, treffer.length - 1)); setOffen(true); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setAktiv(a => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); waehlen(treffer[aktiv] ?? treffer[0]); }
            else if (e.key === 'Escape') setOffen(false);
          }}
          placeholder="Strasse, Adresse oder Parzelle" aria-label="Ort suchen" enterKeyHint="search"
          role="combobox" aria-expanded={offen} aria-controls="suche3d-liste" aria-autocomplete="list"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#888]" />
        {text && (
          <button type="button" onClick={() => { setText(''); setErgebnis(null); feld.current?.focus(); }}
                  className="-mr-2 grid h-11 w-9 shrink-0 place-items-center text-[#666]" aria-label="Suche leeren"><X className="h-4 w-4" /></button>
        )}
      </div>
      {offen && treffer && (
        <ul id="suche3d-liste" role="listbox"
            className="absolute inset-x-0 top-12 max-h-[min(60vh,420px)] overflow-y-auto rounded-[3px] bg-white py-1 text-[#111] shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
          {treffer.length === 0 && <li className="px-3 py-3 text-sm text-[#666]">Nichts gefunden.</li>}
          {treffer.map((o, i) => (
            <li key={`${o.art}-${o.titel}-${o.lat}`} role="option" aria-selected={i === aktiv}>
              <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => waehlen(o)} onMouseEnter={() => setAktiv(i)}
                      className={`flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left ${i === aktiv ? 'bg-[#f2f2f2]' : ''}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{o.titel}</span>
                  <span className="block truncate text-xs text-[#666]">{o.unter}</span>
                </span>
                <span className="shrink-0 text-[11px] text-[#888]">{ART[o.art]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
