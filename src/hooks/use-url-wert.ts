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
export function useUrlWert(name: string, vorgabe: string | null = null) {
  const [suche, setSuche] = useSearchParams();
  const wert = suche.get(name) ?? vorgabe;
  const setze = useCallback((v: string | null) => {
    setSuche(alt => {
      const neu = new URLSearchParams(alt);
      if (v == null || v === '' || v === vorgabe) neu.delete(name); else neu.set(name, v);
      return neu;
    });
  }, [name, vorgabe, setSuche]);
  return [wert, setze] as const;
}

/** Mehrere Werte auf einmal -- ein Eintrag im Verlauf, nicht drei. */
export function useUrlSetzen() {
  const [, setSuche] = useSearchParams();
  return useCallback((werte: Record<string, string | null>) => {
    setSuche(alt => {
      const neu = new URLSearchParams(alt);
      for (const [k, v] of Object.entries(werte)) {
        if (v == null || v === '') neu.delete(k); else neu.set(k, v);
      }
      return neu;
    });
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
    else setSuche(alt => { const neu = new URLSearchParams(alt); neu.delete(name); return neu; }, { replace: true });
  }, [ort.key, navigate, name, setSuche]);
}
