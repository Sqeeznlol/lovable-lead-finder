import { List, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useLists, useListFilter } from '@/hooks/use-lists';

const LIST_COLORS: Record<string, string> = {
  'Dietlikon': 'bg-blue-500/10 text-blue-700 border-blue-200',
  'Schlieren': 'bg-emerald-500/10 text-emerald-700 border-emerald-200',
  'Wangen-Brüttisellen': 'bg-amber-500/10 text-amber-700 border-amber-200',
};

export function ListSelector() {
  const { data: lists } = useLists();
  const { selectedListId, setSelectedListId } = useListFilter();

  const selectedList = lists?.find(l => l.id === selectedListId);
  const label = selectedList ? selectedList.name : 'Alle Listen';
  const colorClass = selectedList ? (LIST_COLORS[selectedList.name] || 'bg-muted text-foreground') : '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8">
          <List className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">{label}</span>
          {selectedList && (
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${colorClass}`}>
              P{selectedList.priority}
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem
          onClick={() => setSelectedListId(null)}
          className={!selectedListId ? 'bg-accent' : ''}
        >
          <span className="font-medium">Alle Listen</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {(lists || []).map(list => {
          const color = LIST_COLORS[list.name] || '';
          return (
            <DropdownMenuItem
              key={list.id}
              onClick={() => setSelectedListId(list.id)}
              className={selectedListId === list.id ? 'bg-accent' : ''}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${color}`}>
                    P{list.priority}
                  </Badge>
                  <span className="text-sm">{list.name}</span>
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
