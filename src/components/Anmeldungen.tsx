import { useQuery } from '@tanstack/react-query';
import { Loader2, LogIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Wer sich wann von wo angemeldet hat.
 *
 * Nur hier, im Admin-Bereich: die Regel `anmeldung_lesen` gibt die
 * Zeilen nur an die Admin-Rolle heraus. Die Adresse ist die, die der
 * Dienst von Supabase am Rand sieht; der Gerätename ist, was der
 * Browser verrät -- System und Browser, nicht der Name des Geräts (den
 * gibt kein Browser her).
 */
interface Eintrag {
  id: number;
  email: string | null;
  ip: string | null;
  geraet: string | null;
  zeit: string;
}

const wann = (s: string) =>
  new Date(s).toLocaleString('de-CH', {
    weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

const konto = (email: string | null) => (email ?? '').split('@')[0] || '(unbekannt)';

export function Anmeldungen() {
  const { data, isLoading } = useQuery({
    queryKey: ['anmeldungen'],
    queryFn: async (): Promise<Eintrag[]> => {
      // Die erzeugten Typen kennen die neue Tabelle noch nicht.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('anmeldung')
        .select('id,email,ip,geraet,zeit')
        .order('zeit', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Eintrag[];
    },
    staleTime: 60 * 1000,
  });

  return (
    <div className="rounded-2xl border p-5">
      <div className="flex items-center gap-2">
        <LogIn className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Anmeldungen</h3>
        {data && <span className="text-xs text-muted-foreground">{data.length}</span>}
      </div>
      {isLoading && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> wird geladen …
        </div>
      )}
      {data && data.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Noch keine Anmeldung festgehalten.
        </p>
      )}
      {data && data.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="pb-2 pr-4 font-medium">Wann</th>
                <th className="pb-2 pr-4 font-medium">Konto</th>
                <th className="pb-2 pr-4 font-medium">Adresse</th>
                <th className="pb-2 font-medium">Gerät</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map(e => (
                <tr key={e.id}>
                  <td className="py-2 pr-4 whitespace-nowrap tabular-nums">{wann(e.zeit)}</td>
                  <td className="py-2 pr-4">{konto(e.email)}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{e.ip ?? '–'}</td>
                  <td className="py-2">{e.geraet ?? '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
