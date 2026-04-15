import { List, ChevronDown, Search, Star } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { useLists, useListFilter, useListCounts } from '@/hooks/use-lists';

export function ListSelector() {
  const { data: lists } = useLists();
  const { data: countData } = useListCounts();
  const { selectedListId, setSelectedListId } = useListFilter();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const selectedList = lists?.find(l => l.id === selectedListId);
  const label = selectedList ? selectedList.name : 'Alle Listen';
  const isPrio = (list: { priority: number }) => list.priority < 0;

  const filtered = (lists || []).filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  const prioLists = filtered.filter(isPrio);
  const otherLists = filtered.filter(l => !isPrio(l));

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8 w-full justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <List className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs font-medium truncate">{label}</span>
          </div>
          {selectedList && isPrio(selectedList) && (
            <Badge className="text-[10px] px-1.5 py-0 shrink-0 bg-amber-500/20 text-amber-700 border-amber-300">
              PRIO
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-0" style={{ maxHeight: '400px' }}>
        <div className="p-2 border-b sticky top-0 bg-popover z-10">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Liste suchen..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-7 pl-7 text-xs"
              autoFocus
            />
          </div>
        </div>
        <div className="overflow-y-auto p-1" style={{ maxHeight: '340px' }}>
          <DropdownMenuItem
            onClick={() => { setSelectedListId(null); setSearch(''); setOpen(false); }}
            className={!selectedListId ? 'bg-accent' : ''}
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-medium text-sm">Alle Listen</span>
              {countData && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {countData.total}
                </Badge>
              )}
            </div>
          </DropdownMenuItem>

          {prioLists.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1">
                <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Prio-Listen</span>
              </div>
              {prioLists.map(list => (
                <DropdownMenuItem
                  key={list.id}
                  onClick={() => { setSelectedListId(list.id); setSearch(''); setOpen(false); }}
                  className={selectedListId === list.id ? 'bg-accent' : ''}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 min-w-0">
                      <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />
                      <span className="text-sm truncate">{list.name}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 ml-2 bg-amber-500/10 text-amber-700 border-amber-200">
                      {countData?.counts[list.id] || list.property_count}
                    </Badge>
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}

          {otherLists.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Bezirke</span>
              </div>
              {otherLists.map(list => (
                <DropdownMenuItem
                  key={list.id}
                  onClick={() => { setSelectedListId(list.id); setSearch(''); setOpen(false); }}
                  className={selectedListId === list.id ? 'bg-accent' : ''}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm truncate">{list.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 ml-2">
                      {countData?.counts[list.id] || list.property_count}
                    </Badge>
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}

          {countData && countData.noList > 0 && !search && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled className="opacity-50">
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs">Ohne Liste</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {countData.noList}
                  </Badge>
                </div>
              </DropdownMenuItem>
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
