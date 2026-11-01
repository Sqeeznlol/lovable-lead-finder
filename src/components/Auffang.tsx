import { Component, type ReactNode } from 'react';
import { istFehlendeFassung, neuLadenEinmal } from '@/lib/neue-fassung';

/**
 * Fängt einen Fehler in EINEM Bereich auf, statt die ganze Anwendung
 * leer zu lassen. Gemessen am 1. November: eine Antwort ohne erwartete
 * Liste liess im Bereich "Gelegenheiten" die ganze Seite weiss werden --
 * auch Leiste und Navigation waren weg, man kam nicht mehr hinaus.
 */
export class Auffang extends Component<{ children: ReactNode; bereich: string }, { fehler: string | null }> {
  state = { fehler: null as string | null };

  static getDerivedStateFromError(e: unknown) {
    return { fehler: e instanceof Error ? e.message : String(e) };
  }

  componentDidCatch(e: unknown) {
    console.error(`Fehler im Bereich ${this.props.bereich}:`, e);
    // Fehlt nur der Programmteil einer älteren Fassung, ist nichts kaputt:
    // einmal neu laden holt die neue (src/lib/neue-fassung.ts).
    if (istFehlendeFassung(this.state.fehler ?? String(e))) neuLadenEinmal();
  }

  render() {
    if (!this.state.fehler) return this.props.children;
    return (
      <div className="mx-auto max-w-lg rounded border bg-card p-8 text-center">
        <p className="text-lg font-semibold">{this.props.bereich} konnte nicht angezeigt werden.</p>
        <p className="mt-2 text-sm text-muted-foreground">Die übrigen Bereiche funktionieren. Technische Meldung: {this.state.fehler}</p>
        <button type="button" onClick={() => (istFehlendeFassung(this.state.fehler ?? '') ? window.location.reload() : this.setState({ fehler: null }))}
                className="mt-5 h-11 rounded-[3px] bg-foreground px-5 text-sm font-medium text-background">
          Nochmals versuchen
        </button>
      </div>
    );
  }
}
