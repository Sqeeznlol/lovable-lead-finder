import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FENSTER } from '@/lib/fenster';

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

export function useBaugesuche() {
  return useQuery({
    queryKey: ['baugesuche'],
    queryFn: async () => {
      const [g, o] = await Promise.all([
        db().from('baugesuch')
          .select('id, publiziert_am, gemeinde, adresse, parzelle_nr, egrid, beschreibung, bauherrschaft, parzelle_id, nachbar_egrids, erfasst_am, quelle, publikation_nr, publikation_id, einsprache_bis, publiziert_bis, quelle_url')
          // Proben aus "Auswerten" werden zurückgerollt; sicherheitshalber nie zeigen.
          .neq('quelle', 'probe')
          .order('publiziert_am', { ascending: false }).limit(500),
        db().from('gelegenheit').select('baugesuch_id').not('baugesuch_id', 'is', null),
      ]);
      if (g.error) throw g.error;
      const mitGelegenheit = new Set(((o.data ?? []) as { baugesuch_id: string }[]).map(x => x.baugesuch_id));
      return { gesuche: (g.data ?? []) as Gesuch[], mitGelegenheit };
    },
    staleTime: 60 * 1000,
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
  const { data, isLoading, error } = useBaugesuche();
  const [sicht, setSicht] = useState<Sicht>('alle');
  const [tage, setTage] = useState(7);
  const [wort, setWort] = useState('');
  const [offen, setOffen] = useState<string | null>(null);

  const liste = useMemo(() => (data ? filtern(data.gesuche, data.mitGelegenheit, sicht, tage, wort) : []), [data, sicht, tage, wort]);
  const zuletzt = data?.gesuche.reduce((m, g) => (g.erfasst_am > m ? g.erfasst_am : m), '') ?? '';
  const zahl = (s: Sicht) => (data ? filtern(data.gesuche, data.mitGelegenheit, s, tage, '').length : 0);

  const knopf = (an: boolean) => `h-10 rounded-full border px-4 text-sm font-medium transition-colors ${an ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-secondary'}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-muted-foreground">Kanton Zürich · täglich</p>
        <h1 className="text-3xl sm:text-4xl">Baugesuche</h1>
        <p className="text-muted-foreground">
          Jedes publizierte Gesuch, beim Bund verortet. Trifft eines ein Kundenportfolio oder dessen Nachbarn,
          entsteht daraus eine Gelegenheit.
        </p>
        {zuletzt && <p className="text-sm text-muted-foreground">Zuletzt geladen {zeit(zuletzt)} · {data?.gesuche.length.toLocaleString('de-CH')} Gesuche gespeichert</p>}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {([['alle', 'Alle'], ['bestand', 'Im Bestand'], ['gelegenheit', 'Mit Gelegenheit']] as [Sicht, string][]).map(([w, t]) => (
          <button key={w} type="button" className={knopf(sicht === w)} onClick={() => setSicht(w)}>
            {t} <span className="ml-1 tabular-nums opacity-60">{zahl(w)}</span>
          </button>
        ))}
        <select value={tage} onChange={e => setTage(Number(e.target.value))}
                className="h-10 rounded-full border bg-card px-4 text-sm font-medium">
          <option value={3}>Letzte 3 Tage</option>
          <option value={7}>Letzte 7 Tage</option>
          <option value={30}>Letzte 30 Tage</option>
          <option value={0}>Alle</option>
        </select>
        <input value={wort} onChange={e => setWort(e.target.value)} placeholder="Adresse, Gemeinde, Vorhaben, Nummer"
               className="h-10 w-full min-w-0 rounded-full border bg-card px-4 text-sm sm:w-auto sm:flex-1 sm:max-w-xs" />
      </div>

      {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> wird geladen …</p>}
      {error && <p className="text-sm text-destructive">Baugesuche nicht lesbar.</p>}
      {data && liste.length === 0 && (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <p className="font-medium">Kein Gesuch in dieser Auswahl.</p>
          <p className="mt-1 text-sm text-muted-foreground">Zeitraum vergrössern oder Filter zurücksetzen.</p>
        </div>
      )}

      <ul className="space-y-2">
        {liste.map(g => {
          const auf = offen === g.id;
          const gel = data!.mitGelegenheit.has(g.id);
          return (
            <li key={g.id} className="rounded-2xl border bg-card transition-shadow hover:shadow-ceramic-hover">
              <button type="button" onClick={() => setOffen(auf ? null : g.id)} aria-expanded={auf}
                      className="flex w-full items-start justify-between gap-4 p-4 text-left sm:p-5">
                <span className="min-w-0">
                  <span className="block font-semibold">{g.adresse ?? 'Ohne Adresse'}{g.gemeinde ? `, ${g.gemeinde}` : ''}</span>
                  <span className={`mt-1 block text-sm text-muted-foreground ${auf ? '' : 'line-clamp-2'}`}>{g.beschreibung ?? '–'}</span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {g.parzelle_id && <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">Im Bestand</span>}
                    {gel && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">Gelegenheit</span>}
                    {!g.egrid && <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">nicht verortet</span>}
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm tabular-nums text-muted-foreground">{datum(g.publiziert_am)}</span>
              </button>
              {auf && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t px-4 py-4 text-sm sm:grid-cols-4 sm:px-5">
                  <div><dt className="text-xs text-muted-foreground">Parzelle</dt><dd className="font-medium">{g.parzelle_nr ?? '–'}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">EGRID</dt><dd className="font-mono text-xs">{g.egrid ?? '–'}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Nachbarn</dt><dd className="font-medium">{g.nachbar_egrids?.length ?? 0}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Bauherrschaft</dt><dd className="font-medium">{g.bauherrschaft ?? '–'}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Publikation</dt><dd className="font-mono text-xs">{g.publikation_nr ?? '–'}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Publiziert</dt><dd className="font-medium">{datum(g.publiziert_am)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Einsprache bis</dt><dd className="font-medium">{g.einsprache_bis ? datum(g.einsprache_bis) : '–'}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Publiziert bis</dt><dd className="font-medium">{g.publiziert_bis ? datum(g.publiziert_bis) : '–'}</dd></div>
                  <div className="col-span-2 grid gap-2 sm:col-span-4 sm:grid-cols-2 lg:grid-cols-4">
                    {belege(g).map(b => (
                      <a key={b.url} href={b.url} target={FENSTER.karte}
                         className="flex min-h-11 flex-col justify-center rounded-xl border px-4 py-2 hover:bg-secondary">
                        <span className="text-sm font-medium">{b.titel}</span>
                        <span className="text-xs text-muted-foreground">{b.zeile}</span>
                      </a>
                    ))}
                    {g.egrid && (
                      <a href={`https://map.geo.admin.ch/?swisssearch=${g.egrid}&lang=de`} target={FENSTER.karte}
                         className="flex min-h-11 flex-col justify-center rounded-xl border px-4 py-2 hover:bg-secondary">
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
    </div>
  );
}
