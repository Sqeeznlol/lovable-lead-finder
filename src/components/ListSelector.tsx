import { List, ChevronDown, Search } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLists, useListFilter, useListCounts } from '@/hooks/use-lists';

export function ListSelector() {
  const { data: lists } = useLists();
  const { data: countData } = useListCounts();
  const { selectedListId, setSelectedListId } = useListFilter();
  const [search, setSearch] = useState('');

  const selectedList = lists?.find(l => l.id === selectedListId);
  const label = selectedList ? selectedList.name : 'Alle Listen';

  const filtered = (lists || []).filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8 w-full justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <List className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs font-medium truncate">{label}</span>
          </div>
          {selectedList && countData?.counts[selectedList.id] && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
              {countData.counts[selectedList.id]}
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-0">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Liste suchen..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-7 pl-7 text-xs"
            />
          </div>
        </div>
        <ScrollArea className="max-h-[300px]">
          <div className="p-1">
            <DropdownMenuItem
              onClick={() => { setSelectedListId(null); setSearch(''); }}
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
            <DropdownMenuSeparator />
            {filtered.map(list => {
              const count = countData?.counts[list.id] || 0;
              return (
                <DropdownMenuItem
                  key={list.id}
                  onClick={() => { setSelectedListId(list.id); setSearch(''); }}
                  className={selectedListId === list.id ? 'bg-accent' : ''}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-sm truncate">{list.name}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 ml-2">
                      {count}
                    </Badge>
                  </div>
                </DropdownMenuItem>
              );
            })}
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
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
