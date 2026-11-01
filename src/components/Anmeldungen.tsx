import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, LogIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Wer sich wann von wo angemeldet hat, mit welchem Gerät.
 *
 * Nur hier, im Admin-Bereich: die Regel `anmeldung_lesen` gibt die
 * Zeilen nur an die Admin-Rolle heraus.
 *
 * - Adresse: die, die der Rand von Supabase sieht -- nicht vom Browser.
 * - Ort: vom Browser bei einem Ortsdienst erfragt (lib/ort.ts). Hat der
 *   Dienst dieselbe Adresse gesehen wie Supabase, ist er bestätigt.
 * - Gerät: System, Browser, Versionen und Bildschirm, so genau es der
 *   Browser hergibt. Den Namen "Julians iPhone" verrät kein Browser;
 *   darum benennt der Admin ein Gerät hier einmal, und der Name steht
 *   danach bei jeder Anmeldung dieses Geräts.
 */
interface Eintrag {
  id: number;
  email: string | null;
  ip: string | null;
  geraet: string | null;
  geraet_id: string | null;
  ort: string | null;
  ort_passt: boolean | null;
  zeit: string;
}

const wann = (s: string) =>
  new Date(s).toLocaleString('de-CH', {
    weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });

const konto = (email: string | null) => (email ?? '').split('@')[0] || '(unbekannt)';

// Die erzeugten Typen kennen die neuen Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

export function Anmeldungen() {
  const qc = useQueryClient();
  const [benennen, setBenennen] = useState<{ id: string; name: string } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['anmeldungen'],
    queryFn: async () => {
      const [a, n] = await Promise.all([
        db().from('anmeldung')
          .select('id,email,ip,geraet,geraet_id,ort,ort_passt,zeit')
          .order('zeit', { ascending: false })
          .limit(100),
        db().from('geraet_benennung').select('geraet_id,name'),
      ]);
      if (a.error) throw a.error;
      const namen = new Map<string, string>(
        ((n.data ?? []) as { geraet_id: string; name: string }[]).map(r => [r.geraet_id, r.name]));
      return { eintraege: (a.data ?? []) as Eintrag[], namen };
    },
    staleTime: 60 * 1000,
  });

  const speichern = async () => {
    if (!benennen) return;
    const name = benennen.name.trim();
    setFehler(null);
    const r = name
      ? await db().from('geraet_benennung').upsert({ geraet_id: benennen.id, name, gesetzt_am: new Date().toISOString() })
      : await db().from('geraet_benennung').delete().eq('geraet_id', benennen.id);
    if (r.error) { setFehler('Nicht gespeichert.'); return; }
    setBenennen(null);
    await qc.invalidateQueries({ queryKey: ['anmeldungen'] });
  };

  const eintraege = data?.eintraege;

  return (
    <div className="rounded-2xl border p-5">
      <div className="flex items-center gap-2">
        <LogIn className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Anmeldungen</h3>
      </div>
      {isLoading && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> wird geladen …
        </div>
      )}
      {error && <p className="mt-3 text-sm text-destructive">Anmeldungen nicht lesbar.</p>}
      {eintraege && eintraege.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">Noch keine Anmeldung festgehalten.</p>
      )}
      {eintraege && eintraege.length > 0 && (
        // Eine Liste statt einer Tabelle: fünf Spalten passen auf dem
        // iPhone nicht nebeneinander -- gemessen brach jede Zelle um.
        <ul className="mt-3 divide-y">
          {eintraege.map(e => {
            const name = e.geraet_id ? data!.namen.get(e.geraet_id) : undefined;
            const offen = benennen && benennen.id === e.geraet_id;
            return (
              <li key={e.id} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">{name ?? (e.geraet ?? 'Unbekanntes Gerät').split(' · ').slice(0, 2).join(' · ')}</span>
                  <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{wann(e.zeit)}</span>
                </div>
                <div className="mt-0.5 text-sm">
                  {e.ort ?? 'Ort unbekannt'}
                  <span className="text-muted-foreground"> · {konto(e.email)}</span>
                  {e.ort && e.ort_passt === false && (
                    <span className="text-xs text-muted-foreground"> · Ort vom Browser, nicht bestätigt</span>
                  )}
                </div>
                <div className="mt-0.5 break-words text-xs text-muted-foreground">
                  {e.geraet ? `${e.geraet} · ` : ''}<span className="font-mono">{e.ip ?? 'keine Adresse'}</span>
                </div>
                {e.geraet_id && !offen && (
                  <button type="button" className="mt-1 text-xs font-medium text-primary hover:underline"
                          onClick={() => { setFehler(null); setBenennen({ id: e.geraet_id!, name: name ?? '' }); }}>
                    {name ? 'Umbenennen' : 'Gerät benennen'}
                  </button>
                )}
                {offen && (
                  <form className="mt-2 flex flex-wrap gap-2" onSubmit={ev => { ev.preventDefault(); void speichern(); }}>
                    <input autoFocus value={benennen!.name} maxLength={60} placeholder="z. B. Julians iPhone"
                           onChange={ev => setBenennen({ id: benennen!.id, name: ev.target.value })}
                           className="h-11 min-w-0 flex-1 rounded-lg border bg-background px-3 text-base" />
                    <button type="submit" className="h-11 rounded-lg border px-4 text-sm font-medium">Speichern</button>
                    <button type="button" className="h-11 px-2 text-sm text-muted-foreground" onClick={() => setBenennen(null)}>Abbrechen</button>
                  </form>
                )}
                {offen && fehler && <span className="mt-1 block text-xs text-destructive">{fehler}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
