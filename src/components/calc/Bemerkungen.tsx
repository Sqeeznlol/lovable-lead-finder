import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Send } from 'lucide-react';
import { FELD, KNOPF_HAUPT } from '@/components/rahmen';
import { useName } from '@/components/calc/name';
import { useAuth } from '@/hooks/use-auth';
import { lernen, LERNEN_AB, vorschlag, type Urteil } from '@/lib/angebot';
import { alleRueckmeldungen, bemerkungenLaden, bemerkungLoeschen, bemerkungSchreiben, betrag, kalkulationenLaden, type Bemerkung } from '@/lib/calc-ablauf';
import { betragLesen } from '@/lib/gespraech';

/**
 * Das Gespräch zum Preis, unter jeder Kalkulation (Julian, 20. November,
 * Schöneggstrasse 18: CALC empfiehlt 1.41 Mio., geboten sind 4.1 Mio.):
 * «ist richtig so, nicht richtig so ... wie so ein Chatfenster ... 4,1
 * Millionen weil das und das, dass auch Aurora lernt, warum, weshalb».
 * Ein Tipp sagt, wie der Preis steht, ein Feld den richtigen Preis, eines
 * den Grund. Aus allen Urteilen mit Preis rechnet der Vorschlag neben der
 * Empfehlung; Julians Formel bleibt, wie sie ist.
 */
