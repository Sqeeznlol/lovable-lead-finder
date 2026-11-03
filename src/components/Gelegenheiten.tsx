import { useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { ObjektLink } from '@/components/ObjektLink';
import { Auswahl } from '@/components/Auswahl';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Printer, Target } from 'lucide-react';
import { Abschnitt, FELD, KNOPF, KNOPF_HAUPT, Leer, LISTE, Marke, Reiter, Seite, Strichbalken } from '@/components/rahmen';
import { BILD } from '@/lib/luftbild';
import { supabase } from '@/integrations/supabase/client';
import { portfolioParzellen, usePortfolioListe } from '@/hooks/use-portfolio';
import { arrondierungErkennen } from '@/lib/arrondierung';
import { ANLAESSE, ZUSTAENDE, useGelegenheiten, type Gel, type Parz, type Zustand } from '@/hooks/use-gelegenheiten';
import { PortfolioBericht } from '@/components/PortfolioBericht';
import { useSchliessen, useUrlWert } from '@/hooks/use-url-wert';

/**
 * Gelegenheiten: was erkannt wurde, wer daran arbeitet, was daraus
 * wurde -- und der Bericht an den Kunden.
 *
 * Tims Text, Abschnitt 3 und 5: "Track which opportunities were
 * identified, communicated and converted" und "Results are tracked and
 * reported to the institutional client". Eine Gelegenheit hat dafür
 * einen Zustand (erkannt bis abgeschlossen), eine Zuständigkeit und ein
 * Ergebnis; der Bericht zählt sie je Kunde.
 */
// Die erzeugten Typen kennen die Plattform-Tabellen noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;
const datum = (s: string | null) => (s ? new Date(s).toLocaleDateString('de-CH') : '–');
const m2 = (n: number | null) => (n ? `${Math.round(n).toLocaleString('de-CH')} m²` : null);

