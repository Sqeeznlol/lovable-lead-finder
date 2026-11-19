import { useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Ein Zustand, der in der Adresse steht statt im Speicher: welches
 * Vorhaben offen ist, welcher Reiter gewählt, welche Parzelle angezeigt.
 *
 * Julian (1. November): "für jeden Klick eine Unterseite, dass man
 * immer zurück drücken kann im Browser." Jede Änderung legt darum einen
 * Eintrag im Verlauf an; "Zurück" im Browser führt einen Schritt zurück,
 * und ein Link lässt sich weitergeben und öffnet dieselbe Ansicht.
 */
/**
 * React Router reicht dem Aktualisierer die Werte vom letzten Zeichnen;
 * setzt ein Tipp zwei Werte nacheinander (Gemeinde wählen, Zone
 * zurücksetzen), schreibt der zweite die alte Adresse zurück und der erste
 * ist weg. So blieb der Filter in «Parzellen nach Wunsch» und in den
 * Lead-Listen wirkungslos (19. November, Julian: «wenn ich filtere,
 * passiert nichts»). Darum merkt sich der Helper bis zum Ende des Tipps,
 * was er zuletzt geschrieben hat, und baut darauf auf.
 */
let zuletzt: URLSearchParams | null = null;
function weiter(alt: URLSearchParams, aendern: (neu: URLSearchParams) => void): URLSearchParams {
  const neu = new URLSearchParams(zuletzt ?? alt);
  aendern(neu);
  if (!zuletzt) queueMicrotask(() => { zuletzt = null; });
  zuletzt = neu;
  return neu;
}

export function useUrlWert(name: string, vorgabe: string | null = null) {
  const [suche, setSuche] = useSearchParams();
  const wert = suche.get(name) ?? vorgabe;
  const setze = useCallback((v: string | null) => {
    setSuche(alt => weiter(alt, neu => {
      if (v == null || v === '' || v === vorgabe) neu.delete(name); else neu.set(name, v);
    }));
  }, [name, vorgabe, setSuche]);
  return [wert, setze] as const;
}

/** Mehrere Werte auf einmal -- ein Eintrag im Verlauf, nicht drei. */
export function useUrlSetzen() {
  const [, setSuche] = useSearchParams();
  return useCallback((werte: Record<string, string | null>) => {
    setSuche(alt => weiter(alt, neu => {
      for (const [k, v] of Object.entries(werte)) {
        if (v == null || v === '') neu.delete(k); else neu.set(k, v);
      }
    }));
  }, [setSuche]);
}

/**
 * Schliessen wie "Zurück": wurde die Ansicht in der App geöffnet, geht
 * es einen Schritt zurück -- sonst stünde danach im Verlauf die offene
 * Ansicht vor der geschlossenen, und "Zurück" öffnete sie wieder. Kam
 * man über einen Link direkt hierher, wird der Wert nur entfernt.
 */
export function useSchliessen(name: string) {
  const navigate = useNavigate();
  const ort = useLocation();
  const [, setSuche] = useSearchParams();
  return useCallback(() => {
    if (ort.key !== 'default') navigate(-1);
    else setSuche(alt => weiter(alt, neu => neu.delete(name)), { replace: true });
  }, [ort.key, navigate, name, setSuche]);
}
