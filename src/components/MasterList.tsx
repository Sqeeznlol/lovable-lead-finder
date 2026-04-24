import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Loader2, ExternalLink, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ views';
import { Badge } from '@/components/ui/badge';
import { useMasterProperties, useGemeindeStats, type MasterFilters } from '@/hooks/use-master';
import { MasterFiltersBar } from './MasterFilters';
import { GemeindeSidebar } from './GemeindeSidebar';
import { PropertyDetailDialog } from './PropertyDetailDialog';

export function MasterList() {
  const [filters, setFilters] = useState<MasterFilters>({
    pageSize: 50,
    page: 0,
    sortBy: 'gebaeudeflaeche',
    sortDir: 'desc',
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useMasterProperties(filters);
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / (filters.pageSize ?? 50));

  const titleSuffix = useMemo(() => {
    if (filters.gemeinde) return `· ${filters.gemeinde}`;
    return '· Alle Gemeinden';
  }, [filters.gemeinde]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      <GemeindeSidebar
        selected={filters.gemeinde ?? null}
        onSelect={(g) => setFilters(f => ({ ...f, gemeinde: g, page: 0 }))}
      />

      <div className="space-y-4 min-w-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Master-Liste {titleSuffix}</h2>
            <p className="text-sm text-muted-foreground">
              {isLoading ? 'Lade…' : `${total.toLocaleString('de-CH')} Datensätze`}
            </p>
          </div>
        </div>

        <MasterFiltersBar filters={filters} onChange={setFilters} />

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-3 font-medium">Adresse</th>
                    <th className="text-left p-3 font-medium">Gemeinde</th>
                    <th className="text-left p-3 font-medium">EGRID</th>
                    <th className="text-right p-3 font-medium">Fläche</th>
                    <th className="text-right p-3 font-medium">Gebäude</th>
                    <th className="text-right p-3 font-medium">Baujahr</th>
                    <th className="text-left p-3 font-medium">Zone</th>
                    <th className="text-left p-3 font-medium">Vorwahl</th>
                    <th className="text-left p-3 font-medium">Akquise</th>
                    <th className="p-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr><td colSpan={10} className="text-center p-12 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin inline" />
                    </td></tr>
                  )}
                  {!isLoading && data?.rows.length === 0 && (
                    <tr><td colSpan={10} className="text-center p-12 text-muted-foreground">
                      Keine Datensätze gefunden.
                    </td></tr>
                  )}
                  {data?.rows.map(p => (
                    <tr key={p.id} className="border-t hover:bg-muted/30 cursor-pointer"
                        onClick={() => setSelectedId(p.id)}>
                      <td className="p-3">
                        <div className="font-medium">{p.address}</div>
                        {p.owner_name && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Users className="h-3 w-3" /> {p.owner_name}
                          </div>
                        )}
                      </td>
                      <td className="p-3">{p.gemeinde || '—'}</td>
                      <td className="p-3 font-mono text-xs">{p.egrid || '—'}</td>
                      <td className="p-3 text-right">{p.area ? p.area.toLocaleString('de-CH') : '—'}</td>
                      <td className="p-3 text-right">{p.gebaeudeflaeche ? p.gebaeudeflaeche.toLocaleString('de-CH') : '—'}</td>
                      <td className="p-3 text-right">{p.baujahr || '—'}</td>
                      <td className="p-3 text-xs max-w-[140px] truncate">{p.zone || '—'}</td>
                      <td className="p-3"><Badge variant="outline" className="text-[10px]">{p.preselection_status || 'Nicht geprüft'}</Badge></td>
                      <td className="p-3"><Badge variant="secondary" className="text-[10px]">{p.status}</Badge></td>
                      <td className="p-3 text-right">
                        {p.google_maps_url && (
                          <a href={p.google_maps_url} target="_blank" rel="noreferrer"
                             onClick={e => e.stopPropagation()}
                             className="text-muted-foreground hover:text-foreground inline-flex">
                            <MapPin className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t p-3">
                <span className="text-xs text-muted-foreground">
                  Seite {(filters.page ?? 0) + 1} von {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" disabled={(filters.page ?? 0) === 0}
                          onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 0) - 1 }))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" disabled={(filters.page ?? 0) >= totalPages - 1}
                          onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 0) + 1 }))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <PropertyDetailDialog id={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}