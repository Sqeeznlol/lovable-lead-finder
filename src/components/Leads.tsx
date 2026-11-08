import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Abschnitt, KNOPF, Leer, LISTE, Marke, Reiter, Seite } from '@/components/rahmen';
import { BILD } from '@/lib/luftbild';
import { markeNachId } from '@/lib/check-marken';
import { ANTWORT_TEXT } from '@/lib/check-daten';
import { gesamt, prozent, quellen, SCHRITT_TEXT, SCHRITTE, trichterJeMarke, type TrichterZeile } from '@/lib/lead-auswertung';

/**
 * Alle Leads der Check-Seiten in einer Liste, dazu die Zahlen je Marke
 * (Julian, 8. November: "20 verschiedene Webseiten ... welche dann in
 * eine Liste schreiben mit den Leads" und "Analyse mit den ganzen
 * Stats"). Alle Marken schreiben in dieselbe Tabelle anfrage; die
 * Schritte der Besucher stehen in check_ereignis.
 */
type Lead = {
  id: string; name: string; email: string | null; telefon: string | null; adresse: string | null;
  angaben: Record<string, unknown>; erstellt_am: string; bearbeitet: boolean;
};
type Zeitraum = '7' | '30' | '90';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function Leads() {
  const [tage, setTage] = useState<Zeitraum>('30');
  const [nurOffen, setNurOffen] = useState(true);
  const qc = useQueryClient();
  const von = useMemo(() => new Date(Date.now() - Number(tage) * 864e5).toISOString(), [tage]);

  const leads = useQuery({
    queryKey: ['check-leads', tage],
    queryFn: async (): Promise<Lead[]> => {
      const { data, error } = await db.from('anfrage')
        .select('id, name, email, telefon, adresse, angaben, erstellt_am, bearbeitet')
        .gte('erstellt_am', von).order('erstellt_am', { ascending: false }).limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
  const trichter = useQuery({
    queryKey: ['check-trichter', tage],
    queryFn: async (): Promise<TrichterZeile[] | null> => {
      const { data, error } = await db.rpc('check_trichter', { von });
      // Ohne Migration gibt es die Funktion noch nicht: dann ohne Zahlen.
      if (error) return null;
      return data ?? [];
    },
  });

  const t = useMemo(() => trichterJeMarke(trichter.data ?? []), [trichter.data]);
  const summe = gesamt(t);
  const q = quellen(trichter.data ?? []);
  const liste = (leads.data ?? []).filter(l => !nurOffen || !l.bearbeitet);
  const heiss = (leads.data ?? []).filter(l => l.angaben?.prioritaet === 'heiss' && !l.bearbeitet).length;

  const erledigt = async (l: Lead) => {
    await db.from('anfrage').update({ bearbeitet: !l.bearbeitet }).eq('id', l.id);
    void qc.invalidateQueries({ queryKey: ['check-leads'] });
  };

  return (
    <Seite bild={BILD.pipedrive} ueber="Check-Seiten" titel="Leads"
      unter={<>
        <span className="block">Alle Marken schreiben in dieselbe Liste.</span>
        {/* Die Zeitwahl gehört sichtbar unter den Titel: "aktionen" erscheint
            am Computer nur mit einer Seitentafel, die diese Seite nicht hat. */}
        <span className="mt-4 block"><Reiter<Zeitraum> wahl={tage} setWahl={setTage} optionen={[{ wert: '7' as Zeitraum, titel: '7 Tage' }, { wert: '30' as Zeitraum, titel: '30 Tage' }, { wert: '90' as Zeitraum, titel: '90 Tage' }]} /></span>
      </>}
      kennzahlen={[
        { titel: `Leads ${tage} Tage`, wert: String(leads.data?.length ?? 0), marke: heiss ? <Marke art="heiss">{heiss} heiss offen</Marke> : undefined },
        { titel: 'Besucher', wert: trichter.data ? String(summe.aufruf) : '–' },
        { titel: 'Abschluss', wert: trichter.data ? prozent(summe.aufruf ? summe.lead / summe.aufruf : null) : '–' },
        { titel: 'Marken mit Besuch', wert: trichter.data ? String(t.filter(m => m.werte.aufruf).length) : '–' },
      ]}
    >
      <Abschnitt titel="Leads" zahl={liste.length}
        rechts={<button type="button" className={KNOPF} onClick={() => setNurOffen(!nurOffen)}>{nurOffen ? 'Auch erledigte zeigen' : 'Nur offene'}</button>}>
        {leads.isLoading ? <Leer titel="Lädt …" />
          : leads.error ? <Leer titel="Leads konnten nicht geladen werden." />
          : !liste.length ? <Leer titel="Noch keine Leads in diesem Zeitraum." />
          : (
            <ul className={LISTE}>
              {liste.map(l => {
                const a = l.angaben ?? {};
                const m = markeNachId(String(a.marke ?? ''));
                const antwort = [
                  ANTWORT_TEXT.eigentuemer[a.eigentuemer as keyof typeof ANTWORT_TEXT.eigentuemer],
                  ANTWORT_TEXT.absicht[a.absicht as keyof typeof ANTWORT_TEXT.absicht],
                  ANTWORT_TEXT.zeitraum[a.zeitraum as keyof typeof ANTWORT_TEXT.zeitraum],
                ].filter(Boolean).join(' · ');
                return (
                  <li key={l.id} className={`grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] ${l.bearbeitet ? 'opacity-55' : ''}`}>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{l.name}</span>
                        {a.prioritaet === 'heiss' && <Marke art="heiss">heiss</Marke>}
                        {a.prioritaet === 'warm' && <Marke art="violett">warm</Marke>}
                        <Marke>{m ? m.name.join('') : String(a.marke ?? 'Anfrage')}</Marke>
                        {(a.utm_source || a.fbclid || a.gclid) && <Marke>{String(a.utm_source ?? (a.fbclid ? 'facebook' : 'google'))}</Marke>}
                      </div>
                      <div className="text-sm">{l.adresse ?? '–'}{a.flaeche ? ` · ${a.flaeche} m²` : ''}{a.zone ? ` · ${a.zone}` : ''}</div>
                      {antwort && <div className="text-sm text-muted-foreground">{antwort}</div>}
                      <div className="flex flex-wrap gap-x-4 text-sm">
                        {l.telefon && <a className="underline underline-offset-2" href={`tel:${l.telefon.replace(/\s/g, '')}`}>{l.telefon}</a>}
                        {l.email && <a className="underline underline-offset-2" href={`mailto:${l.email}`}>{l.email}</a>}
                        <span className="text-muted-foreground">{new Date(l.erstellt_am).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      </div>
                    </div>
                    <button type="button" className={`${KNOPF} self-start`} onClick={() => void erledigt(l)}>{l.bearbeitet ? 'Wieder offen' : 'Erledigt'}</button>
                  </li>
                );
              })}
            </ul>
          )}
      </Abschnitt>

      <Abschnitt titel="Je Marke" hinweis="Sitzungen, die den Schritt erreicht haben. Abschluss = Leads je Besucher.">
        {trichter.data === null ? <Leer titel="Die Zählung ist noch nicht eingerichtet.">In GitHub den Ablauf «Migrationen» mit «einspielen» starten (Repository der Webseite).</Leer>
          : !t.length ? <Leer titel="Noch keine Besucher in diesem Zeitraum." />
          : (
            <div className="overflow-x-auto rounded border bg-card">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="border-b text-left text-muted-foreground">
                  <th className="p-3 font-medium">Marke</th>
                  {SCHRITTE.map(s => <th key={s} className="p-3 text-right font-medium">{SCHRITT_TEXT[s]}</th>)}
                  <th className="p-3 text-right font-medium">Abschluss</th>
                </tr></thead>
                <tbody>
                  {t.map(m => (
                    <tr key={m.marke} className="border-b last:border-0">
                      <td className="p-3">{markeNachId(m.marke)?.name.join('') ?? m.marke}</td>
                      {SCHRITTE.map(s => <td key={s} className="p-3 text-right tabular-nums">{m.werte[s]}</td>)}
                      <td className="p-3 text-right tabular-nums font-medium">{prozent(m.quote)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Abschnitt>

      {q.length > 0 && (
        <Abschnitt titel="Woher die Besucher kommen">
          <ul className={LISTE}>
            {q.map(x => (
              <li key={x.quelle} className="flex items-center justify-between gap-4 p-3 text-sm">
                <span>{x.quelle}</span>
                <span className="tabular-nums text-muted-foreground">{x.besucher} Besucher · {x.leads} Leads · {prozent(x.besucher ? x.leads / x.besucher : null)}</span>
              </li>
            ))}
          </ul>
        </Abschnitt>
      )}
    </Seite>
  );
}
