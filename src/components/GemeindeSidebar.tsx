import { useMemo, useState } from 'react';
import { Building2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useGemeindeStats } from '@/hooks/use-master';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Props {
  selected: string | null;
  onSelect: (gemeinde: string | null) => void;
}

export function GemeindeSidebar({ selected, onSelect }: Props) {
  const { data, isLoading } = useGemeindeStats();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const list = data?.gemeinden || [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(g => g.gemeinde.toLowerCase().includes(q));
  }, [data, search]);

  return (
    <aside className="rounded-2xl border bg-card overflow-hidden h-fit lg:sticky lg:top-20">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Gemeinden</h3>
          {data && (
            <span className="text-[10px] text-muted-foreground ml-auto">
              {data.gemeinden.length}
            </span>
          )}
        </div>
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Suchen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="h-[60vh] lg:h-[calc(100vh-260px)]">
        <div className="p-2 space-y-0.5">
          <button
            onClick={() => onSelect(null)}
            className={cn(
              'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
              selected === null ? 'bg-foreground text-background' : 'hover:bg-muted',
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">Alle Gemeinden</span>
              <span className="text-xs opacity-80">{data?.all.total.toLocaleString('de-CH') || 0}</span>
            </div>
            {data && (
              <div className={cn(
                'text-[10px] mt-0.5 flex gap-2',
                selected === null ? 'opacity-80' : 'text-muted-foreground',
              )}>
                <span>{data.all.offen.toLocaleString('de-CH')} offen</span>
                <span>•</span>
                <span>{data.all.interessant.toLocaleString('de-CH')} interessant</span>
              </div>
            )}
          </button>

          {isLoading && (
            <div className="text-xs text-muted-foreground p-3">Lade…</div>
          )}

          {filtered.map(g => {
            const isActive = selected === g.gemeinde;
            return (
              <button
                key={g.gemeinde}
                onClick={() => onSelect(g.gemeinde)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive ? 'bg-foreground text-background' : 'hover:bg-muted',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{g.gemeinde}</span>
                  <span className="text-xs opacity-80 shrink-0">{g.total.toLocaleString('de-CH')}</span>
                </div>
                <div className={cn(
                  'text-[10px] mt-0.5 flex gap-2',
                  isActive ? 'opacity-80' : 'text-muted-foreground',
                )}>
                  <span>{g.offen.toLocaleString('de-CH')} offen</span>
                  {g.interessant > 0 && <><span>•</span><span>{g.interessant} int.</span></>}
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}