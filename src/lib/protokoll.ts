import { supabase } from '@/integrations/supabase/client';

/**
 * Festhalten, was getan wurde.
 *
 * Zwei Leute telefonieren, und niemand sieht, woran der Tag verging:
 * wie viele Objekte durchgesehen, wie viele Abfragen gemacht, wie
 * lange gearbeitet. Der Eintrag hier beantwortet das -- aus dem ersten
 * und dem letzten eines Tages ergibt sich die Dauer, ohne dass eine
 * Uhr mitlaufen muss.
 *
 * Festgehalten wird, was die Anwendung ohnehin tut, nicht jede
 * Mausbewegung. Und es wird nie gewartet: ein Protokoll, das die
 * Arbeit aufhält, wird abgeschaltet.
 */
export type Aktion =
  | 'anmeldung'
  | 'abmeldung'
  | 'abfrage'
  | 'eigentuemer'
  | 'archiviert'
  | 'deal'
  | 'ansicht';

export async function protokolliere(
  aktion: Aktion,
  gegenstand?: string | null,
  kanton?: string | null,
): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const u = data?.user;
    if (!u) return;
    // Die erzeugten Typen kennen die neue Tabelle noch nicht.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('aktivitaet').insert({
      user_id: u.id,
      email: u.email ?? null,
      aktion,
      gegenstand: gegenstand ?? null,
      kanton: kanton ?? null,
    });
  } catch {
    /* Ein fehlender Eintrag ist kein Grund, die Arbeit anzuhalten. */
  }
}
