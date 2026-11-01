import type { ReactNode } from 'react';

/**
 * Die gemeinsamen Bausteine der Bereiche: Kopf, Abschnitt, leerer
 * Zustand. Cockpit und Baugesuche haben das Muster vorgegeben; damit
 * Übersicht, Nummern und Pipedrive nicht je eine eigene Fassung davon
 * bekommen, steht es einmal hier.
 */
export function Kopf({ ueber, titel, children }: { ueber?: string; titel: string; children?: ReactNode }) {
  return (
    <header className="space-y-2">
      {ueber && <p className="text-sm font-semibold text-muted-foreground">{ueber}</p>}
      <h1 className="text-3xl sm:text-4xl">{titel}</h1>
      {children && <div className="max-w-2xl text-muted-foreground">{children}</div>}
    </header>
  );
}

/** Überschrift mit Zahl daneben und, falls nötig, einer Handlung rechts. */
export function Abschnitt({ titel, zahl, rechts, hinweis, children }: {
  titel: string; zahl?: number | string; rechts?: ReactNode; hinweis?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-xl">{titel}</h2>
        {zahl != null && <span className="text-sm tabular-nums text-muted-foreground">{zahl}</span>}
        {rechts && <div className="ml-auto flex flex-wrap items-center gap-2">{rechts}</div>}
      </div>
      {hinweis && <p className="max-w-2xl text-sm text-muted-foreground">{hinweis}</p>}
      {children}
    </section>
  );
}

export function Leer({ titel, children }: { titel: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-8 text-center">
      <p className="font-medium">{titel}</p>
      {children && <p className="mt-1 text-sm text-muted-foreground">{children}</p>}
    </div>
  );
}

/** Liste in einer Fläche, Zeilen durch Linien getrennt. */
export const LISTE = 'divide-y rounded-2xl border bg-card';

/** Knöpfe und Felder: 44 px hoch, damit sie auf dem Handy treffen. */
export const KNOPF = 'inline-flex h-11 items-center justify-center rounded-full border bg-card px-4 text-sm font-medium transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-50';
export const KNOPF_HAUPT = 'inline-flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40';
export const FELD = 'h-11 min-w-0 rounded-full border bg-card px-4 text-sm';
