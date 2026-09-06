import { useQuery } from '@tanstack/react-query';
import { Clock, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Tag {
  tag: string;
  email: string;
  von: string;
  bis: string;
  minuten: number;
  eintraege: number;
  abfragen: number;
}

interface Eintrag {
  id: number;
  email: string | null;
  aktion: string;
  gegenstand: string | null;
  kanton: string | null;
  zeit: string;
}

const uhr = (s: string) =>
  new Date(s).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });

const datum = (s: string) =>
  new Date(s).toLocaleDateString('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit' });

const dauer = (m: number) =>
  m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;

const WORT: Record<string, string> = {
  anmeldung: 'angemeldet',
  abmeldung: 'abgemeldet',
  abfrage: 'Grundbuch abgefragt',
  eigentuemer: 'Eigentümer gespeichert',
  archiviert: 'ins Archiv',
  deal: 'Deal angelegt',
  ansicht: 'geöffnet',
};

/**
 * Wer war da, wann, wie lange, und was ist dabei herausgekommen.
 *
 * Die Dauer stammt aus dem ersten und dem letzten Eintrag eines Tages
 * -- keine Uhr, die mitläuft, und keine Erfassung von Pausen. Sie sagt
 * damit ungefähr, wie lange gearbeitet wurde, und genau, wie viel
 * dabei entstanden ist.
 */
export function Protokoll() {
  const tage = useQuery({
    queryKey: ['protokoll', 'tage'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('arbeitstage', { p_tage: 30 });
      if (error) throw error;
      return (data || []) as Tag[];
    },
  });

  const letzte = useQuery({
    queryKey: ['protokoll', 'letzte'],
    queryFn: async () => {
      // Die erzeugten Typen kennen die neue Tabelle noch nicht.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('aktivitaet')
        .select('id, email, aktion, gegenstand, kanton, zeit')
        .order('zeit', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as Eintrag[];
    },
  });

  if (tage.isLoading) {
    return (
      <div className="rounded-2xl border p-6 text-center text-muted-foreground">
        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (tage.error) {
    return (
      <div className="rounded-2xl border p-5">
        <p className="text-sm font-medium">Protokoll</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Noch nicht eingerichtet — die Migration muss eingespielt werden.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border">
        <div className="flex items-center gap-2 border-b p-5">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-serif">Arbeitstage</h3>
          <span className="ml-auto text-xs text-muted-foreground">letzte 30 Tage</span>
        </div>

        {(tage.data || []).length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">
            Noch nichts festgehalten. Die Einträge entstehen ab der nächsten
            Anmeldung.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="p-3 font-medium">Tag</th>
                  <th className="p-3 font-medium">Wer</th>
                  <th className="p-3 font-medium">von — bis</th>
                  <th className="p-3 text-right font-medium">Dauer</th>
                  <th className="p-3 text-right font-medium">Abfragen</th>
                  <th className="p-3 text-right font-medium">Schritte</th>
                </tr>
              </thead>
              <tbody>
                {(tage.data || []).map((t, i) => (
                  <tr key={`${t.tag}-${t.email}-${i}`} className="border-b last:border-0">
                    <td className="p-3 whitespace-nowrap">{datum(t.von)}</td>
                    <td className="p-3">{t.email}</td>
                    <td className="p-3 whitespace-nowrap tabular-nums">
                      {uhr(t.von)} — {uhr(t.bis)}
                    </td>
                    <td className="p-3 text-right tabular-nums">{dauer(t.minuten)}</td>
                    <td className="p-3 text-right tabular-nums">{t.abfragen}</td>
                    <td className="p-3 text-right tabular-nums">{t.eintraege}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border">
        <div className="border-b p-5">
          <h3 className="font-serif">Zuletzt geschehen</h3>
        </div>
        <ul className="divide-y">
          {(letzte.data || []).map(e => (
            <li key={e.id} className="flex items-baseline gap-3 px-5 py-2 text-sm">
              <span className="w-28 shrink-0 tabular-nums text-muted-foreground">
                {datum(e.zeit)} {uhr(e.zeit)}
              </span>
              <span className="w-48 shrink-0 truncate">{e.email || '—'}</span>
              <span className="min-w-0">
                {WORT[e.aktion] ?? e.aktion}
                {e.gegenstand ? ` — ${e.gegenstand}` : ''}
                {e.kanton ? ` (${e.kanton})` : ''}
              </span>
            </li>
          ))}
          {(letzte.data || []).length === 0 && (
            <li className="px-5 py-3 text-sm text-muted-foreground">
              Noch keine Einträge.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
