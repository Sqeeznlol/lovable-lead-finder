import { useMemo, useState } from 'react';
import { ArrondierungKarte } from '@/components/ArrondierungKarte';
import { GEB_STATUS, moeglich, summieren, type Parzelle, type Summe } from '@/lib/arrondierung-zusammen';

/**
 * Eigene Parzelle und Nachbarn zusammen (Julian, 10. November: "wenn
 * beide Nachbarn anrechenbar sind, dann beide dazuklicken, es muss real
 * aussehen, damit später der Architekt das rechnen kann und die echten
 * Zahlen sieht, nicht irgendeine Schätzung").
 *
 * Alles hier ist gemessen: Fläche und Umriss aus der Amtlichen
 * Vermessung, jedes Gebäude mit seinen Werten aus dem GWR. Was möglich
 * ist, steht erst da, wenn man die Ausnützungsziffer der BZO einträgt.
 */
const zahl = (v: number | null | undefined, einheit = '') => v == null ? '–' : `${Math.round(v).toLocaleString('de-CH')}${einheit}`;
const prozent = (v: number | null) => v == null ? '–' : `${(v * 100).toFixed(1)} %`;

// leer: Zeile ausblenden, wenn das GWR den Wert für keine gewählte Parzelle führt (EBF und Volumen fehlen oft ganz).
type Zeile = { titel: string; wert: (s: Summe, p?: Parzelle) => string; quelle: string; leer?: (s: Summe) => boolean };
const ZEILEN: Zeile[] = [
  { titel: 'Parzellenfläche', wert: s => zahl(s.flaeche, ' m²'), quelle: 'AV' },
  { titel: 'Bauzone', wert: (_s, p) => p ? p.zone || '–' : '', quelle: 'ARE' },
  { titel: 'Gebäude', wert: s => String(s.gebaeude), quelle: 'GWR' },
  { titel: 'Ältestes Baujahr', wert: s => s.baujahr ? String(s.baujahr) : '–', quelle: 'GWR' },
  { titel: 'Geschosse (höchstes)', wert: s => s.geschosse ? String(s.geschosse) : '–', quelle: 'GWR' },
  { titel: 'Grundfläche Gebäude', wert: s => zahl(s.grundflaeche, ' m²'), quelle: 'GWR' },
  // Nicht «Überbauungsziffer»: das GWR zählt auch Tiefgaragen mit (Menziken, Hauptstrasse 83.1: 2'167 m² ohne Geschosse).
  { titel: 'Grundfläche / Parzelle', wert: s => prozent(s.ueberbauung), quelle: 'GWR / AV' },
  { titel: 'Energiebezugsfläche', wert: s => zahl(s.ebf, ' m²') + (s.ohneEbf ? ` (${s.ohneEbf} ohne Angabe)` : ''), quelle: 'GWR', leer: s => s.ebf == null },
  { titel: 'Gebäudevolumen', wert: s => zahl(s.volumen, ' m³'), quelle: 'GWR', leer: s => s.volumen == null },
  { titel: 'Wohnungen', wert: s => zahl(s.wohnungen), quelle: 'GWR' },
  { titel: 'Wohnfläche', wert: s => zahl(s.wohnflaeche, ' m²') + (s.ohneWohnflaeche ? ` (${s.ohneWohnflaeche} ohne Angabe)` : ''), quelle: 'GWR' },
];

function csv(teile: Parzelle[], spalten: string[], summen: Summe[]): string {
  const z = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const kopf = ['Wert', ...spalten, 'Quelle'];
  const zeilen = ZEILEN.map(r => [r.titel, ...summen.map((s, i) => r.wert(s, teile[i])), r.quelle]);
  const geb = teile.flatMap(p => p.gebaeude.map(g => [p.nummer ?? '', p.egrid, g.egid ?? '', g.adresse ?? '', g.baujahr ?? '', g.status ? GEB_STATUS[g.status] ?? g.status : '',
    g.geschosse ?? '', g.grundflaeche ?? '', g.ebf ?? '', g.volumen ?? '', g.wohnungen ?? '', g.wohnflaeche ?? ''].map(String)));
  return [kopf, ...zeilen, [], ['Parzelle', 'EGRID', 'EGID', 'Adresse', 'Baujahr', 'Status', 'Geschosse', 'Grundfläche m²', 'EBF m²', 'Volumen m³', 'Wohnungen', 'Wohnfläche m²'], ...geb]
    .map(r => r.map(x => z(String(x))).join(';')).join('\n');
}

