import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Abschnitt, FELD, KNOPF } from '@/components/rahmen';
import { FENSTER } from '@/lib/fenster';
import { KAMPAGNEN, zusammen, type WerbungTag } from '@/lib/werbung';

/**
 * Google Ads je Kampagne (Julian, 21. November: «einen Tracker, der
 * permanent analysiert, jeden Tag»). Besuche und Leads zählt die Seite;
 * die Kosten trägt jemand aus dem Konto ein (Montag, laut Werbeplan). Die
 * Spalte «Was tun» folgt den Regeln des Werbeplans. Jede Seite öffnet sich
 * in einem eigenen Tab (Julian: «in jedem Tab die Webseiten ... wo
 * Kampagnen laufen»).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const ch = (n: number) => n.toLocaleString('de-CH', { maximumFractionDigits: 0 });

export function WerbungTafel({ tage }: { tage: number }) {
  const qc = useQueryClient();
  const von = new Date(Date.now() - tage * 864e5).toISOString().slice(0, 10);
  const q = useQuery({
    queryKey: ['werbung-tage', von],
    queryFn: async (): Promise<WerbungTag[] | null> => {
      const { data, error } = await db.rpc('werbung_tage', { von });
      if (error) return null;
      return data ?? [];
    },
  });
  const [kampagne, setKampagne] = useState(KAMPAGNEN[0].id);
  const [tag, setTag] = useState(new Date(Date.now() - 864e5).toISOString().slice(0, 10));
  const [kosten, setKosten] = useState('');
  const [klicks, setKlicks] = useState('');
  const [meldung, setMeldung] = useState<string | null>(null);

  if (q.data === null) return null;
  const z = zusammen(q.data ?? []);
  const alleBesuche = z.reduce((a, x) => a + x.besuche, 0);

  const eintragen = async () => {
    const chf = Number(kosten.replace(',', '.'));
    if (!Number.isFinite(chf) || chf < 0) { setMeldung('Kosten als Zahl, z. B. 4.20'); return; }
    const { error } = await db.from('werbung_kosten').upsert({ tag, kampagne, kosten_chf: chf, klicks: klicks ? Number(klicks) : null });
    if (error) { setMeldung('Nicht gespeichert.'); return; }
    setKosten(''); setKlicks(''); setMeldung('Gespeichert.');
    await qc.invalidateQueries({ queryKey: ['werbung-tage'] });
  };

  return (
    <Abschnitt titel="Google Ads" zahl={alleBesuche ? `${ch(alleBesuche)} Besuche` : undefined}
               hinweis={`Letzte ${tage} Tage. Besuche aus Anzeigen (utm_source=google), Leads ohne Testdaten. Was tun: Regeln des Werbeplans, Kosten je Lead unter CHF 150 verdoppeln, über CHF 400 stoppen.`}>
      <div className="overflow-x-auto rounded border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>{['Kampagne', 'Besuche', 'Ergebnis', 'Kontakt', 'Leads', 'Kosten', 'je Lead', 'Was tun'].map(t => <th key={t} className="px-3 py-2 font-medium">{t}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {z.map(s => {
              const k = KAMPAGNEN.find(x => x.id === s.kampagne)!;
              return (
                <tr key={s.kampagne}>
                  <td className="px-3 py-2">
                    <span className="block font-medium">{k.titel}</span>
                    <a href={`https://www.${k.domain}/`} target={FENSTER.extern} className="text-xs underline underline-offset-2">{k.domain}</a>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{ch(s.besuche)}</td>
                  <td className="px-3 py-2 tabular-nums">{ch(s.ergebnisse)}</td>
                  <td className="px-3 py-2 tabular-nums">{ch(s.kontakte)}</td>
                  <td className="px-3 py-2 tabular-nums font-medium">{ch(s.leads)}</td>
                  <td className="px-3 py-2 tabular-nums">{s.kosten == null ? '–' : `CHF ${s.kosten.toFixed(2)}`}</td>
                  <td className="px-3 py-2 tabular-nums">{s.jeLead == null ? '–' : `CHF ${ch(s.jeLead)}`}</td>
                  <td className="px-3 py-2">{s.rat}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); void eintragen(); }}>
        <label className="space-y-1 text-xs text-muted-foreground">Tag<input type="date" value={tag} onChange={e => setTag(e.target.value)} className={`${FELD} block text-base`} /></label>
        <label className="space-y-1 text-xs text-muted-foreground">Kampagne
          <select value={kampagne} onChange={e => setKampagne(e.target.value)} className={`${FELD} block text-base`}>
            {KAMPAGNEN.map(k => <option key={k.id} value={k.id}>{k.titel}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">Kosten CHF<input inputMode="decimal" value={kosten} onChange={e => setKosten(e.target.value)} className={`${FELD} block w-28 text-base`} /></label>
        <label className="space-y-1 text-xs text-muted-foreground">Klicks<input inputMode="numeric" value={klicks} onChange={e => setKlicks(e.target.value)} className={`${FELD} block w-24 text-base`} /></label>
        <button type="submit" className={KNOPF} disabled={!kosten}>Kosten eintragen</button>
        <button type="button" className={KNOPF} onClick={() => KAMPAGNEN.slice(0, 5).forEach(k => window.open(`https://www.${k.domain}/`, FENSTER.extern))}>Seiten der Woche 1 öffnen</button>
        {meldung && <span className="text-sm text-muted-foreground">{meldung}</span>}
      </form>
    </Abschnitt>
  );
}
