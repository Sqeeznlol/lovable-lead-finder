import type { ComponentType, ReactNode } from 'react';

/**
 * Die gemeinsamen Bausteine der Bereiche, gestaltet nach DESIGN.md
 * (Vorlage Matchora): fast eckig, feine Linien, Schwarz für die
 * Haupthandlung, Elektroblau als Akzent, Orange nur für "heiss".
 * Alle Bereiche bauen daraus, damit es eine Fassung gibt, nicht zehn.
 */

/**
 * Kopf eines Bereichs. Mit `bild` wie in der Vorlage: ein Luftbild
 * rechts, das nach links ins Weiss ausläuft, und der Titel davor. Ein
 * Verlauf, kein Weichzeichner -- der Text bleibt scharf.
 */
export function Kopf({ ueber, titel, children, bild, gross }: {
  ueber?: string; titel: string; children?: ReactNode; bild?: string | null; gross?: boolean;
}) {
  const text = (
    <header className="relative space-y-2">
      {ueber && <p className="text-sm text-muted-foreground">{ueber}</p>}
      <h1 className={gross ? 'max-w-xl text-[40px] leading-[1.05] sm:text-[56px]' : 'text-[32px] leading-[1.08] sm:text-[40px]'}>{titel}</h1>
      {children && <div className="max-w-2xl text-muted-foreground">{children}</div>}
    </header>
  );
  if (!bild) return text;
  return (
    <div className="relative -mx-4 -mt-6 overflow-hidden px-4 pb-8 pt-8 sm:-mx-10 sm:-mt-10 sm:px-10 sm:pb-12 sm:pt-12">
      <img src={bild} alt="" aria-hidden className="absolute inset-y-0 right-0 h-full w-full object-cover sm:w-3/4" loading="eager" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/10 sm:via-background/70" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
      {text}
    </div>
  );
}

/** Die farbige Kachel vor einem Tafeltitel, wie "Hot buyers" in der Vorlage. */
const KACHEL = {
  heiss: 'bg-heiss text-white',
  akzent: 'bg-accent text-white',
  schwarz: 'bg-foreground text-background',
  hell: 'bg-secondary text-foreground',
} as const;

/**
 * Überschrift eines Abschnitts: optional mit Kachel, Untertitel, Zahl
 * und einer Handlung rechts ("Alle zeigen").
 */
