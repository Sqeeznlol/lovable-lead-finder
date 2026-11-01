import { Component, type ReactNode } from 'react';

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
  }

  render() {
    if (!this.state.fehler) return this.props.children;
    return (
      <div className="mx-auto max-w-lg rounded-2xl border bg-card p-8 text-center">
        <p className="text-lg font-semibold">{this.props.bereich} konnte nicht angezeigt werden.</p>
        <p className="mt-2 text-sm text-muted-foreground">Die übrigen Bereiche funktionieren. Technische Meldung: {this.state.fehler}</p>
        <button type="button" onClick={() => this.setState({ fehler: null })}
                className="mt-5 h-11 rounded-xl bg-foreground px-5 text-sm font-semibold text-background">
          Nochmals versuchen
        </button>
      </div>
    );
  }
}
