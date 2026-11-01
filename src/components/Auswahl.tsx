import * as S from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';

/**
 * Die Auswahl der Seite -- statt des Auswahlfelds des Browsers.
 *
 * Julian (1. November): das "Dächlein" des Browsers sah bei jeder
 * Auswahl nicht gut aus, und aufgeklappt kam die Liste des Systems.
 * Hier: dieselbe Form wie jedes Feld (Linie, 3 px, 44 px hoch), ein
 * schlankes Zeichen, aufgeklappt eine Liste mit Häkchen bei der Wahl.
 *
 * Radix erlaubt keinen leeren Wert für einen Eintrag; "" (z.B. "Alle
 * Kunden") wird darum intern als LEER geführt und nach aussen wieder "".
 */
const LEER = '__leer__';

export interface AuswahlOption { wert: string; titel: string }

export function Auswahl({ wert, setWert, optionen, label, className = '', klein = false, chip }: {
  wert: string; setWert: (w: string) => void; optionen: AuswahlOption[]; label: string; className?: string; klein?: boolean;
  /** Als Chip über der Karte (weiss mit Schatten, gesetzt schwarz) statt als Feld. */
  chip?: { an: boolean };
}) {
  const aussen = (w: string) => (w === LEER ? '' : w);
  const innen = (w: string) => (w === '' ? LEER : w);
  return (
    <S.Root value={innen(wert)} onValueChange={w => setWert(aussen(w))}>
      <S.Trigger aria-label={label}
        className={chip
          ? `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[3px] px-3 text-[13px] font-medium shadow-[0_1px_4px_rgba(0,0,0,0.16)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${chip.an ? 'bg-[#111] text-white' : 'bg-white text-[#111]'} ${className}`
          : `inline-flex ${klein ? 'h-10' : 'h-11'} min-w-0 items-center justify-between gap-2 rounded-[3px] border border-input bg-card px-3.5 text-left text-[15px] transition-colors hover:border-foreground/40 focus:border-foreground focus:outline-none data-[state=open]:border-foreground ${className}`}>
        <span className="min-w-0 truncate"><S.Value /></span>
        <S.Icon><ChevronDown className={`h-4 w-4 shrink-0 ${chip?.an ? 'text-white/70' : 'text-muted-foreground'} transition-transform duration-150 [[data-state=open]_&]:rotate-180`} /></S.Icon>
      </S.Trigger>
      <S.Portal>
        {/* Über der Karte (Leaflet bis z 1000) und über Dialogen. */}
        <S.Content position="popper" sideOffset={6}
          className="z-[1200] max-h-[min(60vh,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[3px] border bg-card text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.12)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95">
          <S.Viewport className="p-1">
            {optionen.map(o => (
              <S.Item key={o.wert} value={innen(o.wert)}
                className="relative flex min-h-10 cursor-pointer select-none items-center rounded-[2px] py-2 pl-3 pr-9 text-[15px] outline-none data-[highlighted]:bg-secondary data-[state=checked]:font-medium">
                <S.ItemText>{o.titel}</S.ItemText>
                <S.ItemIndicator className="absolute right-3 inline-flex"><Check className="h-4 w-4 text-accent" /></S.ItemIndicator>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