export function Abschnitt({ titel, zahl, rechts, hinweis, children, symbol, kachel = 'hell', unter }: {
  titel: string; zahl?: number | string; rechts?: ReactNode; hinweis?: ReactNode; children: ReactNode;
  symbol?: ComponentType<{ className?: string }>; kachel?: keyof typeof KACHEL; unter?: string;
}) {
  const Symbol = symbol;
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {Symbol && (
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[3px] ${KACHEL[kachel]}`}>
            <Symbol className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="flex items-baseline gap-2 text-xl">
            {titel}
            {zahl != null && <span className="text-sm font-normal text-muted-foreground">{zahl}</span>}
          </h2>
          {unter && <p className="text-sm text-muted-foreground">{unter}</p>}
        </div>
        {rechts && <div className="ml-auto flex flex-wrap items-center gap-2">{rechts}</div>}
      </div>
      {hinweis && <p className="max-w-2xl text-sm text-muted-foreground">{hinweis}</p>}
      {children}
    </section>
  );
}

export function Leer({ titel, children }: { titel: string; children?: ReactNode }) {
  return (
    <div className="rounded border bg-card p-8 text-center">
      <p className="font-medium">{titel}</p>
      {children && <p className="mt-1 text-sm text-muted-foreground">{children}</p>}
    </div>
  );
}

/** Liste in einer weissen Tafel, Zeilen durch feine Linien getrennt. */
export const LISTE = 'divide-y rounded border bg-card';

/**
 * Knöpfe und Felder, 44 px hoch (Handy). Wie in der Vorlage fast
 * eckig: Haupthandlung schwarz ("Send Property"), Nebenhandlung weiss
 * mit feiner Linie ("Add buyer"), leise Handlung grau ("View all"),
 * Akzent blau ("Ask AI"). Beim Drücken gibt der Knopf leicht nach.
 */
const KNOPF_GRUND = 'inline-flex h-11 items-center justify-center gap-2 rounded-[3px] px-4 text-[15px] font-medium transition-[transform,background-color,opacity] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40';
export const KNOPF = `${KNOPF_GRUND} border bg-card text-foreground hover:bg-secondary`;
export const KNOPF_HAUPT = `${KNOPF_GRUND} bg-primary text-primary-foreground hover:bg-primary/85`;
export const KNOPF_AKZENT = `${KNOPF_GRUND} bg-accent text-accent-foreground hover:bg-accent/90`;
export const KNOPF_LEISE = `${KNOPF_GRUND} bg-secondary text-foreground hover:bg-foreground/10`;
export const FELD = 'h-11 min-w-0 rounded-[3px] border border-input bg-card px-3.5 text-[15px] placeholder:text-muted-foreground focus:border-foreground focus:outline-none';

/**
 * Reiter wie "All 9 | Hot | Active | New" in der Vorlage: eine Leiste,
 * der gewählte dunkel gefüllt, die Zahl in einem Kästchen daneben.
 * Auf dem Handy waagrecht wischbar statt umbrechend.
 */
export function Reiter<T extends string>({ wahl, setWahl, optionen }: {
  wahl: T; setWahl: (w: T) => void; optionen: { wert: T; titel: string; zahl?: number }[];
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex min-w-max rounded-[3px] border bg-card p-1" role="tablist">
        {optionen.map(o => {
          const an = o.wert === wahl;
          return (
            <button key={o.wert} type="button" role="tab" aria-selected={an} onClick={() => setWahl(o.wert)}
                    className={`inline-flex h-10 items-center gap-2 rounded-[2px] px-4 text-[15px] transition-colors ${an ? 'bg-[#1E2433] text-white' : 'text-foreground/80 hover:text-foreground'}`}>
              {o.titel}
              {o.zahl != null && (
                <span className={`min-w-6 rounded-[2px] border px-1.5 text-xs leading-5 ${an ? 'border-white/30' : 'border-border text-muted-foreground'}`}>{o.zahl}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Kleine Marke: "+12 %" (lila), "+3 heute" (rosa), "3 Wochen" (minze), "Heiss" (voll orange). */
const MARKE = {
  lila: 'bg-accent/10 text-accent',
  rosa: 'bg-destructive/10 text-destructive',
  minze: 'bg-gruen/10 text-gruen',
  grau: 'bg-secondary text-muted-foreground',
  heiss: 'bg-heiss text-white',
  gruen: 'bg-gruen text-white uppercase tracking-wide',
  violett: 'bg-violett/10 text-violett',
} as const;
export function Marke({ art = 'grau', children }: { art?: keyof typeof MARKE; children: ReactNode }) {
  return <span className={`inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-[2px] px-2 text-xs font-medium ${MARKE[art]}`}>{children}</span>;
}

/**
 * Der Strichbalken der Vorlage ("Match 94 %"): dreissig senkrechte
 * Striche, so viele gefüllt, wie der Anteil sagt. Liest sich auf einen
 * Blick und braucht keine Achse.
 */
export function Strichbalken({ anteil, farbe = 'heiss', titel }: { anteil: number; farbe?: 'heiss' | 'akzent' | 'gruen'; titel?: string }) {
  const n = 30;
  const a = Math.max(0, Math.min(1, anteil));
  const voll = Math.round(a * n);
  const f = farbe === 'heiss' ? 'bg-heiss' : farbe === 'akzent' ? 'bg-accent' : 'bg-gruen';
  return (
    <span className="block w-full min-w-[120px]">
      {titel && (
        <span className="mb-1 flex justify-between text-[11px] text-muted-foreground">
          <span>{titel}</span><span>{Math.round(a * 100)}%</span>
        </span>
      )}
      <span className="flex h-4 gap-[2px]" role="img" aria-label={`${Math.round(a * 100)} Prozent`}>
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className={`h-full flex-1 rounded-[1px] ${i < voll ? f : 'bg-foreground/10'}`} />
        ))}
      </span>
    </span>
  );
}

/**
 * Die Kennzahlenleiste der Vorlage: eine weisse Tafel, Spalten durch
 * feine Linien getrennt, je Titel, grosse Zahl und eine Marke. Ein Tipp
 * führt dorthin, wo man die Zahl abarbeitet.
 */
export function Kennzahlen({ werte }: { werte: { titel: string; wert: string; marke?: ReactNode; onClick?: () => void }[] }) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded border bg-card lg:grid-cols-4">
      {werte.map((w, i) => {
        // Trennlinien wie in der Vorlage: senkrecht zwischen Spalten,
        // auf dem Handy (2 Spalten) auch waagrecht zwischen den Reihen.
        const linie = `${i % 2 === 1 ? 'border-l' : ''} ${i >= 2 ? 'border-t lg:border-t-0' : ''} ${i % 4 !== 0 ? 'lg:border-l' : ''}`;
        const inhalt = (
          <>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {w.titel}
              {w.onClick && <span aria-hidden className="text-xs">↗</span>}
            </span>
            <span className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[34px] font-normal leading-none tracking-tight">{w.wert}</span>
              {w.marke}
            </span>
          </>
        );
        return w.onClick
          ? <button key={w.titel} type="button" onClick={w.onClick} className={`block p-5 text-left transition-colors hover:bg-secondary/60 ${linie}`}>{inhalt}</button>
          : <div key={w.titel} className={`p-5 ${linie}`}>{inhalt}</div>;
      })}
    </div>
  );
}
