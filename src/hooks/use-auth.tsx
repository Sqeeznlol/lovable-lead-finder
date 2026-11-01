import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { protokolliere } from '@/lib/protokoll';
import { geraetName } from '@/lib/geraet';

/**
 * Die Anmeldung, zurück seit dem 1. November.
 *
 * Am 31. Oktober wurde sie entfernt; seither war die Seite für jeden
 * offen, der die Adresse kennt. Für eine Liste mit Adressen, Namen und
 * Nummern von Menschen, die nie um ihre Aufnahme gebeten haben, ist das
 * kein Zustand -- und für alles, was docs/plattform.md vorhat, ist sie
 * die Voraussetzung (dort Abschnitt 6).
 *
 * Es gibt zwei Konten, nicht viele: eines für die Arbeit, eines für den
 * Admin-Bereich. Wer sich anmeldet, wird festgehalten, mit Adresse und
 * Gerät, lesbar nur im Admin-Bereich (`anmeldung_merken` in der
 * Datenbank).
 *
 * Die Passwörter stehen nirgends im Code. Sie liegen bei Supabase und
 * nur dort; der Wächter kein-passwort-im-buendel hält das fest.
 */
export type AppRole = 'admin' | 'office' | 'mobile_swipe';

interface Zustand {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
}

interface Auth extends Zustand {
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
}

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuthIntern();
  return <Ctx.Provider value={auth}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth braucht einen AuthProvider');
  return c;
}

// Supabase meldet SIGNED_IN nicht nur beim Anmelden, sondern auch, wenn
// eine Sitzung wiederhergestellt wird oder ein Tab den Fokus bekommt.
// Festgehalten wird nur die echte Anmeldung -- darum dieses Merkmal,
// das signIn setzt und der Haken wieder löscht.
let ebenAngemeldet = false;

/** Die Anmeldung festhalten: wer, von wo, mit welchem Gerät. Nie warten, nie stören. */
async function anmeldungMerken(): Promise<void> {
  try {
    // Die erzeugten Typen kennen die neue Funktion noch nicht --
    // dieselbe Lage wie bei `parzellen_karte` in use-karte.ts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc('anmeldung_merken', { p_geraet: geraetName() });
  } catch {
    /* Ein fehlender Eintrag hält niemanden auf. */
  }
}

function useAuthIntern(): Auth {
  const [z, setZ] = useState<Zustand>({ user: null, session: null, roles: [], loading: true });

  const rollenHolen = useCallback(async (userId: string): Promise<AppRole[]> => {
    const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId);
    return (data ?? []).map(r => r.role as AppRole);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((ereignis, session) => {
      if (ereignis === 'SIGNED_IN' && ebenAngemeldet) {
        ebenAngemeldet = false;
        void protokolliere('anmeldung');
        void anmeldungMerken();
      }
      if (session?.user) {
        // Nicht im Haken selbst auf die Datenbank warten: Supabase
        // blockiert sonst die nächste Anfrage.
        setTimeout(async () => {
          const roles = await rollenHolen(session.user.id);
          setZ({ user: session.user, session, roles, loading: false });
        }, 0);
      } else {
        setZ({ user: null, session: null, roles: [], loading: false });
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const roles = await rollenHolen(session.user.id);
        setZ({ user: session.user, session, roles, loading: false });
      } else {
        setZ({ user: null, session: null, roles: [], loading: false });
      }
    });

    return () => subscription.unsubscribe();
  }, [rollenHolen]);

  const signIn = async (email: string, password: string) => {
    ebenAngemeldet = true;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) ebenAngemeldet = false;
    return { error };
  };

  const signOut = async () => {
    await protokolliere('abmeldung');
    await supabase.auth.signOut();
  };

  return { ...z, signIn, signOut, isAdmin: z.roles.includes('admin') };
}
