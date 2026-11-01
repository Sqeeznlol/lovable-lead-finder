import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FENSTER } from '@/lib/fenster';
import { FELD, Leer, Marke, Reiter, Seite } from '@/components/rahmen';
import { BILD } from '@/lib/luftbild';

/**
 * Alle Baugesuche, die der Ablauf "Baugesuche" geladen hat -- zum
 * Prüfen. Bisher sah man sie nur, wenn eines ein Portfolio traf (als
 * Gelegenheit); die übrigen lagen unsichtbar in der Datenbank.
 *
 * Quelle: "Baugesuche im Kanton Zürich", Statistisches Amt, täglich.
 * Der Ablauf läuft täglich 05:23 UTC (06:23 Winterzeit, 07:23 Sommerzeit).
 */
export interface Gesuch {
  id: string; publiziert_am: string; gemeinde: string | null; adresse: string | null; parzelle_nr: string | null;
  egrid: string | null; beschreibung: string | null; bauherrschaft: string | null; parzelle_id: string | null;
  nachbar_egrids: string[] | null; erfasst_am: string; quelle: string;
  publikation_nr?: string | null; publikation_id?: string | null;
  einsprache_bis?: string | null; publiziert_bis?: string | null; quelle_url?: string | null;
}

/**
 * Die Wege zum Nachprüfen eines Gesuchs: die Publikation im Amtsblatt
 * und der Datensatz, aus dem die Zeile stammt. Nur Adressen, die
 * "Auswerten / amtsblatt" mit einer echten Publikation geprüft hat:
 * die Detailseite zeigt die Nummer im Browser (Lauf 64), das PDF kommt
 * als %PDF zurück. Mit amtsblattportal.ch statt amtsblatt.zh.ch bleibt
 * die Seite leer, mit der Nummer statt der Kennung meldet sie Fehler.
 */
export function belege(g: Gesuch): { titel: string; zeile: string; url: string }[] {
  const b: { titel: string; zeile: string; url: string }[] = [];
  if (g.publikation_id) {
    b.push({ titel: 'Publikation im Amtsblatt', zeile: g.publikation_nr ?? 'Amtsblatt des Kantons Zürich', url: AMTSBLATT_SEITE(g.publikation_id) });
    b.push({ titel: 'Publikation als PDF', zeile: 'zum Ablegen oder Weitergeben', url: `https://amtsblatt.zh.ch/api/v1/publications/${g.publikation_id}/pdf` });
  }
  if (g.quelle_url) b.push({ titel: 'Quelle', zeile: 'Baugesuche im Kanton Zürich, Statistisches Amt', url: g.quelle_url });
  return b;
}

// Die erzeugten Typen kennen die Plattform-Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;
const AMTSBLATT_SEITE = (id: string) => `https://amtsblatt.zh.ch/#!/search/publications/detail/${id}`;
const datum = (s: string) => new Date(s).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
const zeit = (s: string) => new Date(s).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/**
 * Die Gesuche eines Zeitraums. Gefiltert wird in der Datenbank: seit das
 * ganze Jahr geladen ist (rund 6000), zeigten die neuesten 500 unter
 * "Alle" nur einen Teil. Gezählt wird ebenfalls dort, nicht im Browser.
 */
