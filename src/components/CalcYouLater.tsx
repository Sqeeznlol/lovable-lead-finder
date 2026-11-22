import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calculator, Loader2 } from 'lucide-react';
import { Abschnitt, KNOPF, Leer, LISTE, Marke, Reiter, Seite, Strichbalken } from '@/components/rahmen';
import { Rechnung } from '@/components/calc/Rechnung';
import { Ablauf } from '@/components/calc/Ablauf';
import { useJetzt } from '@/components/calc/name';
import { useUrlSetzen, useUrlWert } from '@/hooks/use-url-wert';
import { BILD } from '@/lib/luftbild';
import { AblaufPersonen } from '@/components/calc/AblaufPersonen';
import { betrag, kalkulationenLaden, kalkulationLaden, SCHRITT_TEXT, uhr, UNTERWEGS, ZUSTAND_TEXT, type Kalkulation, type KalkulationKurz, type Zustand } from '@/lib/calc-ablauf';

/**
 * CALC YOU LATER: vom Lead zum Angebot in einem Tag.
 *
 * Die Idee, am 16. November an Julian weitergegeben: Lele gibt einen
 * Lead ein, und es kommt alles heraus (Landwert, Hauptnutzfläche,
 * Kubatur, Baukosten, Erlös, Gewinn, Chancen, Risiken). Dann ein Ablauf,
 * der nicht länger als einen Tag dauern darf (seit 19. November): David
 * prüft den Preis und wählt Firma und Vorlage (die Schrift gehört zur Firma), Tim visiert,
 * Julian kontrolliert, Tim bestätigt, David verschickt das Kaufangebot.
 *
 * Oben wird gerechnet, darunter steht, was unterwegs ist. Die offene
 * Kalkulation steht in der Adresse (?calc=...): so lässt sie sich
 * weitergeben, und «Zurück» schliesst sie.
 */
type Wahl = 'offen' | 'entwurf' | 'gesendet' | 'abgelehnt';
const IN_WAHL: Record<Wahl, Zustand[]> = { offen: UNTERWEGS, entwurf: ['entwurf'], gesendet: ['gesendet'], abgelehnt: ['abgelehnt'] };