export function ArrondierungZusammen({ haupt, adresse, nachbarn, start, stand }: {
  haupt: Parzelle; adresse: string; nachbarn: Parzelle[]; start: string; stand: string | null;
}) {
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(() => new Set([start]));
  const [az, setAz] = useState('');
  const [bonus, setBonus] = useState('');
  const umschalten = (egrid: string) => setGewaehlt(alt => {
    const neu = new Set(alt);
    if (neu.has(egrid)) neu.delete(egrid); else neu.add(egrid);
    return neu;
  });
  const dazu = nachbarn.filter(p => gewaehlt.has(p.egrid));
  const teile = [haupt, ...dazu];
  const summen = teile.map(p => summieren([p]));
  const gesamt = summieren(teile);
  const azZahl = Number(az.replace(',', '.')) || null;
  const agf = moeglich(gesamt.flaeche, azZahl, Number(bonus.replace(',', '.')) || 0);
  const spalten = [`Eigene (${haupt.nummer ?? '?'})`, ...dazu.map(p => `Parzelle ${p.nummer ?? '?'}`)];
  const geb = teile.flatMap(p => p.gebaeude.map(g => ({ p, g })));
  const zeilen = ZEILEN.filter(r => !r.leer?.(gesamt));
  const datei = useMemo(() => `arrondierung-${adresse.replace(/[^\wäöüÄÖÜ]+/g, '-').slice(0, 40)}.csv`, [adresse]);
  const herunterladen = () => {
    const b = new Blob(['﻿' + csv(teile, spalten, summen.concat(teile.length > 1 ? [gesamt] : []))], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = datei; a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-5 border-t pt-4">
      <ArrondierungKarte haupt={haupt} nachbarn={nachbarn} gewaehlt={gewaehlt} umschalten={umschalten} />
      <div>
        <div className="mb-2 text-xs text-muted-foreground">Nachbarn dazunehmen (auch auf der Karte anklicken)</div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Nachbarparzellen">
          {nachbarn.map(p => (
            <button key={p.egrid} type="button" aria-pressed={gewaehlt.has(p.egrid)} onClick={() => umschalten(p.egrid)}
                    className={`h-11 rounded-[3px] border px-3 text-sm transition-colors ${gewaehlt.has(p.egrid) ? 'border-accent bg-accent text-white' : 'bg-card hover:bg-secondary'}`}>
              Parzelle {p.nummer ?? '?'} · {zahl(p.flaeche, ' m²')}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm tabular-nums">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 pr-3 text-left font-normal" />
              {spalten.map(s => <th key={s} className="py-1 pl-3 text-right font-normal">{s}</th>)}
              {teile.length > 1 && <th className="py-1 pl-3 text-right font-medium text-foreground">Zusammen</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {zeilen.map(r => (
              <tr key={r.titel}>
                <td className="py-1.5 pr-3">{r.titel} <span className="text-xs text-muted-foreground">{r.quelle}</span></td>
                {summen.map((s, i) => <td key={i} className="py-1.5 pl-3 text-right">{r.wert(s, teile[i])}</td>)}
                {teile.length > 1 && <td className="py-1.5 pl-3 text-right font-medium">{r.titel === 'Bauzone' ? '' : r.wert(gesamt)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="text-sm">
        <summary className="flex h-11 cursor-pointer items-center font-medium">Alle {geb.length} Gebäude einzeln</summary>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] tabular-nums">
            <thead className="text-xs text-muted-foreground">
              <tr>{['Parzelle', 'Adresse', 'EGID', 'Baujahr', 'Status', 'Geschosse', 'Grundfläche', 'EBF', 'Volumen', 'Wohnungen', 'Wohnfläche'].map((t, i) => (
                <th key={t} className={`py-1 font-normal ${i < 3 ? 'pr-3 text-left' : 'pl-3 text-right'}`}>{t}</th>))}</tr>
            </thead>
            <tbody className="divide-y">
              {geb.map(({ p, g }, i) => (
                <tr key={`${g.egid}-${i}`}>
                  <td className="py-1.5 pr-3">{p.nummer ?? '?'}</td><td className="py-1.5 pr-3">{g.adresse ?? '–'}</td>
                  <td className="py-1.5 pr-3">{g.egid ?? '–'}</td><td className="py-1.5 pl-3 text-right">{g.baujahr ?? '–'}</td>
                  <td className="py-1.5 pl-3 text-right">{g.status ? GEB_STATUS[g.status] ?? g.status : '–'}</td>
                  <td className="py-1.5 pl-3 text-right">{g.geschosse ?? '–'}</td><td className="py-1.5 pl-3 text-right">{zahl(g.grundflaeche, ' m²')}</td>
                  <td className="py-1.5 pl-3 text-right">{zahl(g.ebf, ' m²')}</td><td className="py-1.5 pl-3 text-right">{zahl(g.volumen, ' m³')}</td>
                  <td className="py-1.5 pl-3 text-right">{g.wohnungen ?? '–'}</td><td className="py-1.5 pl-3 text-right">{zahl(g.wohnflaeche, ' m²')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_minmax(0,1.4fr)] sm:items-end">
        <label className="text-xs text-muted-foreground">Ausnützungsziffer laut BZO
          <input type="text" inputMode="decimal" placeholder="z. B. 0,9" value={az} onChange={e => setAz(e.target.value)}
                 className="mt-1 h-11 w-full rounded-[3px] border bg-card px-3 text-base text-foreground" />
        </label>
        <label className="text-xs text-muted-foreground">Bonus Arealüberbauung in % laut BZO
          <input type="text" inputMode="decimal" placeholder="0" value={bonus} onChange={e => setBonus(e.target.value)}
                 className="mt-1 h-11 w-full rounded-[3px] border bg-card px-3 text-base text-foreground" />
        </label>
        <div>
          <div className="text-xs text-muted-foreground">Anrechenbare Geschossfläche möglich</div>
          <div className="text-xl font-semibold tabular-nums">{agf == null ? 'AZ eintragen' : zahl(agf, ' m²')}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <p>Quellen: AV = Amtliche Vermessung (Fläche, Umriss), GWR = Gebäude- und Wohnungsregister des BFS (je Gebäude), ARE = Bauzonen Schweiz
          (harmonisiert, ohne Ziffern).{stand ? ` Abgefragt am ${new Date(stand).toLocaleDateString('de-CH')}.` : ''}</p>
        <button type="button" onClick={herunterladen} className="h-11 rounded-[3px] border bg-card px-4 text-sm font-medium text-foreground hover:bg-secondary">
          Tabelle für den Architekten (CSV)
        </button>
      </div>
    </div>
  );
}
