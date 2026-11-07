import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';

/**
 * Hell oder dunkel, ein Tipp oben rechts (Julian, 1. November). Ein
 * Knopf statt einer Auswahl aus vier: wer umschaltet, will das andere.
 * Das Zeichen zeigt, wohin es geht -- der Mond im Hellen, die Sonne im
 * Dunkeln --, wie bei macOS und iOS.
 */
export function ThemeToggle() {
  const { resolved, setMode } = useTheme();
  const dunkel = resolved === 'dark';
  const titel = dunkel ? 'Hell darstellen' : 'Dunkel darstellen';
  return (
    <button type="button" onClick={() => setMode(dunkel ? 'light' : 'dark')} title={titel} aria-label={titel}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-[3px] border bg-card text-foreground transition-colors hover:bg-secondary">
      {dunkel ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