export function CalcYouLater() {
  const [offenId] = useUrlWert('calc');
  const [neu] = useUrlWert('neu');
  const [anfrage] = useUrlWert('anfrage');
  const setzen = useUrlSetzen();
  const qc = useQueryClient();
  const jetzt = useJetzt();
  // Das Cockpit führt mit ?liste= direkt in die passende Liste (Der Weg).
  const [wahl, setWahl] = useState<Wahl>(() => {
    const l = new URLSearchParams(window.location.search).get('liste');
    return l === 'entwuerfe' ? 'entwurf' : l === 'gesendet' ? 'gesendet' : 'offen';
  });
  const [mitTest, setMitTest] = useState(false);

  // Jede Minute neu: wer prüfen oder freigeben soll, sieht ohne Neuladen, was hereinkommt.
  const liste = useQuery({ queryKey: ['kalkulationen'], queryFn: kalkulationenLaden, refetchInterval: 60_000 });
  const offen = useQuery({ queryKey: ['kalkulation', offenId], queryFn: () => kalkulationLaden(offenId!), enabled: !!offenId });

  const uebernehmen = (k: Kalkulation) => {
    qc.setQueryData(['kalkulation', k.id], k);
    void qc.invalidateQueries({ queryKey: ['kalkulationen'] });
  };
  const zurListe = () => { setzen({ calc: null, neu: null, anfrage: null }); void qc.invalidateQueries({ queryKey: ['kalkulationen'] }); };

  const tests = (liste.data ?? []).filter(k => k.test).length;
  const alle = (liste.data ?? []).filter(k => mitTest || !k.test);
  const zahl = (z: Zustand) => alle.filter(k => k.zustand === z).length;
  const unterwegs = alle.filter(k => UNTERWEGS.includes(k.zustand));
  const ueberfaellig = unterwegs.filter(k => uhr(k, jetzt)?.ueberfaellig).length;
  const gezeigt = alle.filter(k => IN_WAHL[wahl].includes(k.zustand));
  const zeigen = (w: Wahl) => { setWahl(w); document.getElementById('calc-liste')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  const titel = offenId ? (offen.data ? ZUSTAND_TEXT[offen.data.zustand] : ' ') : unterwegs.length
    ? `${unterwegs.length} ${unterwegs.length === 1 ? 'Kalkulation' : 'Kalkulationen'} unterwegs`
    : 'Vom Lead zum Angebot in einem Tag';

  return (
    <Seite bild={BILD.calc} ueber="CALC YOU LATER" titel={titel}
      unter={!offenId ? <>Adresse eingeben, Kaufpreis erhalten.</> : undefined}
      kennzahlen={offenId ? undefined : [
        { titel: 'Preis · Tim', wert: String(zahl('pruefung')), marke: ueberfaellig ? <Marke art="heiss">{ueberfaellig} überfällig</Marke> : undefined, onClick: () => zeigen('offen') },
        { titel: 'Versand · Tim', wert: String(zahl('angebot')), onClick: () => zeigen('offen') },
        { titel: 'Entwürfe', wert: String(zahl('entwurf')), onClick: () => zeigen('entwurf') },
        { titel: 'Gesendet', wert: String(zahl('gesendet')), onClick: () => zeigen('gesendet') },
      ]}>
      <div className="space-y-4 rounded border bg-card p-4 sm:p-6">
        {offenId ? (
          <>
            <button type="button" className={`${KNOPF} print:hidden`} onClick={zurListe}>‹ Zurück zur Liste</button>
            {offen.isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Kalkulation wird geladen …</p>}
            {offen.error && <p className="text-sm text-destructive">Die Kalkulation liess sich nicht laden. Bitte später noch einmal.</p>}
            {!offen.isLoading && !offen.error && !offen.data && <Leer titel="Diese Kalkulation gibt es nicht mehr." />}
            {offen.data && (offen.data.zustand === 'entwurf'
              ? <Rechnung key={offen.data.id} entwurf={offen.data} onGespeichert={uebernehmen} onVerworfen={zurListe} />
              : <Ablauf k={offen.data} onGeaendert={uebernehmen} />)}
          </>
        ) : (
          <Rechnung key={`${neu ?? ''}|${anfrage ?? ''}`} start={neu} anfrageId={anfrage}
            onGespeichert={k => { uebernehmen(k); setzen({ calc: k.id, neu: null, anfrage: null }); }} />
        )}
      </div>

      {/* Eine offene Kalkulation steht allein (22. November, Julian: «die
          komplette Seite so unübersichtlich»): Liste und Rollen erst zurück. */}
      {!offenId && <>
      <div id="calc-liste" className="scroll-mt-24 print:hidden">
        <Abschnitt titel="Kalkulationen" symbol={Calculator} kachel="schwarz" unter="In einem Tag zum Versand"
          rechts={tests > 0 ? <button type="button" className={KNOPF} onClick={() => setMitTest(!mitTest)}>{mitTest ? 'Testdaten ausblenden' : `Testdaten zeigen (${tests})`}</button> : undefined}>
          <Reiter<Wahl> wahl={wahl} setWahl={setWahl} optionen={[
            { wert: 'offen', titel: 'Unterwegs', zahl: unterwegs.length },
            { wert: 'entwurf', titel: 'Entwürfe', zahl: zahl('entwurf') },
            { wert: 'gesendet', titel: 'Gesendet', zahl: zahl('gesendet') },
            { wert: 'abgelehnt', titel: 'Abgelehnt', zahl: zahl('abgelehnt') },
          ]} />
          {liste.isLoading ? <Leer titel="Lädt …" />
            : liste.error ? <Leer titel="Die Kalkulationen liessen sich nicht laden.">Bitte später noch einmal.</Leer>
            : !gezeigt.length ? <Leer titel={wahl === 'offen' ? 'Nichts unterwegs.' : 'Nichts in dieser Liste.'}>{wahl === 'offen' ? 'Oben eine Adresse eingeben und einreichen.' : undefined}</Leer>
            : <ul className={LISTE}>{gezeigt.map(k => <Zeile key={k.id} k={k} jetzt={jetzt} an={k.id === offenId} oeffnen={() => { setzen({ calc: k.id, neu: null, anfrage: null }); window.scrollTo({ top: 0 }); }} />)}</ul>}
        </Abschnitt>
      </div>

      <div className="print:hidden"><AblaufPersonen /></div>
      </>}
    </Seite>
  );
}

/** Eine Kalkulation in der Liste: wo sie steht, bei wem zuletzt, wie viel Zeit bleibt. */
function Zeile({ k, jetzt, an, oeffnen }: { k: KalkulationKurz; jetzt: number; an: boolean; oeffnen: () => void }) {
  const u = uhr(k, jetzt);
  const letzter = k.verlauf[k.verlauf.length - 1];
  const preis = k.preis_chf ?? k.empfehlung_chf;
  return (
    <li>
      <button type="button" onClick={oeffnen} aria-current={an ? 'true' : undefined}
              className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 p-4 text-left transition-colors hover:bg-secondary/60 ${an ? 'bg-secondary/60' : ''}`}>
        <span className="min-w-0 space-y-0.5">
          <span className="block truncate text-[16px] font-medium">{k.adresse}</span>
          <span className="block truncate text-sm text-muted-foreground">
            {[[k.plz, k.gemeinde].filter(Boolean).join(' '), k.kontakt, letzter ? `${letzter.name}: ${SCHRITT_TEXT[letzter.schritt] ?? letzter.schritt}` : null].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="flex flex-col items-end gap-1">
          <span className="whitespace-nowrap tabular-nums text-violett">{preis != null ? betrag(preis) : '–'}</span>
          <span className="flex gap-1">
            {k.test && <Marke>Test</Marke>}
            <Marke art={k.zustand === 'gesendet' ? 'minze' : k.zustand === 'abgelehnt' ? 'rosa' : k.zustand === 'entwurf' ? 'grau' : 'lila'}>{ZUSTAND_TEXT[k.zustand]}</Marke>
          </span>
        </span>
        {u && u.laeuft && (
          <span className="col-span-2 grid grid-cols-1 items-center gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,260px)_auto] sm:justify-start">
            <Strichbalken anteil={Math.min(1, u.anteil)} farbe={u.ueberfaellig ? 'heiss' : 'akzent'} />
            <span className={`text-sm ${u.ueberfaellig ? 'font-medium text-heiss' : 'text-accent'}`}>{u.text}</span>
          </span>
        )}
        {u && !u.laeuft && <span className="col-span-2 text-sm text-muted-foreground">{u.text}</span>}
      </button>
    </li>
  );
}
