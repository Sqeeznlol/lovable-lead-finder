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
      <h1 className="text-[32px] leading-[1.1] sm:text-[40px]">{titel}</h1>
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

/**
 * Knöpfe und Felder nach DESIGN.md, 44 px hoch, damit sie auf dem
 * Handy treffen. Haupthandlung: blaue Pille. Nebenhandlung: Pille mit
 * blauer Linie -- alles Klickbare ist blau, es gibt keinen zweiten
 * Akzent. Beim Drücken gibt der Knopf nach (scale 0.95).
 */
export const KNOPF = 'inline-flex h-11 items-center justify-center rounded-full border border-primary px-[18px] text-[15px] text-primary transition-[transform,background-color] duration-150 hover:bg-primary/5 active:scale-95 disabled:pointer-events-none disabled:opacity-40';
export const KNOPF_HAUPT = 'inline-flex h-11 items-center justify-center rounded-full bg-primary px-[22px] text-[15px] text-primary-foreground transition-[transform,background-color] duration-150 hover:bg-primary/90 active:scale-95 disabled:pointer-events-none disabled:bg-foreground/20 disabled:text-foreground/50';
export const FELD = 'h-11 min-w-0 rounded-full border border-input bg-card px-4 text-[15px] placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25';
