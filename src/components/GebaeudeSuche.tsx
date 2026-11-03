import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FELD, KNOPF, KNOPF_HAUPT, Leer, LISTE, Seite } from '@/components/rahmen';
import { Auswahl } from '@/components/Auswahl';
import { useUrlSetzen, useUrlWert } from '@/hooks/use-url-wert';
import { BILD } from '@/lib/luftbild';
import { useGwrKodes } from '@/lib/parzelle-gebaeude';
import { heizGruppe } from '@/lib/karte3d';
import { downloadXlsx, exportTimestamp } from '@/lib/export-utils';
import { useGemeindeStats } from '@/hooks/use-master';

/**
 * Suche im eigenen Bestand nach Gebäuden: Gemeinde, Baujahr, Zimmer,
 * Wohnfläche, Gebäudeart (Julian, 3. November). Daten aus dem
 * Gebäuderegister (Tabelle gebaeude, Funktion gebaeude_suchen).
 *
 * Zimmer und Wohnfläche sind die Summe der bestehenden Wohnungen eines
 * Gebäudes -- bei einem Mehrfamilienhaus also aller Wohnungen. Darum
 * steht die Zahl der Wohnungen in jeder Zeile, und die Gebäudeart grenzt
 * auf Einfamilienhäuser ein.
 *
 * Jeder Filter steht in der Adresse: Neu laden und Teilen zeigen dieselbe
 * Suche, "Zurück" führt zur vorigen.
 */
interface Treffer {
  parzelle_id: string; adresse: string | null; gemeinde: string | null; egrid: string; egid: number; klasse: number | null;
  baujahr: number | null; zimmer: number | null; wohnflaeche: number | null; wohnungen: number | null; geschosse: number | null;
  heizung_energie: number | null;
}
const FELDER = ['gemeinde', 'bj_von', 'bj_bis', 'zi_min', 'zi_max', 'wf_min', 'art'] as const;
const GRENZE = 500;
const zahl = (s: string | null) => { const n = Number(s); return s && Number.isFinite(n) ? Math.round(n) : null; };
const n = (x: number | null | undefined, e = '') => (x == null ? '–' : `${x.toLocaleString('de-CH')}${e}`);