export function Gelegenheiten() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useGelegenheiten();
  // Nur Name und Zahl; die Parzellen eines Portfolios erst bei "Nachbarn prüfen".
  const { data: portfolios } = usePortfolioListe(true);
  // Reiter, Kunde, aufgeklappte Gelegenheit und Bericht stehen in der
  // Adresse -- "Zurück" im Browser führt jeweils einen Schritt zurück.
  const [zustandWert, setZustandWert] = useUrlWert('reiter', 'offen');
  const zustand = zustandWert as Zustand | 'offen' | 'alle';
  const setZustand = (z: Zustand | 'offen' | 'alle') => setZustandWert(z);
  const [mandantWert, setMandantWert] = useUrlWert('kunde');
  // Anlass: seit dem 4. November erkennt das System auch Reserven in
  // Kundenportfolios (docs/potenzial-regeln.md); die will man für sich sehen.
  const [anlass, setAnlass] = useUrlWert('anlass');
  const mandant = mandantWert ?? '';
  const setMandant = (m: string) => setMandantWert(m || null);
  const [offen, setOffen] = useUrlWert('gelegenheit');
  const [lauf, setLauf] = useState<Record<string, string>>({});
  const [bericht, setBericht] = useUrlWert('bericht');
  const berichtZu = useSchliessen('bericht');

  // "ohne" zeigt die Gelegenheiten ohne Kunde ("Nachbar baut").
  const passtKunde = (g: { mandant?: { id: string } | null; anlass?: string }) =>
    (!mandant || (mandant === 'ohne' ? !g.mandant : g.mandant?.id === mandant)) && (!anlass || g.anlass === anlass);
  const anlaesse = useMemo(() => [...new Set((data ?? []).map(g => g.anlass))].sort(), [data]);
  const mandanten = useMemo(() => {
    const m = new Map<string, string>();
    (data ?? []).forEach(g => g.mandant && m.set(g.mandant.id, g.mandant.akteur?.name ?? 'Ohne Namen'));
    return [...m.entries()];
  }, [data]);

  const liste = (data ?? []).filter(g =>
    (zustand === 'alle' || (zustand === 'offen' ? !['abgeschlossen', 'verworfen'].includes(g.zustand) : g.zustand === zustand))
    && passtKunde(g));

  const { toast } = useToast();
  const aendern = async (g: Gel, felder: Partial<Gel>) => {
    const jetzt = new Date().toISOString();
    const z = felder.zustand;
    const r = await db().from('gelegenheit').update({
      ...felder,
      ...(z === 'gemeldet' && !g.gemeldet_am ? { gemeldet_am: jetzt } : {}),
      ...(z === 'abgeschlossen' || z === 'verworfen' ? { abgeschlossen_am: g.abgeschlossen_am ?? jetzt } : {}),
    }).eq('id', g.id);
    // Ein Fehler wurde bisher still verschluckt: der Zustand sprang
    // zurück, und niemand wusste, warum.
    if (r.error) toast({ title: 'Nicht gespeichert', description: r.error.message, variant: 'destructive' });
    else await qc.invalidateQueries({ queryKey: ['gelegenheiten'] });
    return !r.error;
  };

  const pruefen = async (pfId: string) => {
    setLauf(l => ({ ...l, [pfId]: 'Parzellen werden geladen …' }));
    try {
      const pos = await portfolioParzellen(pfId);
      setLauf(l => ({ ...l, [pfId]: `0 von ${pos.length} …` }));
      const e = await arrondierungErkennen(pfId, pos, (f, n) => setLauf(l => ({ ...l, [pfId]: `${f} von ${n} …` })));
      setLauf(l => ({ ...l, [pfId]: `${e.neu} neu, ${e.schon} schon erfasst`
        + (e.ohneNachbarn ? `, ${e.ohneNachbarn} ohne Nachbarn` : '') + (e.fehler ? `, ${e.fehler} Fehler` : '') }));
      await qc.invalidateQueries({ queryKey: ['gelegenheiten'] });
    } catch {
      setLauf(l => ({ ...l, [pfId]: 'Nicht möglich -- angemeldet?' }));
    }
  };

  if (bericht) return <PortfolioBericht mandantId={bericht} onZurueck={berichtZu} />;

  const zahl = (z: Zustand) => (data ?? []).filter(g => g.zustand === z && passtKunde(g)).length;

  const offenAlle = (data ?? []).filter(g => !['abgeschlossen', 'verworfen'].includes(g.zustand) && passtKunde(g)).length;
  const maxPrio = Math.max(1, ...liste.map(g => Number(g.prioritaet) || 0));
  const ZFARBE: Record<string, 'rosa' | 'lila' | 'violett' | 'minze' | 'grau' | 'heiss'> = {
    erkannt: 'heiss', geprueft: 'lila', gemeldet: 'violett', 'in bearbeitung': 'lila', abgeschlossen: 'minze', verworfen: 'grau',
  };
  const feld = `${FELD} w-full`;

  return (
    <Seite bild={BILD.gelegenheiten} ueber="Gelegenheiten · erkannt, gemeldet, erreicht"
      titel={data ? `${offenAlle} ${offenAlle === 1 ? 'Gelegenheit ist' : 'Gelegenheiten sind'} offen` : ' '}
      unter="Was das System erkannt hat, wer daran arbeitet und was daraus wurde."
      kennzahlen={data ? ([['erkannt', 'rosa', 'ungeprüft'], ['gemeldet', 'violett', 'beim Kunden'], ['in bearbeitung', 'lila', 'läuft'], ['abgeschlossen', 'minze', 'erreicht']] as [Zustand, 'rosa' | 'violett' | 'lila' | 'minze', string][])
        .map(([z, art, wort]) => ({ titel: ZUSTAENDE.find(x => x[0] === z)![1], wert: String(zahl(z)), marke: <Marke art={art}>{wort}</Marke>, onClick: () => setZustand(z) })) : undefined}
      aktionen={mandant && mandant !== 'ohne' ? <button type="button" onClick={() => setBericht(mandant)} className={KNOPF_HAUPT}><Printer className="h-4 w-4" /> Portfolio-Bericht</button> : undefined}
      seite={
        <Abschnitt titel="Arrondierung" unter="Nachbarn je Portfolio beim Bund prüfen" symbol={Target} kachel="akzent"
                   hinweis="Darf beliebig oft laufen; Doppeltes wird nicht angelegt.">
          {!portfolios?.length ? <Leer titel="Kein Portfolio erfasst." /> : (
            <ul className={LISTE}>
              {portfolios.map(pf => (
                <li key={pf.id} className="space-y-2 px-4 py-3">
                  <span className="block min-w-0">
                    <span className="block truncate font-medium">{pf.name}</span>
                    <span className="block text-sm text-muted-foreground">{pf.parzellen} Parzellen{lauf[pf.id] ? ` · ${lauf[pf.id]}` : ''}</span>
                  </span>
                  <button type="button" onClick={() => void pruefen(pf.id)} disabled={!!lauf[pf.id]?.endsWith('…')} className={`${KNOPF} w-full`}>
                    Nachbarn prüfen
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Abschnitt>
      }>
      <div className="flex flex-wrap items-center gap-2">
        <Reiter<string> wahl={zustand} setWahl={w => setZustand(w as typeof zustand)}
          optionen={([['offen', 'Offen'], ...ZUSTAENDE, ['alle', 'Alle']] as [string, string][])
            .map(([w, t]) => ({ wert: w, titel: t, zahl: w === 'offen' ? offenAlle : w === 'alle' ? undefined : zahl(w as Zustand) }))} />
        <Auswahl label="Kunde" wert={mandant} setWert={setMandant} className="min-w-[220px]" optionen={[
          { wert: '', titel: 'Alle Kunden' }, { wert: 'ohne', titel: 'Ohne Kunde (Nachbar baut)' },
          ...mandanten.map(([id, n]) => ({ wert: id, titel: n })),
        ]} />
        {anlaesse.length > 1 && (
          <Auswahl label="Anlass" wert={anlass ?? ''} setWert={w => setAnlass(w || null)} className="min-w-[200px]" optionen={[
            { wert: '', titel: 'Alle Anlässe' }, ...anlaesse.map(a => ({ wert: a, titel: ANLAESSE[a] ?? a })),
          ]} />
        )}
      </div>

      {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> wird geladen …</p>}
      {error && <p className="text-sm text-destructive">Gelegenheiten nicht lesbar.</p>}
      {data && liste.length === 0 && <Leer titel="Keine Gelegenheit in dieser Auswahl." />}

      {liste.length > 0 && (
        <ul className={LISTE}>
          {liste.map(g => {
            const auf = offen === g.id;
            // 'im portfolio' (Baugesuch im Portfolio, Reserve) zeigte die
            // Parzelle des Kunden bisher nicht -- nur 'ausloeser' zählte.
            const ausl = (g.gelegenheit_parzelle ?? []).filter(x => x.rolle === 'ausloeser' || x.rolle === 'im portfolio').map(x => x.parzelle).filter(Boolean) as Parz[];
            const nachb = (g.gelegenheit_parzelle ?? []).filter(x => x.rolle === 'nachbar').map(x => x.parzelle).filter(Boolean) as Parz[];
            return (
              <li key={g.id}>
                <button type="button" onClick={() => setOffen(auf ? null : g.id)} aria-expanded={auf}
                        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5 text-left hover:bg-secondary/50 sm:grid-cols-[minmax(0,1fr)_minmax(120px,30%)_auto]">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{g.titel}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {[ANLAESSE[g.anlass] ?? g.anlass, g.mandant?.akteur?.name, g.begruendung].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="hidden sm:block">
                    {g.prioritaet != null && <Strichbalken titel="Priorität" anteil={(Number(g.prioritaet) || 0) / maxPrio} farbe={g.zustand === 'erkannt' ? 'heiss' : 'akzent'} />}
                  </span>
                  <Marke art={ZFARBE[g.zustand] ?? 'grau'}>{ZUSTAENDE.find(x => x[0] === g.zustand)?.[1]}</Marke>
                </button>
                {auf && (
                  <div className="space-y-4 border-t bg-secondary/30 px-4 py-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block space-y-1.5"><span className="text-[11px] uppercase tracking-wide text-muted-foreground">Zustand</span>
                        <Auswahl label="Zustand" wert={g.zustand} setWert={w => void aendern(g, { zustand: w as Zustand })} className="w-full"
                                 optionen={ZUSTAENDE.map(([w, t]) => ({ wert: w, titel: t }))} />
                      </label>
                      <label className="block space-y-1.5"><span className="text-[11px] uppercase tracking-wide text-muted-foreground">Zuständig</span>
                        <input defaultValue={g.zustaendig ?? ''} placeholder="Name"
                               onBlur={e => e.target.value !== (g.zustaendig ?? '') && void aendern(g, { zustaendig: e.target.value || null })} className={feld} />
                      </label>
                    </div>
                    <label className="block space-y-1.5"><span className="text-[11px] uppercase tracking-wide text-muted-foreground">Ergebnis</span>
                      <input defaultValue={g.ergebnis ?? ''} placeholder="z. B. Nachbar verkauft an Kunden, Vorvertrag"
                             onBlur={e => e.target.value !== (g.ergebnis ?? '') && void aendern(g, { ergebnis: e.target.value || null })} className={feld} />
                    </label>
                    <p className="text-xs text-muted-foreground">Erkannt {datum(g.erkannt_am)} · gemeldet {datum(g.gemeldet_am)} · abgeschlossen {datum(g.abgeschlossen_am)}</p>
                    {ausl.length > 0 && (
                      <div className="text-sm"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Parzelle des Kunden</p>
                        {ausl.map(p => <p key={p.id}><ObjektLink id={p.id} className="min-h-11 font-medium">{p.address ?? p.egrid}{p.gemeinde ? ` · ${p.gemeinde}` : ''}</ObjektLink></p>)}</div>
                    )}
                    {nachb.length > 0 && (
                      <div className="space-y-1.5 text-sm"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Nachbarn im Bestand</p>
                        <ul className={LISTE}>
                          {nachb.map(p => (
                            <li key={p.id} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">
                              <ObjektLink id={p.id} className="truncate">{p.address ?? p.egrid}</ObjektLink>
                              <span className="shrink-0 text-xs text-muted-foreground">{[p.owner_name ?? 'Eigentümer offen', m2(p.area)].filter(Boolean).join(' · ')}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {!!g.fremde_nachbarn?.length && (
                      <p className="text-xs text-muted-foreground">Ausserhalb des Bestands: {g.fremde_nachbarn.map(n => n.nummer || n.egrid).join(', ')}</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Seite>
  );
}
