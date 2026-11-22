import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Abschnitt, FELD, KNOPF, KNOPF_HAUPT, LISTE } from '@/components/rahmen';
import { FENSTER } from '@/lib/fenster';
import { KAMPAGNEN, MONATSGRENZE, monat, zusammen, type WerbungTag } from '@/lib/werbung';

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
  // Ganzer Monat für die Grenze, unabhängig vom gewählten Zeitraum.
  const monatsAnfang = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' }).slice(0, 8) + '01';
  const m = useQuery({
    queryKey: ['werbung-tage', monatsAnfang],
    queryFn: async (): Promise<WerbungTag[]> => (await db.rpc('werbung_tage', { von: monatsAnfang })).data ?? [],
  });
  const begriffe = useQuery({
    queryKey: ['werbung-begriffe', von], retry: 0,
    queryFn: async (): Promise<{ kampagne: string; begriff: string; leads: number; schlechte: number }[]> => (await db.rpc('werbung_begriffe', { von })).data ?? [],
  });
  const [kampagne, setKampagne] = useState(KAMPAGNEN[0].id);
  const [tag, setTag] = useState(new Date(Date.now() - 864e5).toISOString().slice(0, 10));
  const [kosten, setKosten] = useState('');
  const [klicks, setKlicks] = useState('');
  const [meldung, setMeldung] = useState<string | null>(null);
  const [eintragAuf, setEintragAuf] = useState(false);

  if (q.data === null) return null;
  const z = zusammen(q.data ?? []);
  const alleBesuche = z.reduce((a, x) => a + x.besuche, 0);
  const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
  const mo = monat(m.data ?? [], heute);

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
               unter={`Je Kampagne, letzte ${tage} Tage`}
               hinweis={`Besuche aus Anzeigen, Leads ohne Testdaten. «je Lead» zählt nur gute Leads (in der Lead-Ansicht markiert; ohne Urteil gilt er als gut). Was tun: Regeln des Werbeplans, unter CHF 150 je Lead verdoppeln, über CHF 400 stoppen.`}>
      {mo && (
        <p className={`text-sm ${mo.ueber ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
          Diesen Monat CHF {ch(mo.bisher)} an {mo.tage} {mo.tage === 1 ? 'Tag' : 'Tagen'} eingetragen, hochgerechnet CHF {ch(mo.hochgerechnet)} von höchstens CHF {MONATSGRENZE}.
          {mo.ueber ? ' Über der Grenze: Tagesbudgets in Google Ads senken.' : ''}
        </p>
      )}
      {/* Auf dem Handy eine Zeile je Kampagne statt einer Tabelle zum Wischen:
          was zählt, ist Leads, Preis je Lead und was zu tun ist. */}
      <ul className={`${LISTE} sm:hidden`}>
        {z.map(s => {
          const k = KAMPAGNEN.find(x => x.id === s.kampagne)!;
          return (
            <li key={s.kampagne} className="flex items-start justify-between gap-4 px-4 py-3">
              <span className="min-w-0">
                <span className="block font-medium">{k.titel}</span>
                <span className="block text-sm text-muted-foreground">{s.rat}</span>
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="block font-medium">{ch(s.leads)} {s.leads === 1 ? 'Lead' : 'Leads'}</span>
                <span className="block text-sm text-muted-foreground">{s.jeLead == null ? `${ch(s.besuche)} Besuche` : `CHF ${ch(s.jeLead)} je Lead`}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="hidden overflow-x-auto rounded border bg-card sm:block">
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
                  <td className="px-3 py-2 tabular-nums font-medium">{ch(s.leads)}{s.gute < s.leads ? <span className="block text-xs font-normal text-muted-foreground">{ch(s.leads - s.gute)} nicht gut</span> : null}</td>
                  <td className="px-3 py-2 tabular-nums">{s.kosten == null ? '–' : `CHF ${s.kosten.toFixed(2)}`}</td>
                  <td className="px-3 py-2 tabular-nums">{s.jeLead == null ? '–' : `CHF ${ch(s.jeLead)}`}</td>
                  <td className="px-3 py-2">{s.rat}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {(begriffe.data?.length ?? 0) > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium">Suchbegriffe mit Leads</p>
          <ul className="divide-y rounded border bg-card text-sm">
            {begriffe.data!.slice(0, 15).map(b => (
              <li key={`${b.kampagne}:${b.begriff}`} className="flex items-center justify-between gap-4 px-3 py-2">
                <span>«{b.begriff}» <span className="text-muted-foreground">· {KAMPAGNEN.find(k => k.id === b.kampagne)?.titel ?? b.kampagne}</span></span>
                <span className="tabular-nums">{ch(Number(b.leads))}{Number(b.schlechte) ? <span className="text-muted-foreground"> ({ch(Number(b.schlechte))} nicht gut)</span> : null}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {!eintragAuf ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={KNOPF} onClick={() => setEintragAuf(true)}>Kosten eintragen</button>
          <button type="button" className={KNOPF} onClick={() => KAMPAGNEN.slice(0, 5).forEach(k => window.open(`https://www.${k.domain}/`, FENSTER.extern))}>Seiten öffnen</button>
          {meldung && <span className="self-center text-sm text-muted-foreground">{meldung}</span>}
        </div>
      ) : (
      <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); void eintragen(); }}>
        <label className="space-y-1 text-xs text-muted-foreground">Tag<input type="date" value={tag} onChange={e => setTag(e.target.value)} className={`${FELD} block text-base`} /></label>
        <label className="space-y-1 text-xs text-muted-foreground">Kampagne
          <select value={kampagne} onChange={e => setKampagne(e.target.value)} className={`${FELD} block text-base`}>
            {KAMPAGNEN.map(k => <option key={k.id} value={k.id}>{k.titel}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">Kosten CHF<input inputMode="decimal" value={kosten} onChange={e => setKosten(e.target.value)} className={`${FELD} block w-28 text-base`} /></label>
        <label className="space-y-1 text-xs text-muted-foreground">Klicks<input inputMode="numeric" value={klicks} onChange={e => setKlicks(e.target.value)} className={`${FELD} block w-24 text-base`} /></label>
        <button type="submit" className={KNOPF_HAUPT} disabled={!kosten}>Speichern</button>
        <button type="button" className={KNOPF} onClick={() => setEintragAuf(false)}>Fertig</button>
        {meldung && <span className="text-sm text-muted-foreground">{meldung}</span>}
      </form>
      )}
    </Abschnitt>
  );
}