export function GebaeudeSuche() {
  const setzen = useUrlSetzen();
  const [gemeinde] = useUrlWert('gemeinde'), [bjVon] = useUrlWert('bj_von'), [bjBis] = useUrlWert('bj_bis');
  const [ziMin] = useUrlWert('zi_min'), [ziMax] = useUrlWert('zi_max'), [wfMin] = useUrlWert('wf_min'), [artW] = useUrlWert('art');
  const werte = useMemo(() => ({ gemeinde, bj_von: bjVon, bj_bis: bjBis, zi_min: ziMin, zi_max: ziMax, wf_min: wfMin, art: artW }),
    [gemeinde, bjVon, bjBis, ziMin, ziMax, wfMin, artW]);
  // Eingaben erst beim Suchen in die Adresse -- sonst sucht jede Taste.
  const [entwurf, setEntwurf] = useState(werte);
  const { data: kodes } = useGwrKodes();
  // Die Suche braucht den genauen Namen (so nutzt sie den Index; mit
  // "ähnlich wie" las sie alle Parzellen und lief in die Zeitgrenze).
  const { data: gemeinden } = useGemeindeStats(null);
  const arten = useMemo(() => [...(kodes?.entries() ?? [])]
    .filter(([k]) => k.startsWith('GKLAS:') && /^GKLAS:11/.test(k)) // Wohngebäude (11xx)
    .map(([k, t]) => ({ wert: k.slice(6), titel: t }))
    .sort((a, b) => a.wert.localeCompare(b.wert)), [kodes]);
  const gesetzt = FELDER.some(f => werte[f]);

  const { data, isFetching, error } = useQuery({
    queryKey: ['gebaeude-suche', werte],
    enabled: gesetzt,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Treffer[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await (supabase as any).rpc('gebaeude_suchen', {
        p_gemeinde: werte.gemeinde?.trim() || null,
        p_baujahr_von: zahl(werte.bj_von), p_baujahr_bis: zahl(werte.bj_bis),
        p_zimmer_min: zahl(werte.zi_min), p_zimmer_max: zahl(werte.zi_max),
        p_wohnflaeche_min: zahl(werte.wf_min), p_klasse: zahl(werte.art), p_grenze: GRENZE,
      });
      if (r.error) throw new Error(r.error.message);
      return r.data as Treffer[];
    },
  });

  // Eigentümer, soweit schon abgefragt (properties.owner_name) -- für die
  // Ansprache (Julian: "diese Eigentümer gehe ich an für Renovation oder
  // Verkauf"). In Paketen, eine Adresse mit 500 Kennungen wäre zu lang.
  const ids = useMemo(() => [...new Set((data ?? []).map(t => t.parzelle_id))], [data]);
  const { data: eigner } = useQuery({
    queryKey: ['gebaeude-suche-eigner', ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const pakete: string[][] = [];
      for (let i = 0; i < ids.length; i += 150) pakete.push(ids.slice(i, i + 150));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await Promise.all(pakete.map(pk => (supabase as any).from('properties').select('id, owner_name').in('id', pk)));
      return new Map(r.flatMap(x => (x.data ?? []) as { id: string; owner_name: string | null }[]).map(z => [z.id, z.owner_name]));
    },
  });
  const heizung = (t: Treffer) => (t.heizung_energie == null ? null : kodes?.get(`GENH:${t.heizung_energie}`) ?? `Code ${t.heizung_energie}`);
  const art = (t: Treffer) => (t.klasse == null ? null : kodes?.get(`GKLAS:${t.klasse}`) ?? null);
  const suchen = () => setzen(Object.fromEntries(FELDER.map(f => [f, entwurf[f]?.trim() || null])));
  const leeren = () => { setEntwurf(Object.fromEntries(FELDER.map(f => [f, null])) as typeof werte); setzen(Object.fromEntries(FELDER.map(f => [f, null]))); };
  const exportieren = () => data && downloadXlsx(`gebaeudesuche-${exportTimestamp()}.xlsx`, 'Gebäude', data.map(t => ({
    Adresse: t.adresse, Gemeinde: t.gemeinde, Eigentümer: eigner?.get(t.parzelle_id) ?? '', EGRID: t.egrid, EGID: t.egid, Gebäudeart: art(t), Baujahr: t.baujahr,
    Zimmer: t.zimmer, 'Wohnfläche m²': t.wohnflaeche, Wohnungen: t.wohnungen, Geschosse: t.geschosse, Heizung: heizung(t),
  })));
  const feld = (f: (typeof FELDER)[number], titel: string, platz: string, zahlfeld = true) => (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs text-muted-foreground">{titel}</span>
      <input className={`${FELD} w-full`} value={entwurf[f] ?? ''} placeholder={platz} inputMode={zahlfeld ? 'numeric' : undefined}
             list={f === 'gemeinde' ? 'gebaeudesuche-gemeinden' : undefined}
             onChange={e => setEntwurf(x => ({ ...x, [f]: e.target.value }))} onKeyDown={e => e.key === 'Enter' && suchen()} />
    </label>
  );

  return (
    <Seite bild={BILD.gebaeudesuche} ueber="Gebäudesuche · aus dem Gebäuderegister"
      titel={!gesetzt ? 'Gebäude im Bestand finden' : data ? `${n(data.length)}${data.length >= GRENZE ? '+' : ''} Gebäude gefunden` : 'Suche läuft …'}
      unter="Nach Gemeinde, Baujahr, Zimmern, Wohnfläche und Gebäudeart. Zimmer und Fläche sind die Summe aller Wohnungen eines Gebäudes."
      aktionen={data?.length ? <button type="button" onClick={exportieren} className={KNOPF}><FileSpreadsheet className="h-4 w-4" /> Als Excel</button> : undefined}>
      <datalist id="gebaeudesuche-gemeinden">
        {(gemeinden?.gemeinden ?? []).map(g => <option key={g.gemeinde} value={g.gemeinde} />)}
      </datalist>
      <div className="space-y-3 rounded border bg-card p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <div className="col-span-2 sm:col-span-4 lg:col-span-2">{feld('gemeinde', 'Gemeinde', 'z.B. Küsnacht', false)}</div>
          {feld('bj_von', 'Baujahr ab', '1940')}
          {feld('bj_bis', 'Baujahr bis', '1960')}
          {feld('zi_min', 'Zimmer ab', '5')}
          {feld('zi_max', 'Zimmer bis', '7')}
          {feld('wf_min', 'Wohnfläche ab m²', '120')}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Auswahl label="Gebäudeart" wert={entwurf.art ?? ''} setWert={w => setEntwurf(x => ({ ...x, art: w || null }))} className="min-w-[220px] max-w-full"
            optionen={[{ wert: '', titel: 'Alle Gebäudearten' }, ...arten]} />
          <button type="button" onClick={suchen} className={KNOPF_HAUPT}><Search className="h-4 w-4" /> Suchen</button>
          {gesetzt && <button type="button" onClick={leeren} className={KNOPF}>Zurücksetzen</button>}
        </div>
      </div>

      {!gesetzt ? <Leer titel="Mindestens einen Filter setzen, dann suchen." />
        : error ? <Leer titel="Die Suche ging nicht.">{error instanceof Error ? error.message : String(error)}</Leer>
        : isFetching && !data ? <Leer titel="Suche läuft …" />
        : !data?.length ? <Leer titel="Kein Gebäude passt auf diese Filter." />
        : (
          <ul className={LISTE}>
            {data.map(t => (
              <li key={t.egid}>
                <button type="button" onClick={() => setzen({ parzelle: t.parzelle_id })}
                        className="grid w-full grid-cols-1 gap-2 px-5 py-4 text-left hover:bg-secondary/60 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{t.adresse ?? `EGRID ${t.egrid}`}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {[t.gemeinde, art(t), heizGruppe(heizung(t))?.titel].filter(Boolean).join(' · ')}
                    </span>
                    <span className="block truncate text-sm">{eigner?.get(t.parzelle_id) ?? <span className="text-muted-foreground">Eigentümer noch nicht abgefragt</span>}</span>
                  </span>
                  <span className="grid grid-cols-4 gap-4 text-sm tabular-nums sm:text-right">
                    <span><span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Baujahr</span>{t.baujahr ?? '–'}</span>
                    <span><span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Zimmer</span>{n(t.zimmer)}</span>
                    <span><span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Fläche</span>{n(t.wohnflaeche, ' m²')}</span>
                    <span><span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Whg.</span>{n(t.wohnungen)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      {data && data.length >= GRENZE && <p className="text-sm text-muted-foreground">Angezeigt werden die {GRENZE} grössten. Filter enger setzen, um alle zu sehen.</p>}
    </Seite>
  );
}