const WAHL: [Urteil, string][] = [['passt', 'Richtig so'], ['zu_tief', 'Zu tief'], ['zu_hoch', 'Zu hoch']];
const URTEIL_KURZ: Record<Urteil, string> = { passt: 'Richtig so', zu_tief: 'Empfehlung zu tief', zu_hoch: 'Empfehlung zu hoch' };
const wann = (iso: string) => new Date(iso).toLocaleString('de-CH', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const prozent = (preis: number, empfehlung: number) => {
  const p = Math.round((preis / empfehlung - 1) * 100);
  return p === 0 ? 'gleich wie die Empfehlung' : `${p > 0 ? '+' : '\u2212'}${Math.abs(p)}\u00a0% zur Empfehlung`;
};

export function Bemerkungen({ kalkulationId, empfehlung, kanton, gemeinde }: { kalkulationId: string; empfehlung: number | null; kanton: string | null; gemeinde?: string | null }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [name, setName] = useName();
  const [urteil, setUrteil] = useState<Urteil | null>(null);
  const [preis, setPreis] = useState('');
  const [text, setText] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const ende = useRef<HTMLLIElement>(null);

  const hier = useQuery({ queryKey: ['bemerkungen', kalkulationId], queryFn: () => bemerkungenLaden(kalkulationId), retry: 0 });
  const alle = useQuery({ queryKey: ['bemerkungen-alle'], queryFn: () => bemerkungenLaden(), staleTime: 60 * 1000, retry: 0 });
  const kalk = useQuery({ queryKey: ['kalkulationen'], queryFn: kalkulationenLaden, staleTime: 60 * 1000 });
  const g = useMemo(() => lernen(alleRueckmeldungen(kalk.data ?? [], alle.data ?? [], kalkulationId), kanton, gemeinde), [kalk.data, alle.data, kalkulationId, kanton, gemeinde]);
  const lernPreis = vorschlag(empfehlung, g);

  const zahl = betragLesen(preis);
  const richtung = urteil && urteil !== 'passt' && zahl && empfehlung
    ? (urteil === 'zu_tief' ? zahl > empfehlung : zahl < empfehlung) : true;
  const bereit = !!name.trim() && text.trim().length >= 3 && (urteil !== 'passt' ? !preis.trim() || (!!zahl && richtung) : true) && !laeuft;

  useEffect(() => { ende.current?.scrollIntoView({ block: 'nearest' }); }, [hier.data?.length]);

  const senden = async () => {
    setLaeuft(true); setFehler(null);
    try {
      await bemerkungSchreiben({ kalkulation_id: kalkulationId, name: name.trim(), urteil, preis_chf: urteil === 'passt' ? null : zahl, text: text.trim() });
      setText(''); setPreis(''); setUrteil(null);
      await Promise.all([qc.invalidateQueries({ queryKey: ['bemerkungen', kalkulationId] }), qc.invalidateQueries({ queryKey: ['bemerkungen-alle'] })]);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Nicht gespeichert. Bitte noch einmal.');
    } finally { setLaeuft(false); }
  };

  const loeschen = async (b: Bemerkung) => {
    if (!window.confirm('Diese Bemerkung zurücknehmen?')) return;
    try {
      await bemerkungLoeschen(b.id);
      await Promise.all([qc.invalidateQueries({ queryKey: ['bemerkungen', kalkulationId] }), qc.invalidateQueries({ queryKey: ['bemerkungen-alle'] })]);
    } catch { setFehler('Nicht zurückgenommen. Bitte noch einmal.'); }
  };

  return (
    <section className="space-y-4 rounded-[3px] border bg-card p-4 sm:p-5 print:hidden" aria-label="Bemerkungen zum Preis">
      <div className="space-y-1">
        <h3 className="text-lg">Stimmt der Preis?</h3>
        <p className="text-sm text-muted-foreground">
          {empfehlung ? <>CALC empfiehlt <span className="font-medium text-foreground">{betrag(empfehlung)}</span>. </> : null}
          Richtig so, zu tief oder zu hoch, warum und wo im Ort: aus jeder Begründung lernt Aurora.
        </p>
        {g && (lernPreis != null
          ? <p className="text-sm">Aus {g.n} Rückmeldungen{g.gemeinde ? ` in ${g.gemeinde}` : g.kanton ? ` im Kanton ${g.kanton}` : ''} lag der richtige Preis im Mittel bei {Math.round(g.faktor * 100)}{'\u00a0'}% der Empfehlung, hier also <span className="font-medium">{betrag(lernPreis)}</span>.</p>
          : <p className="text-sm text-muted-foreground">Erst {g.n} {g.n === 1 ? 'Rückmeldung' : 'Rückmeldungen'} mit Preis; ab {LERNEN_AB} steht hier ein Vorschlag.</p>)}
      </div>

      {hier.isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> wird geladen …</p>}
      {hier.error && <p className="text-sm text-destructive">Bemerkungen nicht lesbar. Ist die Migration eingespielt?</p>}
      {(hier.data?.length ?? 0) > 0 && (
        <ol className="max-h-[420px] space-y-3 overflow-y-auto">
          {hier.data!.map(b => {
            const meine = !!user && b.user_id === user.id;
            return (
              <li key={b.id} className={`flex ${meine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-[14px] px-4 py-2.5 ${meine ? 'bg-foreground text-background' : 'bg-secondary'}`}>
                  <p className={`text-xs ${meine ? 'opacity-70' : 'text-muted-foreground'}`}>{b.name} · {wann(b.erstellt_am)}</p>
                  {b.urteil && (
                    <p className="text-[15px] font-medium">
                      {URTEIL_KURZ[b.urteil]}{b.preis_chf && b.urteil !== 'passt' ? `: ${betrag(b.preis_chf)}` : ''}
                      {b.preis_chf && b.empfehlung_chf && b.urteil !== 'passt' ? <span className="font-normal opacity-70"> ({prozent(b.preis_chf, b.empfehlung_chf)})</span> : null}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{b.text}</p>
                  {meine && <button type="button" className="mt-1 text-xs underline underline-offset-2 opacity-70" onClick={() => void loeschen(b)}>zurücknehmen</button>}
                </div>
              </li>
            );
          })}
          <li ref={ende} aria-hidden="true" />
        </ol>
      )}

      <div className="space-y-3 border-t pt-4">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Wie steht der Preis?">
          {WAHL.map(([w, t]) => (
            <button key={w} type="button" role="radio" aria-checked={urteil === w}
                    className={`min-h-11 rounded-[3px] border px-4 text-sm transition-colors ${urteil === w ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-secondary'}`}
                    onClick={() => setUrteil(urteil === w ? null : w)}>{t}</button>
          ))}
        </div>
        {urteil && urteil !== 'passt' && (
          <label className="block space-y-1.5 sm:max-w-xs">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Richtiger Preis</span>
            <input value={preis} onChange={e => setPreis(e.target.value)} inputMode="decimal" placeholder="z. B. 4,1 Mio." className={`${FELD} w-full text-base`} />
            {zahl && empfehlung && <span className={`block text-sm ${richtung ? 'text-muted-foreground' : 'text-destructive'}`}>
              {betrag(zahl)}, {prozent(zahl, empfehlung)}{richtung ? '' : `: das ist nicht ${urteil === 'zu_tief' ? 'höher' : 'tiefer'}`}
            </span>}
          </label>
        )}
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
                  placeholder={urteil === 'zu_tief' ? 'Warum? z. B. Die Fläche ist mehr wert als die Miete: Neubau mit fünf Geschossen möglich'
                    : urteil === 'zu_hoch' ? 'Warum? z. B. Altlasten, Lärm, Baurecht' : 'Bemerkung oder Grund'}
                  className="w-full rounded-[3px] border border-input bg-card px-3.5 py-2.5 text-base leading-relaxed focus:border-foreground focus:outline-none" />
        <div className="flex flex-wrap items-center gap-2">
          {!name.trim() && <input value={name} onChange={e => setName(e.target.value)} placeholder="Dein Name" autoComplete="given-name" className={`${FELD} w-40 text-base`} />}
          <button type="button" className={KNOPF_HAUPT} disabled={!bereit} onClick={() => void senden()}>
            {laeuft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Senden
          </button>
          {name.trim() && <span className="text-sm text-muted-foreground">als {name.trim()}</span>}
        </div>
        {fehler && <p className="text-sm text-destructive">{fehler}</p>}
      </div>
    </section>
  );
}
