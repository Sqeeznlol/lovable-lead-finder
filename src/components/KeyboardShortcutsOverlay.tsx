import { useEffect, useState } from 'react';
import { Keyboard, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: 'Space', label: 'Nächste Liegenschaft' },
  { keys: 'E', label: 'Export → Pipedrive' },
  { keys: 'S', label: 'Skip / Nicht interessant' },
  { keys: '1 / 2 / 3 / 4', label: 'Workflow-Stufe setzen' },
  { keys: 'J / N / H', label: 'Ja / Nein / Vielleicht (Vorauswahl)' },
  { keys: 'Ctrl + Enter', label: 'Aktion bestätigen' },
  { keys: 'Ctrl + G', label: 'GIS öffnen' },
  { keys: '?', label: 'Diese Hilfe anzeigen' },
];

export function KeyboardShortcutsOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setOpen(o => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-foreground/40 backdrop-blur-sm grid place-items-center p-4 animate-fade-in" onClick={() => setOpen(false)}>
      <Card className="max-w-md w-full" onClick={e => e.stopPropagation()}>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2"><Keyboard className="h-4 w-4" /> Tastatur-Shortcuts</h3>
            <Button size="icon" variant="ghost" onClick={() => setOpen(false)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="space-y-2">
            {SHORTCUTS.map(s => (
              <div key={s.keys} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{s.label}</span>
                <kbd className="px-2 py-1 rounded-md bg-muted text-xs font-mono">{s.keys}</kbd>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Drücke <kbd className="font-mono">?</kbd> jederzeit, um diese Übersicht zu öffnen.</p>
        </CardContent>
      </Card>
    </div>
  );
}