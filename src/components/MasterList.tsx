import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Loader2, MapPin, Users, SlidersHorizontal, Phone, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMasterProperties, useGemeindeStats, type MasterFilters } from '@/hooks/use-master';
import { MasterFiltersBar } from './MasterFilters';
import { GemeindeSidebar } from './GemeindeSidebar';
import { PropertyDetailDialog } from './PropertyDetailDialog';
import { beurteile, EMPFEHLUNG_LABEL, type Empfehlung } from '@/lib/akquise';
import { LAGE_LABEL } from '@/lib/gemeinden-zh';

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

/**
 * Die Empfehlung ist die eine Angabe, nach der die Liste gelesen wird:
 * grün heisst anrufen, grau heisst Finger weg.
 */
const empfehlungStil: Record<Empfehlung, string> = {
  anrufen:       'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  pruefen:       'bg-primary/12 text-primary border-primary/25',
  zurueckstellen:'bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/25',
  nein:          'bg-muted text-muted-foreground border-border',
};

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
  // Die Gemeindeliste kostet ein Fünftel der Bildbreite. Wer die ganze
  // Liste nach Potenzial durchgeht, braucht sie nicht -- wer eine Gemeinde
  // abarbeitet, schaltet sie dazu.
  const [gemeindenOffen, setGemeindenOffen] = useState(false);

  const { data, isLoading } = useMasterProperties(filters);
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / (filters.pageSize ?? 50));

  const titleSuffix = useMemo(() => {
    if (filters.gemeinde) return `· ${filters.gemeinde}`;
    return '· Alle Gemeinden';
  }, [filters.gemeinde]);

  return (
    <div className={`grid grid-cols-1 gap-6 ${gemeindenOffen ? 'lg:grid-cols-[260px_1fr]' : ''}`}>
      {gemeindenOffen && (
        <GemeindeSidebar
          selected={filters.gemeinde ?? null}
          onSelect={(g) => setFilters(f => ({ ...f, gemeinde: g, page: 0 }))}
        />
      )}

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
            onClick={() => setGemeindenOffen(o => !o)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors ${
              gemeindenOffen ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <MapPin className="h-3 w-3" /> Gemeinden
          </button>
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
                    <th className="whitespace-nowrap p-3 text-left font-medium">Empfehlung</th>
                    <th className="text-left p-3 font-medium">Objekt</th>
                    <th className="whitespace-nowrap p-3 text-left font-medium">Parzelle</th>
                    <th className="text-left p-3 font-medium">Eigentümer</th>
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
                    <tr><td colSpan={10} className="text-center p-12 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin inline" />
                    </td></tr>
                  )}
                  {!isLoading && data?.rows.length === 0 && (
                    <tr><td colSpan={10} className="text-center p-12 text-muted-foreground">
                      Keine Datensätze gefunden.
                    </td></tr>
                  )}
                  {data?.rows.map(p => {
                    const urteil = beurteile(p);
                    return (
                    <tr key={p.id} className="cursor-pointer border-t transition-colors hover:bg-muted/40"
                        onClick={() => setSelectedId(p.id)}>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${empfehlungStil[urteil.empfehlung]}`}
                          title={[...urteil.dafuer, ...urteil.dagegen.map(d => '– ' + d)].join('\n')}
                        >
                          {EMPFEHLUNG_LABEL[urteil.empfehlung]}
                        </span>
                      </td>
                      {/* Alles, was nötig ist, um das Objekt zu finden:
                          Strasse, Ort und darunter die Gemeinde. Ohne den
                          Ort lässt sich eine Adresse im Kanton nicht
                          eindeutig zuordnen -- Bahnhofstrassen gibt es
                          Dutzende. */}
                      <td className="min-w-[210px] p-3">
                        <div className="font-medium leading-tight">{p.address || '—'}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {[p.plz, p.gemeinde || p.ortschaftsname].filter(Boolean).join(' ') || '—'}
                        </div>
                      </td>

                      {/* Die Parzellennummer ist die Nummer, unter der das
                          Grundstück beim Grundbuchamt und im GIS geführt
                          wird -- ohne sie lässt sich weder nachschlagen noch
                          nachfragen. Die EGRID darunter ist die
                          schweizweit eindeutige Kennung. */}
                      <td className="whitespace-nowrap p-3">
                        <div className="font-medium tabular-nums">
                          {p.parzelle || p.plot_number || '—'}
                        </div>
                        {p.egrid && (
                          <div className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                            {p.egrid}
                          </div>
                        )}
                      </td>

                      {/* Wen man anruft und unter welcher Nummer. Fehlt die
                          Nummer, ist das die nächste Arbeit -- deshalb steht
                          es hier und nicht versteckt im Detail. */}
                      <td className="min-w-[170px] p-3">
                        {p.owner_name ? (
                          <div className="flex items-start gap-1.5 leading-tight">
                            <Users className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                            <span>{p.owner_name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Eigentümer fehlt</span>
                        )}
                        {p.owner_phone ? (
                          <a
                            href={`tel:${p.owner_phone.replace(/\s/g, '')}`}
                            onClick={e => e.stopPropagation()}
                            className="mt-0.5 inline-flex items-center gap-1.5 text-xs tabular-nums text-primary hover:underline"
                          >
                            <Phone className="h-3 w-3" /> {p.owner_phone}
                          </a>
                        ) : p.owner_name ? (
                          <div className="mt-0.5 text-xs text-muted-foreground">keine Nummer</div>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap p-3 text-right font-medium tabular-nums text-primary">{m2(p.hnf_delta)}</td>
                      <td className="whitespace-nowrap p-3 text-right tabular-nums" title={`Erlös in ${p.gemeinde || 'dieser Gemeinde'}: ${urteil.erloesProM2.toLocaleString('de-CH')} CHF/m² · ${LAGE_LABEL[urteil.lage]}`}>
                        {urteil.margeLagegerecht != null
                          ? (urteil.margeLagegerecht / 1e6).toFixed(1)
                          : mio(p.marge_chf)}
                      </td>
                      <td className="whitespace-nowrap p-3 text-right tabular-nums text-muted-foreground">{m2(p.bebaubar_m2 ?? p.area)}</td>
                      <td className="whitespace-nowrap p-3 text-right tabular-nums">{p.baujahr || '—'}</td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className="whitespace-nowrap text-xs"
                          title={p.preselection_status || 'Nicht geprüft'}
                        >
                          {vorwahlKurz(p.preselection_status)}
                        </Badge>
                      </td>
                      {/* Zwei Karten, weil sie Verschiedenes zeigen: Google
                          zeigt das Haus von der Strasse, das GIS des Kantons
                          zeigt den Parzellenzuschnitt und die Zone. */}
                      <td className="whitespace-nowrap p-3 text-right">
                        <div className="inline-flex gap-2">
                          {p.google_maps_url && (
                            <a href={p.google_maps_url} target="_blank" rel="noreferrer"
                               onClick={e => e.stopPropagation()}
                               title="Bei Google Maps ansehen"
                               className="inline-flex text-muted-foreground hover:text-foreground">
                              <MapPin className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {p.gis_url && (
                            <a href={p.gis_url} target="_blank" rel="noreferrer"
                               onClick={e => e.stopPropagation()}
                               title="Parzelle im GIS des Kantons Zürich"
                               className="inline-flex text-muted-foreground hover:text-foreground">
                              <Map className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
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