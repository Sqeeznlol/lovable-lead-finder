import { useCanton } from '@/hooks/use-canton';
import { cn } from '@/lib/utils';
import { Lock } from 'lucide-react';

export function CantonTabs() {
  const { current, setCurrent, cantons } = useCanton();
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
      {cantons.map(c => {
        const active = c.id === current;
        return (
          <button
            key={c.id}
            onClick={() => c.active && setCurrent(c.id)}
            disabled={!c.active}
            title={c.active ? c.name : `${c.name} · in Vorbereitung`}
            className={cn(
              'group relative flex items-center gap-2 px-4 h-9 rounded-full text-sm font-medium tracking-tight transition-all whitespace-nowrap',
              active && 'bg-foreground text-background shadow-ceramic',
              !active && c.active && 'text-muted-foreground hover:text-foreground hover:bg-card',
              !c.active && 'text-muted-foreground/50 cursor-not-allowed'
            )}
          >
            <span className="font-mono text-[11px] opacity-70">{c.id}</span>
            <span className="hidden sm:inline">{c.name}</span>
            {!c.active && <Lock className="h-3 w-3" />}
          </button>
        );
      })}
    </div>
  );
}
