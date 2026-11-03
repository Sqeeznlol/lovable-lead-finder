import { useState } from 'react';
import { Auswahl } from '@/components/Auswahl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Teams und wer welchen Kunden sieht -- im Admin-Bereich.
 *
 * Die Grenze zieht die Datenbank (Migration 20261101230000_teams.sql):
 * Gehört ein Kunde einem Team, sehen ihn und seine Portfolios und
 * Gelegenheiten nur dessen Mitglieder und der Admin. Ohne Team sehen
 * ihn alle Angemeldeten. Hier wird nur eingestellt, nicht geschützt.
 */
// Die erzeugten Typen kennen die Plattform-Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

interface Team { id: string; name: string; team_mitglied: { user_id: string }[] }
interface Konto { id: string; email: string }
interface Kunde { id: string; team_id: string | null; akteur: { name: string } | null }

const kurz = (email: string) => email.split('@')[0];

export function Teams() {
  const qc = useQueryClient();
  const [neu, setNeu] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const [t, k, m] = await Promise.all([
        db().from('team').select('id, name, team_mitglied(user_id)').order('name'),
        db().rpc('konten_liste'),
        db().from('mandant').select('id, team_id, akteur:akteur_id(name)'),
      ]);
      if (t.error) throw t.error;
      return { teams: (t.data ?? []) as Team[], konten: (k.data ?? []) as Konto[], kunden: (m.data ?? []) as Kunde[] };
    },
  });

  const lauf = async (p: Promise<{ error: unknown }>) => {
    setFehler(null);
    const r = await p;
    if (r.error) setFehler('Nicht gespeichert.');
    await qc.invalidateQueries({ queryKey: ['teams'] });
    await qc.invalidateQueries({ queryKey: ['portfolios'] });
    await qc.invalidateQueries({ queryKey: ['portfolio-liste'] });
    await qc.invalidateQueries({ queryKey: ['gelegenheiten'] });
  };

  return (
    <div className="rounded-2xl border p-5">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Teams und Kunden</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Gehört ein Kunde einem Team, sehen ihn nur dessen Mitglieder und der Admin. Ohne Team sehen ihn alle.
      </p>
      {isLoading && <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> wird geladen …</p>}
      {error && <p className="mt-3 text-sm text-destructive">Teams nicht lesbar.</p>}
      {fehler && <p className="mt-3 text-sm text-destructive">{fehler}</p>}

      {data && (
        <div className="mt-4 space-y-5">
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (neu.trim()) void lauf(db().from('team').insert({ name: neu.trim() })).then(() => setNeu('')); }}>
            <input value={neu} onChange={e => setNeu(e.target.value)} placeholder="Neues Team, z. B. Akquise Zürich"
                   className="h-11 min-w-0 flex-1 rounded-lg border bg-white px-3 text-base text-slate-900" />
            <button type="submit" disabled={!neu.trim()} className="h-11 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-40">Anlegen</button>
          </form>

          {data.teams.length === 0 && <p className="text-sm text-muted-foreground">Noch kein Team.</p>}
          <ul className="space-y-3">
            {data.teams.map(t => {
              const mitglieder = new Set(t.team_mitglied.map(m => m.user_id));
              return (
                <li key={t.id} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{t.name}</span>
                    <button type="button" className="text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => { if (confirm(`Team "${t.name}" löschen? Seine Kunden werden für alle sichtbar.`)) void lauf(db().from('team').delete().eq('id', t.id)); }}>
                      Löschen
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {data.konten.map(k => {
                      const drin = mitglieder.has(k.id);
                      return (
                        <button key={k.id} type="button"
                                onClick={() => void lauf(drin
                                  ? db().from('team_mitglied').delete().eq('team_id', t.id).eq('user_id', k.id)
                                  : db().from('team_mitglied').insert({ team_id: t.id, user_id: k.id }))}
                                className={`h-9 rounded-full border px-3 text-sm ${drin ? 'border-slate-900 bg-slate-900 text-white' : ''}`}
                                aria-pressed={drin}>
                          {kurz(k.email)}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>

          {data.kunden.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Kunden</p>
              <ul className="divide-y rounded-xl border">
                {data.kunden.map(k => (
                  <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
                    <span>{k.akteur?.name ?? 'Ohne Namen'}</span>
                    <Auswahl label={`Team für ${k.akteur?.name ?? 'Kunde'}`} wert={k.team_id ?? ''} klein className="min-w-[200px]"
                             setWert={w => void lauf(db().from('mandant').update({ team_id: w || null }).eq('id', k.id))}
                             optionen={[{ wert: '', titel: 'Alle sehen ihn' }, ...data.teams.map(t => ({ wert: t.id, titel: `Nur ${t.name}` }))]} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