export function useBaugesuche(tage = 7) {
  return useQuery({
    queryKey: ['baugesuche', tage],
    queryFn: async () => {
      const ab = tage > 0 ? new Date(Date.now() - tage * 864e5).toISOString().slice(0, 10) : null;
      let q = db().from('baugesuch')
        .select('id, publiziert_am, gemeinde, adresse, parzelle_nr, egrid, beschreibung, bauherrschaft, parzelle_id, nachbar_egrids, erfasst_am, quelle, publikation_nr, publikation_id, einsprache_bis, publiziert_bis, quelle_url')
        // Proben aus "Auswerten" werden zurückgerollt; sicherheitshalber nie zeigen.
        .neq('quelle', 'probe');
      if (ab) q = q.gte('publiziert_am', ab);
      const zaehle = async (f: (x: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        let c = db().from('baugesuch').select('id', { count: 'exact', head: true }).neq('quelle', 'probe');
        if (ab) c = c.gte('publiziert_am', ab);
        const r = await f(c);
        return (r.count as number | null) ?? 0;
      };
      const [g, o, gesamt, bestand, ohneOrt, letzte] = await Promise.all([
        q.order('publiziert_am', { ascending: false }).limit(1000),
        db().from('gelegenheit').select('baugesuch_id').not('baugesuch_id', 'is', null),
        zaehle(c => c),
        zaehle(c => c.not('parzelle_id', 'is', null)),
        zaehle(c => c.is('egrid', null)),
        db().from('baugesuch').select('erfasst_am').order('erfasst_am', { ascending: false }).limit(1),
      ]);
      if (g.error) throw g.error;
      const mitGelegenheit = new Set(((o.data ?? []) as { baugesuch_id: string }[]).map(x => x.baugesuch_id));
      return {
        gesuche: (g.data ?? []) as Gesuch[], mitGelegenheit, gesamt, bestand, ohneOrt,
        zuletzt: (letzte.data?.[0]?.erfasst_am as string | undefined) ?? '',
      };
    },
    staleTime: 60 * 1000,
    placeholderData: prev => prev,
  });
}

type Sicht = 'alle' | 'bestand' | 'gelegenheit';

/** Filter als reine Funktion -- getestet in baugesuche.test.ts. */
export function filtern(gs: Gesuch[], mitGel: Set<string>, sicht: Sicht, tage: number, wort: string, heute = new Date()): Gesuch[] {
  const ab = tage > 0 ? new Date(heute.getTime() - tage * 864e5).toISOString().slice(0, 10) : '';
  const w = wort.trim().toLowerCase();
  return gs.filter(g =>
    (!ab || g.publiziert_am >= ab)
    && (sicht === 'alle' || (sicht === 'bestand' ? !!g.parzelle_id : mitGel.has(g.id)))
    && (!w || [g.adresse, g.gemeinde, g.beschreibung, g.parzelle_nr, g.publikation_nr].some(x => (x ?? '').toLowerCase().includes(w))));
}

export function Baugesuche() {
  const [tage, setTage] = useState(7);
  const { data, isLoading, error } = useBaugesuche(tage);
  const [sicht, setSicht] = useState<Sicht>('alle');
  const [wort, setWort] = useState('');
  const [offen, setOffen] = useState<string | null>(null);

  // Der Zeitraum ist schon in der Abfrage; hier nur noch Sicht und Suchwort.
  const liste = useMemo(() => (data ? filtern(data.gesuche, data.mitGelegenheit, sicht, 0, wort) : []), [data, sicht, wort]);
  const zahl = (s: Sicht) => (data ? filtern(data.gesuche, data.mitGelegenheit, s, 0, '').length : 0);
  const zeitraum = tage === 0 ? 'insgesamt' : tage === 365 ? 'in diesem Jahr' : `in ${tage} Tagen`;
  const mitGel = data ? data.gesuche.filter(g => data.mitGelegenheit.has(g.id)).length : 0;

  return (
    <Seite bild={BILD.baugesuche} ueber="Baugesuche · Kanton Zürich · täglich"
      titel={data ? `${data.gesamt.toLocaleString('de-CH')} Baugesuche ${zeitraum}` : ' '}
      unter={<>
        Jedes publizierte Gesuch, beim Bund verortet. Trifft eines ein Kundenportfolio oder dessen Nachbarn, entsteht daraus eine Gelegenheit.
        {data?.zuletzt && <span className="mt-1 block text-sm">Zuletzt geladen {zeit(data.zuletzt)}</span>}
      </>}
      kennzahlen={data ? [
        { titel: 'Publiziert', wert: data.gesamt.toLocaleString('de-CH'), marke: <Marke art="minze">{tage ? `${tage} Tage` : 'alle'}</Marke>, onClick: () => setSicht('alle') },
        { titel: 'Im Bestand', wert: data.bestand.toLocaleString('de-CH'), marke: data.gesamt ? <Marke art="lila">{Math.round((data.bestand / data.gesamt) * 100)} %</Marke> : undefined, onClick: () => setSicht('bestand') },
        { titel: 'Gelegenheiten', wert: mitGel.toLocaleString('de-CH'), marke: mitGel ? <Marke art="heiss">heiss</Marke> : undefined, onClick: () => setSicht('gelegenheit') },
        { titel: 'Nicht verortet', wert: data.ohneOrt.toLocaleString('de-CH'), marke: <Marke>ohne EGRID</Marke> },
      ] : undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <Reiter<Sicht> wahl={sicht} setWahl={setSicht}
                       optionen={([['alle', 'Alle'], ['bestand', 'Im Bestand'], ['gelegenheit', 'Mit Gelegenheit']] as [Sicht, string][]).map(([w, t]) => ({ wert: w, titel: t, zahl: zahl(w) }))} />
        <select value={tage} onChange={e => setTage(Number(e.target.value))}
                className={`${FELD} pr-8`}>
          <option value={3}>Letzte 3 Tage</option>
          <option value={7}>Letzte 7 Tage</option>
          <option value={30}>Letzte 30 Tage</option>
          <option value={90}>Letzte 90 Tage</option>
          <option value={365}>Letztes Jahr</option>
          <option value={0}>Alle</option>
        </select>
        <input value={wort} onChange={e => setWort(e.target.value)} placeholder="Adresse, Gemeinde, Vorhaben, Nummer"
               className={`${FELD} w-full sm:w-auto sm:flex-1 sm:max-w-xs`} />
      </div>

      {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> wird geladen …</p>}
      {error && <p className="text-sm text-destructive">Baugesuche nicht lesbar.</p>}
      {data && liste.length === 0 && (
        <Leer titel="Kein Gesuch in dieser Auswahl.">Zeitraum vergrössern oder Filter zurücksetzen.</Leer>
      )}

      <ul className="space-y-2">
        {liste.map(g => {
          const auf = offen === g.id;
          const gel = data!.mitGelegenheit.has(g.id);
          return (
            <li key={g.id} className="rounded border bg-card transition-colors hover:border-foreground/25">
              <button type="button" onClick={() => setOffen(auf ? null : g.id)} aria-expanded={auf}
                      className="flex w-full items-start justify-between gap-4 p-4 text-left sm:p-5">
                <span className="min-w-0">
                  <span className="block font-semibold">{g.adresse ?? 'Ohne Adresse'}{g.gemeinde ? `, ${g.gemeinde}` : ''}</span>
                  <span className={`mt-1 block text-sm text-muted-foreground ${auf ? '' : 'line-clamp-2'}`}>{g.beschreibung ?? '–'}</span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {g.parzelle_id && <Marke art="minze">Im Bestand</Marke>}
                    {gel && <Marke art="heiss">Gelegenheit</Marke>}
                    {!g.egrid && <Marke>nicht verortet</Marke>}
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm text-muted-foreground">{datum(g.publiziert_am)}</span>
              </button>
              {auf && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t px-4 py-4 text-sm sm:grid-cols-4 sm:px-5">
                  <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Parzelle</dt><dd className="font-medium">{g.parzelle_nr ?? '–'}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">EGRID</dt><dd className="font-mono text-xs">{g.egrid ?? '–'}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Nachbarn</dt><dd className="font-medium">{g.nachbar_egrids?.length ?? 0}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Bauherrschaft</dt><dd className="font-medium">{g.bauherrschaft ?? '–'}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Publikation</dt><dd className="font-mono text-xs">{g.publikation_nr ?? '–'}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Publiziert</dt><dd className="font-medium">{datum(g.publiziert_am)}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Einsprache bis</dt><dd className="font-medium">{g.einsprache_bis ? datum(g.einsprache_bis) : '–'}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Publiziert bis</dt><dd className="font-medium">{g.publiziert_bis ? datum(g.publiziert_bis) : '–'}</dd></div>
                  <div className="col-span-2 grid gap-2 sm:col-span-4 sm:grid-cols-2 lg:grid-cols-4">
                    {belege(g).map(b => (
                      <a key={b.url} href={b.url} target={FENSTER.karte}
                         className="flex min-h-11 flex-col justify-center rounded-[3px] border px-4 py-2 hover:bg-secondary">
                        <span className="text-sm font-medium">{b.titel}</span>
                        <span className="text-xs text-muted-foreground">{b.zeile}</span>
                      </a>
                    ))}
                    {g.egrid && (
                      <a href={`https://map.geo.admin.ch/?swisssearch=${g.egrid}&lang=de`} target={FENSTER.karte}
                         className="flex min-h-11 flex-col justify-center rounded-[3px] border px-4 py-2 hover:bg-secondary">
                        <span className="text-sm font-medium">Parzelle im Bundes-GIS</span>
                        <span className="text-xs text-muted-foreground">map.geo.admin.ch</span>
                      </a>
                    )}
                  </div>
                </dl>
              )}
            </li>
          );
        })}
      </ul>
    </Seite>
  );
}
