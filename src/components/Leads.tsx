import { Fragment, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Abschnitt, KNOPF, Leer, LISTE, Marke, Reiter, Seite } from '@/components/rahmen';
import { BILD } from '@/lib/luftbild';
import { LeadDetail, type Lead } from '@/components/LeadDetail';
import { markeNachId } from '@/lib/check-marken';
import { ANTWORT_TEXT, gesamt, prozent, quellen, SCHRITT_TEXT, SCHRITTE, trichterJeSeite, type TrichterZeile } from '@/lib/lead-auswertung';

/**
 * Alle Leads der Check-Seiten in einer Liste, dazu die Zahlen je Marke
 * (Julian, 8. November: "20 verschiedene Webseiten ... welche dann in
 * eine Liste schreiben mit den Leads" und "Analyse mit den ganzen
 * Stats"). Alle Marken schreiben in dieselbe Tabelle anfrage; die
 * Schritte der Besucher stehen in check_ereignis.
 */
type Zeitraum = '7' | '30' | '90';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const MARKEN_NAME = (id: string) => markeNachId(id)?.name.join('') ?? id;

export function Leads() {
  const [tage, setTage] = useState<Zeitraum>('30');
  const [nurOffen, setNurOffen] = useState(true);
  const [offenId, setOffenId] = useState<string | null>(null);
  // Eine Webseite in der Tabelle aufklappen: darunter ihre Leads.
  const [seiteAuf, setSeiteAuf] = useState<string | null>(null);
  const qc = useQueryClient();
  const von = useMemo(() => new Date(Date.now() - Number(tage) * 864e5).toISOString(), [tage]);

  const leads = useQuery({
    queryKey: ['check-leads', tage],
    queryFn: async (): Promise<Lead[]> => {
      const { data, error } = await db.from('anfrage')
        .select('id, name, email, telefon, adresse, egrid, angaben, erstellt_am, bearbeitet, bemerkung')
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

  const zeilen = useMemo(() => trichter.data ?? [], [trichter.data]);
  const t = useMemo(() => trichterJeSeite(zeilen), [zeilen]);
  const summe = gesamt(t);
  const q = quellen(zeilen);
  const alle = leads.data ?? [];
  const offen = (leads.data ?? []).find(l => l.id === offenId) ?? null;
  const liste = alle.filter(l => !nurOffen || !l.bearbeitet);
  const heiss = alle.filter(l => l.angaben?.prioritaet === 'heiss' && !l.bearbeitet).length;

  const erledigt = async (l: Lead) => {
    await db.from('anfrage').update({ bearbeitet: !l.bearbeitet }).eq('id', l.id);
    void qc.invalidateQueries({ queryKey: ['check-leads'] });
  };
  const notiz = async (l: Lead, text: string) => {
    await db.from('anfrage').update({ bemerkung: text.trim() || null }).eq('id', l.id);
    await qc.invalidateQueries({ queryKey: ['check-leads'] });
  };

  return (
    <Seite bild={BILD.pipedrive} ueber="Check-Seiten" titel="Leads"
      unter={<>
        <span className="block">Alle Webseiten schreiben in dieselbe Liste.</span>
        {/* Die Zeitwahl gehört sichtbar unter den Titel: "aktionen" erscheint
            am Computer nur mit einer Seitentafel, die diese Seite nicht hat. */}
        <span className="mt-4 block"><Reiter<Zeitraum> wahl={tage} setWahl={setTage} optionen={[{ wert: '7' as Zeitraum, titel: '7 Tage' }, { wert: '30' as Zeitraum, titel: '30 Tage' }, { wert: '90' as Zeitraum, titel: '90 Tage' }]} /></span>
      </>}
      kennzahlen={[
        { titel: `Leads ${tage} Tage`, wert: String(alle.length), marke: heiss ? <Marke art="heiss">{heiss} heiss offen</Marke> : undefined },
        { titel: 'Besucher', wert: trichter.data ? String(summe.aufruf) : '–' },
        { titel: 'Abschluss', wert: trichter.data ? prozent(summe.aufruf ? summe.lead / summe.aufruf : null) : '–' },
        { titel: 'Webseiten mit Besuch', wert: trichter.data ? String(t.filter(m => m.werte.aufruf).length) : '–' },
      ]}
    >
      <Abschnitt titel="Leads" zahl={liste.length}
        rechts={<div className="flex flex-wrap gap-2">
          <button type="button" className={KNOPF} onClick={() => setNurOffen(!nurOffen)}>{nurOffen ? 'Auch erledigte zeigen' : 'Nur offene'}</button>
        </div>}>
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
                  <li key={l.id} className={`grid cursor-pointer gap-2 p-4 transition-colors hover:bg-secondary/60 sm:grid-cols-[minmax(0,1fr)_auto] ${l.bearbeitet ? 'opacity-55' : ''}`}
                      onClick={e => { if (!(e.target as HTMLElement).closest('a, button')) setOffenId(l.id); }}>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button type="button" className="text-left font-medium underline-offset-4 hover:underline" onClick={() => setOffenId(l.id)}>{l.name}</button>
                        {a.prioritaet === 'heiss' && <Marke art="heiss">heiss</Marke>}
                        {a.prioritaet === 'warm' && <Marke art="violett">warm</Marke>}
                        <Marke>{String(a.domain ?? (m ? m.name.join('') : 'Anfrage'))}</Marke>
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

      <Abschnitt titel="Je Webseite" hinweis="Sitzungen, die den Schritt erreicht haben. Abschluss = Leads je Besucher. Ein Klick auf eine Webseite zeigt ihre Leads.">
        {trichter.data === null ? <Leer titel="Die Zählung ist noch nicht eingerichtet.">In GitHub den Ablauf «Migrationen» mit «einspielen» starten (Repository der Webseite).</Leer>
          : !t.length ? <Leer titel="Noch keine Besucher in diesem Zeitraum." />
          : (
            <div className="overflow-x-auto rounded border bg-card">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="border-b text-left text-muted-foreground">
                  <th className="p-3 font-medium">Webseite</th>
                  {SCHRITTE.map(s => <th key={s} className="p-3 text-right font-medium">{SCHRITT_TEXT[s]}</th>)}
                  <th className="p-3 text-right font-medium">Abschluss</th>
                </tr></thead>
                <tbody>
                  {t.map(m => {
                    const auf = seiteAuf === m.domain;
                    const ihre = alle.filter(l => String(l.angaben?.domain ?? '').replace(/^www\./, '') === m.domain);
                    return (
                      <Fragment key={m.domain}>
                        <tr className={`cursor-pointer border-b last:border-0 hover:bg-secondary/60 ${auf ? 'bg-secondary/60' : ''}`}
                            onClick={() => setSeiteAuf(auf ? null : m.domain)} aria-expanded={auf}>
                          <td className="p-3">
                            <span className="flex items-center gap-2 font-medium"><span aria-hidden className={`inline-block transition-transform ${auf ? 'rotate-90' : ''}`}>›</span>{m.domain}</span>
                            <span className="block pl-4 text-xs text-muted-foreground">{MARKEN_NAME(m.marke)} · {ihre.length} {ihre.length === 1 ? 'Lead' : 'Leads'} in der Liste</span>
                          </td>
                          {SCHRITTE.map(s => <td key={s} className="p-3 text-right tabular-nums">{m.werte[s]}</td>)}
                          <td className="p-3 text-right tabular-nums font-medium">{prozent(m.quote)}</td>
                        </tr>
                        {auf && (
                          <tr className="border-b bg-secondary/30">
                            <td colSpan={SCHRITTE.length + 2} className="p-0">
                              {!ihre.length ? <p className="p-4 text-sm text-muted-foreground">Noch keine Leads von {m.domain} in diesem Zeitraum.</p> : (
                                <ul className="divide-y">
                                  {ihre.map(l => (
                                    <li key={l.id}>
                                      <button type="button" onClick={() => setOffenId(l.id)}
                                              className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-card">
                                        <span className="font-medium">{l.name}</span>
                                        {l.angaben?.prioritaet === 'heiss' && <Marke art="heiss">heiss</Marke>}
                                        <span className="text-muted-foreground">{l.adresse ?? '–'}</span>
                                        <span className="text-muted-foreground">{l.telefon}</span>
                                        <span className="ml-auto text-xs text-muted-foreground">{new Date(l.erstellt_am).toLocaleDateString('de-CH')}{l.bearbeitet ? ' · erledigt' : ''}</span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </Abschnitt>

      <LeadDetail lead={offen} onClose={() => setOffenId(null)} onErledigt={l => void erledigt(l)} onNotiz={notiz} />

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
