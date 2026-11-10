import { useState } from 'react';

/**
 * Beide Parzellen zusammen (Julian, 10. November: "beide parzellen
 * zusammen sieht und die daten zusammenfügen kann also bsp hnf 1 und
 * hnf 2 zusammen rechnen mit potenzial").
 *
 * Heute: Grundstück, Gebäude und Geschossfläche aus dem GWR (Grundfläche
 * mal Geschosse), je Seite und zusammen. Möglich: Grundstück zusammen mal
 * Ausnützung. Die Ausnützung der Zone steht beim Bund nicht (die
 * harmonisierten Bauzonen kennen nur die Art); darum ist sie hier eine
 * Annahme je Zonenart, die man nach der BZO der Gemeinde einträgt.
 */
import { AREAL_AB, HNF_ANTEIL, azAnnahme, zusammenRechnen, type Ring, type ZusammenDaten } from '@/lib/arrondierung-zusammen';

export type { ZusammenDaten };

const zahl = (v: number | null | undefined, einheit = '') => v == null ? '–' : `${Math.round(v).toLocaleString('de-CH')}${einheit}`;

/** Beide Umrisse in LV95, Norden oben; die eigene Liegenschaft grau, der Nachbar in der Akzentfarbe. */
function Zeichnung({ haupt, nachbar }: { haupt: Ring[] | null; nachbar: Ring[] | null }) {
  const alle = [...(haupt ?? []), ...(nachbar ?? [])].flat();
  if (!alle.length) return null;
  const xs = alle.map(p => p[0]), ys = alle.map(p => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const rand = Math.max(x1 - x0, y1 - y0) * 0.06;
  const pfad = (rr: Ring[] | null) => (rr ?? []).map(r => 'M' + r.map(p => `${(p[0] - x0).toFixed(1)},${(y1 - p[1]).toFixed(1)}`).join('L') + 'Z').join('');
  return (
    <svg viewBox={`${-rand} ${-rand} ${x1 - x0 + 2 * rand} ${y1 - y0 + 2 * rand}`} className="h-56 w-full" role="img"
         aria-label="Umriss der eigenen Liegenschaft und der Nachbarparzelle">
      <path d={pfad(haupt)} className="fill-foreground/15 stroke-foreground" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <path d={pfad(nachbar)} className="fill-accent/30 stroke-accent" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function ArrondierungZusammen({ d, nummer }: { d: ZusammenDaten; nummer: string | null }) {
  const [az, setAz] = useState(() => azAnnahme(d.haupt_zone ?? d.zone, d.haupt_flaeche ? (d.haupt_gf_heute ?? 0) / d.haupt_flaeche : 0));
  const [bonus, setBonus] = useState(10);
  const r = zusammenRechnen(d, az, bonus);
  const zeilen: [string, string, string, string][] = [
    ['Grundstück', zahl(d.haupt_flaeche, ' m²'), zahl(d.flaeche, ' m²'), zahl(r.fl, ' m²')],
    ['Gebäude', zahl(d.haupt_gebaeude), zahl(d.gebaeude), zahl((d.haupt_gebaeude ?? 0) + (d.gebaeude ?? 0))],
    ['Ältestes Baujahr', d.haupt_baujahr ? String(d.haupt_baujahr) : '–', d.baujahr ? String(d.baujahr) : '–', '–'],
    ['Wohnungen', zahl(d.haupt_wohnungen), zahl(d.wohnungen), zahl((d.haupt_wohnungen ?? 0) + (d.wohnungen ?? 0))],
    ['Geschossfläche heute', zahl(d.haupt_gf_heute, ' m²'), zahl(d.gf_heute, ' m²'), zahl(r.gfHeute, ' m²')],
    ['HNF heute', zahl((d.haupt_gf_heute ?? 0) * HNF_ANTEIL, ' m²'), zahl((d.gf_heute ?? 0) * HNF_ANTEIL, ' m²'), zahl(r.hnfHeute, ' m²')],
  ];
  return (
    <div className="grid gap-4 border-t pt-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div>
        <Zeichnung haupt={d.haupt_umriss} nachbar={d.umriss} />
        <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-foreground/30 align-middle" />Eigene Liegenschaft</span>
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-accent align-middle" />Parzelle {nummer ?? '?'}</span>
        </div>
      </div>
      <div className="min-w-0 space-y-4">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-xs text-muted-foreground">
            <tr><th className="py-1 text-left font-normal" /><th className="py-1 text-right font-normal">Eigene</th>
              <th className="py-1 text-right font-normal">Nachbar</th><th className="py-1 text-right font-medium text-foreground">Zusammen</th></tr>
          </thead>
          <tbody className="divide-y">
            {zeilen.map(z => (
              <tr key={z[0]}><td className="py-1.5 pr-2">{z[0]}</td><td className="py-1.5 text-right">{z[1]}</td>
                <td className="py-1.5 text-right">{z[2]}</td><td className="py-1.5 text-right font-medium">{z[3]}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-muted-foreground">Ausnützung (Annahme: wie die eigene, nach BZO anpassen)
            <input type="number" inputMode="decimal" step="0.05" min="0.1" max="5" value={az}
                   onChange={e => setAz(Math.max(0, Number(e.target.value) || 0))}
                   className="mt-1 h-11 w-full rounded-[3px] border bg-card px-3 text-base text-foreground" />
          </label>
          <label className="text-xs text-muted-foreground">Bonus Arealüberbauung in %{r.areal ? '' : ` (erst ab ${AREAL_AB.toLocaleString('de-CH')} m²)`}
            <input type="number" inputMode="numeric" step="5" min="0" max="50" value={bonus} disabled={!r.areal}
                   onChange={e => setBonus(Math.max(0, Number(e.target.value) || 0))}
                   className="mt-1 h-11 w-full rounded-[3px] border bg-card px-3 text-base text-foreground disabled:opacity-50" />
          </label>
        </div>
        <dl className="grid grid-cols-3 gap-3">
          <div><dt className="text-xs text-muted-foreground">HNF möglich</dt><dd className="text-xl font-semibold tabular-nums">{zahl(r.hnfMoeglich, ' m²')}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Mehr als heute</dt><dd className="text-xl font-semibold tabular-nums">{zahl(r.mehrHnf, ' m²')}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Ausnützung heute</dt><dd className="text-xl font-semibold tabular-nums">{r.azHeute.toFixed(2)}</dd></div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Geschossfläche aus dem GWR (Grundfläche mal Geschosse), HNF als {Math.round(HNF_ANTEIL * 100)} % davon.
          Möglich = Grundstück zusammen mal Ausnützung{r.areal ? ', mit Bonus für die Arealüberbauung' : ''}.
        </p>
      </div>
    </div>
  );
}
