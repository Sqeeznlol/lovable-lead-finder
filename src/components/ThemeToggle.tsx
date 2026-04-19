import { Sun, Moon, Eye, Monitor } from 'lucide-react';
import { useTheme, type ThemeMode } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

const options: { id: ThemeMode; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { id: 'light', icon: Sun, label: 'Tag' },
  { id: 'dark', icon: Moon, label: 'Nacht' },
  { id: 'bluelight', icon: Eye, label: 'Bluelight' },
  { id: 'system', icon: Monitor, label: 'System' },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { mode, setMode } = useTheme();
  return (
    <div className={cn(
      'inline-flex items-center gap-1 rounded-full bg-muted/60 p-1 ring-1 ring-foreground/5 backdrop-blur',
      compact && 'scale-90'
    )}>
      {options.map(o => {
        const Icon = o.icon;
        const active = mode === o.id;
        return (
          <button
            key={o.id}
            onClick={() => setMode(o.id)}
            title={o.label}
            aria-label={o.label}
            className={cn(
              'h-8 w-8 grid place-items-center rounded-full transition-all',
              active
                ? 'bg-card text-foreground shadow-ceramic ring-1 ring-foreground/5'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
