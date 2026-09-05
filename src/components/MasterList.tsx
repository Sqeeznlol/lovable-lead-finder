import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Loader2, MapPin, Users, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMasterProperties, useGemeindeStats, type MasterFilters } from '@/hooks/use-master';
import { MasterFiltersBar } from './MasterFilters';
import { GemeindeSidebar } from './GemeindeSidebar';
import { PropertyDetailDialog } from './PropertyDetailDialog';

const m2 = (v: number | null | undefined) =>
  v == null ? '—' : `${Math.round(Number(v)).toLocaleString('de-CH')} m²`;

const mio = (v: number | null | undefined) =>
  v == null ? '—' : (Number(v) / 1e6).toFixed(1);

/** Kurzform des Vorwahl-Status; die Langform steht im Detail. */
const vorwahlKurz = (v: string | null | undefined) => {
  switch (v) {
    case 'Sehr interessant':   return 'sehr int.';
    case 'Potenzial vorhanden': return 'Potenzial';
    case 'Später prüfen':      return 'später';
    case 'Kein Potenzial':     return 'kein Pot.';
    case 'Ausschliessen':      return 'raus';
    default:                   return 'offen';
  }
};

const tierStil = (t: string | null | undefined) =>
  t === 'A' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
  : t === 'B' ? 'bg-primary/15 text-primary border-primary/30'
  : t === 'C' ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
  : 'bg-muted text-muted-foreground border-border';

const SORTIERUNG: { wert: MasterFilters['sortBy']; label: string }[] = [
  { wert: 'hnf_delta', label: 'HNF-Zuwachs' },
  { wert: 'potenzial_score', label: 'Potenzial-Score' },
  { wert: 'marge_chf', label: 'Marge' },
  { wert: 'reserve_gf', label: 'Reserve' },
  { wert: 'baujahr', label: 'Baujahr' },
  { wert: 'gemeinde', label: 'Gemeinde' },
];

export function MasterList() {
  const [filters, setFilters] = useState<MasterFilters>({
    pageSize: 50,
    page: 0,
    sortBy: 'hnf_delta',
    sortDir: 'desc',
    ausgeschlossen: 'ausblenden',
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Der Filterblock ist gross und wird selten gebraucht -- die beiden Regler
  // darunter decken den Alltag ab.
  const [filterOffen, setFilterOffen] = useState(false);

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
              {isLoading
                ? 'Lade…'
                : `${total.toLocaleString('de-CH')} Objekte` +
                  (filters.tier ? ` in Tier ${filters.tier}` : '') +
                  (filters.ausgeschlossen === 'alle' ? ' · inklusive ausgeschlossener' : '')}
            </p>
          </div>
        </div>

        {filterOffen && <MasterFiltersBar filters={filters} onChange={setFilters} />}

        {/* Sortierung und Tier -- die beiden Regler, die im Alltag zählen */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            onClick={() => setFilterOffen(o => !o)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors ${
              filterOffen ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <SlidersHorizontal className="h-3 w-3" /> Filter
          </button>
          <span className="ml-2 text-muted-foreground">Sortieren:</span>
          {SORTIERUNG.map(o => (
            <button
              key={o.wert}
              onClick={() => setFilters(f => ({ ...f, sortBy: o.wert, page: 0 }))}
              className={`rounded-full px-3 py-1 transition-colors ${
                filters.sortBy === o.wert
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {o.label}
            </button>
          ))}

          <span className="ml-3 text-muted-foreground">Tier:</span>
          {[null, 'A', 'B', 'C', 'D'].map(t => (
            <button
              key={t ?? 'alle'}
              onClick={() => setFilters(f => ({ ...f, tier: t, page: 0 }))}
              className={`rounded-full px-3 py-1 transition-colors ${
                (filters.tier ?? null) === t
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {t ?? 'Alle'}
            </button>
          ))}

          <label className="ml-3 flex items-center gap-1.5 text-muted-foreground">
            <input
              type="checkbox"
              checked={filters.ausgeschlossen === 'alle'}
              onChange={e => setFilters(f => ({
                ...f, ausgeschlossen: e.target.checked ? 'alle' : 'ausblenden', page: 0,
              }))}
            />
            Ausgeschlossene mitzeigen
          </label>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-center p-3 font-medium">Tier</th>
                    <th className="text-left p-3 font-medium">Adresse</th>
                    <th className="text-left p-3 font-medium">Gemeinde</th>
                    <th className="whitespace-nowrap p-3 text-right font-medium">HNF&nbsp;+</th>
                    <th className="whitespace-nowrap p-3 text-right font-medium">Marge&nbsp;Mio</th>
                    <th className="whitespace-nowrap p-3 text-right font-medium">Bebaubar</th>
                    <th className="whitespace-nowrap p-3 text-right font-medium">Bj.</th>
                    <th className="p-3 text-left font-medium">Vorwahl</th>
                    <th className="p-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr><td colSpan={8} className="text-center p-12 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin inline" />
                    </td></tr>
                  )}
                  {!isLoading && data?.rows.length === 0 && (
                    <tr><td colSpan={8} className="text-center p-12 text-muted-foreground">
                      Keine Datensätze gefunden.
                    </td></tr>
                  )}
                  {data?.rows.map(p => (
                    <tr key={p.id} className="border-t hover:bg-muted/30 cursor-pointer"
                        onClick={() => setSelectedId(p.id)}>
                      <td className="p-3 text-center">
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-bold ${tierStil(p.score_tier)}`}>
                          {p.score_tier || '–'}
                        </span>
                      </td>
                      <td className="min-w-[200px] p-3">
                        <div className="font-medium leading-tight">{p.address}</div>
                        {p.owner_name && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Users className="h-3 w-3" /> {p.owner_name}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap p-3 text-muted-foreground">{p.gemeinde || '—'}</td>
                      <td className="whitespace-nowrap p-3 text-right font-medium tabular-nums text-primary">{m2(p.hnf_delta)}</td>
                      <td className="whitespace-nowrap p-3 text-right tabular-nums">{mio(p.marge_chf)}</td>
                      <td className="whitespace-nowrap p-3 text-right tabular-nums text-muted-foreground">{m2(p.bebaubar_m2 ?? p.area)}</td>
                      <td className="whitespace-nowrap p-3 text-right tabular-nums">{p.baujahr || '—'}</td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className="whitespace-nowrap text-[10px]"
                          title={p.preselection_status || 'Nicht geprüft'}
                        >
                          {vorwahlKurz(p.preselection_status)}
                        </Badge>
                      </td>
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