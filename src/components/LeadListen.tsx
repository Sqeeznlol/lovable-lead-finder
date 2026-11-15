import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Auswahl } from '@/components/Auswahl';
import { KNOPF, Leer, LISTE, Seite } from '@/components/rahmen';
import { BILD } from '@/lib/luftbild';
import { FENSTER } from '@/lib/fenster';
import { useUrlWert } from '@/hooks/use-url-wert';
import { baujahrOder, bauzeit, csv, HEIZUNG_TEXT, KLASSE_TEXT, type LeadGebaeude } from '@/lib/lead-listen';

/**
 * Lead-Listen aus dem Gebäuderegister (Julian, 14. November): Wohngebäude
 * mit Öl- oder Gasheizung, bis 1980 gebaut, in der Deutschschweiz. Dort
 * steht der Heizungsersatz an. Ohne Eigentümer -- die stehen nicht im
 * Register; die Adresse genügt für Brief, Besuch oder Abfrage.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const SPALTEN = 'egid, egrid, kanton, bfs, gemeinde, strasse, plz, ort, baujahr, periode, wohnungen, klasse, heizung, e, n';
type GemeindeZeile = { kanton: string; bfs: number; gemeinde: string; gebaeude: number };

export function LeadListen() {
  const [kanton, setKanton] = useUrlWert('kanton', 'ZH');
  const [bfs, setBfs] = useUrlWert('gemeinde', '');
  const [heizung, setHeizung] = useUrlWert('heizung', '');
  const [bisWert, setBisWert] = useUrlWert('bis', '1980');
  const [minWert, setMinWert] = useUrlWert('wohnungen', '1');
  const bis = Number(bisWert) || 1980, minWhg = Number(minWert) || 1;
  const [laedt, setLaedt] = useState(false);

  const gemeinden = useQuery({
    queryKey: ['lead-gemeinden'],
    queryFn: async (): Promise<GemeindeZeile[]> => {
      const { data, error } = await db.from('lead_gebaeude_gemeinden').select('*').order('gemeinde').limit(5000);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60 * 60 * 1000,
  });
  const kantone = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of gemeinden.data ?? []) m.set(g.kanton, (m.get(g.kanton) ?? 0) + g.gebaeude);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [gemeinden.data]);

  const abfrage = (q: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    q = q.eq('kanton', kanton).or(baujahrOder(bis));
    if (bfs) q = q.eq('bfs', Number(bfs));
    if (heizung) q = q.eq('heizung', Number(heizung));
    if (minWhg > 1) q = q.gte('wohnungen', minWhg);
    return q;
  };
  const liste = useQuery({
    queryKey: ['lead-liste', kanton, bfs, heizung, bis, minWhg],
    queryFn: async () => {
      const { data, error, count } = await abfrage(db.from('lead_gebaeude').select(SPALTEN, { count: 'exact' }))
        .order('baujahr', { ascending: true, nullsFirst: true }).limit(200);
      if (error) throw error;
      return { zeilen: (data ?? []) as LeadGebaeude[], anzahl: (count as number | null) ?? 0 };
    },
    placeholderData: prev => prev,
  });

  // Alle Treffer als CSV, seitenweise, höchstens 20'000 Zeilen (eine Gemeinde hat selten mehr).
  const herunterladen = async () => {
    setLaedt(true);
    const alle: LeadGebaeude[] = [];
    for (let von = 0; von < 20000; von += 1000) {
      const { data, error } = await abfrage(db.from('lead_gebaeude').select(SPALTEN)).order('egid').range(von, von + 999);
      if (error || !data?.length) break;
      alle.push(...data);
      if (data.length < 1000) break;
    }
    const name = gemeinden.data?.find(g => String(g.bfs) === bfs)?.gemeinde ?? kanton;
    const url = URL.createObjectURL(new Blob(['﻿' + csv(alle)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `lead-liste-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`; a.click();
    URL.revokeObjectURL(url);
    setLaedt(false);
  };

  const imKanton = (gemeinden.data ?? []).filter(g => g.kanton === kanton);
  const n = liste.data?.anzahl ?? 0;
  return (
    <Seite bild={BILD.gebaeudesuche} ueber="Gebäuderegister · Deutschschweiz"
      titel={liste.data ? `${n.toLocaleString('de-CH')} Wohngebäude mit Öl oder Gas` : ' '}
      unter={<>Bestehende Wohngebäude, gebaut bis {bis}, aus dem Gebäude- und Wohnungsregister des Bundes. Dort steht der Heizungsersatz an. Eigentümer stehen nicht im Register.</>}
      kennzahlen={kantone.length ? [...kantone].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, z]) => ({ titel: `Kanton ${k}`, wert: z.toLocaleString('de-CH'), onClick: () => { setKanton(k); setBfs(''); } })) : undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <Auswahl label="Kanton" wert={kanton} setWert={k => { setKanton(k); setBfs(''); }} className="min-w-[140px]"
                 optionen={kantone.map(([k]) => ({ wert: k, titel: `Kanton ${k}` }))} />
        <Auswahl label="Gemeinde" wert={bfs || 'alle'} setWert={w => setBfs(w === 'alle' ? '' : w)} className="min-w-[200px]"
                 optionen={[{ wert: 'alle', titel: 'Alle Gemeinden' }, ...imKanton.map(g => ({ wert: String(g.bfs), titel: `${g.gemeinde} · ${g.gebaeude.toLocaleString('de-CH')}` }))]} />
        <Auswahl label="Heizung" wert={heizung || 'beide'} setWert={w => setHeizung(w === 'beide' ? '' : w)} className="min-w-[140px]"
                 optionen={[{ wert: 'beide', titel: 'Öl und Gas' }, { wert: '7530', titel: 'Heizöl' }, { wert: '7520', titel: 'Gas' }]} />
        <Auswahl label="Gebaut bis" wert={String(bis)} setWert={setBisWert} className="min-w-[140px]"
                 optionen={[1945, 1960, 1970, 1980].map(j => ({ wert: String(j), titel: `bis ${j}` }))} />
        <Auswahl label="Wohnungen" wert={String(minWhg)} setWert={setMinWert} className="min-w-[160px]"
                 optionen={[{ wert: '1', titel: 'alle Grössen' }, { wert: '2', titel: 'ab 2 Wohnungen' }, { wert: '3', titel: 'ab 3 Wohnungen' }, { wert: '6', titel: 'ab 6 Wohnungen' }]} />
        <button type="button" className={KNOPF} disabled={laedt || !n} onClick={() => void herunterladen()}>
          {laedt ? 'Wird erstellt …' : `Als CSV (${Math.min(n, 20000).toLocaleString('de-CH')})`}
        </button>
      </div>

      {(liste.isLoading || gemeinden.isLoading) && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> wird geladen …</p>}
      {(liste.error || gemeinden.error) && <p className="text-sm text-destructive">Lead-Listen nicht lesbar. Ist der Ablauf «Lead-Listen» gelaufen?</p>}
      {liste.data && !n && <Leer titel="Keine Gebäude in dieser Auswahl.">Filter lockern oder eine andere Gemeinde wählen.</Leer>}
      {liste.data && n > 0 && (
        <>
          <ul className={LISTE}>
            {liste.data.zeilen.map(g => (
              <li key={g.egid} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4">
                <span className="min-w-0">
                  <span className="block font-medium">{g.strasse ?? 'Ohne Adresse'}, {g.plz} {g.ort ?? g.gemeinde}</span>
                  <span className="block text-sm text-muted-foreground">
                    {bauzeit(g)} · {g.klasse ? KLASSE_TEXT[g.klasse] ?? 'Wohngebäude' : 'Wohngebäude'}{g.wohnungen ? ` · ${g.wohnungen} ${g.wohnungen === 1 ? 'Wohnung' : 'Wohnungen'}` : ''} · {g.heizung ? HEIZUNG_TEXT[g.heizung] : ''}
                  </span>
                </span>
                {g.e && g.n && (
                  <a className="text-sm underline underline-offset-2" target={FENSTER.karte}
                     href={`https://map.geo.admin.ch/?lang=de&E=${g.e}&N=${g.n}&zoom=12&bgLayer=ch.swisstopo.swissimage`}>Karte</a>
                )}
              </li>
            ))}
          </ul>
          {n > 200 && <p className="text-sm text-muted-foreground">Gezeigt die ältesten 200 von {n.toLocaleString('de-CH')}; alle stehen in der CSV.</p>}
        </>
      )}
    </Seite>
  );
}
