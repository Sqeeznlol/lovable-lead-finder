import type { ReactNode } from 'react';
import { Marke } from '@/components/rahmen';
import { chf, m2, type Art, type Gebaeude } from '@/lib/machbarkeit';
import { parzellenText, type Bewertung, type CalcAnnahmen, type ErloesQuelle } from '@/lib/calc';
import { betrag } from '@/lib/calc-ablauf';
import type { Adresse } from '@/lib/calc-daten';
import { luftbildLv95 } from '@/lib/luftbild';
import { KNOPF } from '@/components/rahmen';

/**
 * Was CALC YOU LATER zu einer Adresse zeigt: ein Satz mit dem Preis, die
 * Eckwerte in der Reihenfolge der Idee (Fläche, HNF, Kubatur, Baukosten,
 * Erlös, Gewinn, Landwert), die zwei Bewertungen nebeneinander, Chancen
 * und Risiken, und zuunterst die Herkunft jeder Zahl.
 *
 * Dieselbe Ansicht für die laufende Rechnung und für die gespeicherte
 * Momentaufnahme: wer prüft, sieht genau, was eingereicht wurde.
 */
const de = (n: number, stellen = 0) => n.toLocaleString('de-CH', { maximumFractionDigits: stellen, minimumFractionDigits: stellen });
const ART: Record<Art, string> = { amtlich: 'amtlich', berechnet: 'berechnet', annahme: 'Annahme' };
const ETIKETT = 'text-[11px] uppercase tracking-wide text-muted-foreground';
const QUELLE: Record<ErloesQuelle['art'], string> = { annahme: 'Annahme', amtlich: 'amtlich', angabe: 'Angabe Julian', hand: 'von Hand', inserate: 'aus Inseraten', land: 'aus dem Landpreis' };
/** Ein Betrag mit Vorzeichen, wie man es liest: «− CHF 473'000» statt «CHF -473'000». */
const mitZeichen = (x: number) => (x < 0 ? `− ${chf(-x)}` : chf(x));

/** Der Ort, um den es geht: Luftbild, Adresse und was die Register dazu sagen. */
export function Objektkopf({ adresse, parzelleNr, flaeche, zone, eigentuemer, gebaeude, rechts }: {
  adresse: Adresse; parzelleNr: string | null; flaeche: number | null; zone: string | null; eigentuemer: string | null;
  gebaeude: Gebaeude[]; rechts?: ReactNode;
}) {
  const haupt = [...gebaeude].sort((a, b) => (b.grundflaeche ?? 0) - (a.grundflaeche ?? 0))[0];
  const wohnungen = gebaeude.reduce((s, g) => s + (g.wohnungen ?? 0), 0);
  const bestand = haupt ? [
    gebaeude.length === 1 ? '1 Gebäude' : `${gebaeude.length} Gebäude`,
    haupt.baujahr ? `Baujahr ${haupt.baujahr}` : null,
    haupt.geschosse ? `${haupt.geschosse} Geschosse` : null,
    haupt.grundflaeche ? `${m2(haupt.grundflaeche)} Grundfläche` : null,
    wohnungen ? `${wohnungen} ${wohnungen === 1 ? 'Wohnung' : 'Wohnungen'}` : null,
  ].filter(Boolean).join(' · ') : null;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
      <span className="relative block aspect-video w-full overflow-hidden rounded-[3px] bg-secondary print:hidden">
        <img src={luftbildLv95(adresse.e, adresse.n, 160, 640)} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        <span className="absolute bottom-1 right-2 text-[10px] text-white/90">© swisstopo</span>
      </span>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="min-w-0 text-xl">{adresse.strasse}</h2>
          {rechts}
        </div>
        <p className="text-sm text-muted-foreground">
          {[[adresse.plz, adresse.ort].filter(Boolean).join(' '), parzelleNr ? `Parzelle ${parzelleNr}` : null, flaeche ? m2(flaeche) : null].filter(Boolean).join(' · ')}
        </p>
        <p className="text-sm">{zone ?? 'Zone nicht bekannt'}</p>
        <p className="text-sm text-muted-foreground">{bestand ?? 'Kein Gebäude im Register'}</p>
        {eigentuemer && <p className="text-sm text-muted-foreground">Eigentümer im Bestand: {eigentuemer}</p>}
      </div>
    </div>
  );
}

function Zeile({ titel, wert, fett, minus }: { titel: string; wert: string; fett?: boolean; minus?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${fett ? 'border-t pt-1.5 font-medium' : ''}`}>
      <dt className={fett ? '' : 'text-muted-foreground'}>{titel}</dt>
      <dd className="whitespace-nowrap tabular-nums">{minus ? '− ' : ''}{wert}</dd>
    </div>
  );
}

/**
 * onErloes: nur in der laufenden Rechnung. Dann lässt sich ein am Markt
 * gemessener Erlös mit einem Tipp übernehmen; in der eingereichten
 * Kalkulation steht der Abgleich nur da.
 */
export function Ergebnis({ b, annahmen, onErloes }: { b: Bewertung; annahmen: CalcAnnahmen; onErloes?: (erloes: number, quelle: ErloesQuelle) => void }) {
  const n = b.neubau, m = b.neubauMiete, h = b.bestand, s = b.studie;
  const eck: [string, string, string][] = n ? [
    ['Grundstück', m2(s.flaeche), 'laut Amtlicher Vermessung'],
    ['Mögliche Hauptnutzfläche', m2(n.hnf), `${n.hnfText?.startsWith('Praxisformel') ? 'Praxisformel, ' : ''}${m2(n.gf)} Geschossfläche`],
    ['Kubatur', `${de(Math.round(n.kubatur))} m³`, 'über Boden'],
    ['Wohnungen', `rund ${de(n.wohnungen)}`, `je ${de(annahmen.wohnungM2)} m²`],
    ['Baukosten', chf(n.baukosten + n.abbruch), `CHF ${de(n.baukostenJeM2)} je m² Nutzfläche${n.abbruch ? `, dazu ${chf(n.abbruch)} Abbruch` : ''}`],
    ['Verkaufserlös', chf(n.erloes), `CHF ${de(annahmen.erloes)} je m² Nutzfläche · ${QUELLE[b.erloesQuelle.art]}`],
    ['Gewinn', chf(n.gewinn), `${de(annahmen.marge * 100)} % des Erlöses`],
    ['Landwert', mitZeichen(n.landwert), `CHF ${de(Math.round(n.jeM2 / 10) * 10)} je m² Grundstück`],
  ] : [];

  return (
    <div className="space-y-5">
      {/* Ein Satz mit der Zahl, wie im Cockpit. Mit dazugekauftem Nachbarn sagt er das. */}
      {b.empfehlung != null && b.zusammen?.lohnt && b.empfehlung === b.zusammen.empfehlung ? (
        <p className="text-[22px] leading-snug tracking-tight">
          Kaufpreisempfehlung <span className="font-semibold">{betrag(b.empfehlung)}</span> mit {parzellenText(b.zusammen.teile)} dazugekauft.{' '}
          <span className="text-muted-foreground">
            Allein wären es {b.empfehlungAllein != null ? betrag(b.empfehlungAllein) : 'keine Empfehlung'}.{' '}
            {b.zusammen.teile.length === 1 ? 'Der Nachbar bekommt seinen eigenen Wert' : 'Die Nachbarn bekommen zusammen ihren eigenen Wert'} ({chf(b.zusammen.nachbarWert)}),
            der Rest der gemeinsamen Rechnung geht in dieses Angebot. Davon gehen {de(annahmen.abschlag * 100)} % Abschlag ab.
          </span>
        </p>
      ) : b.empfehlung != null ? (
        <p className="text-[22px] leading-snug tracking-tight">
          Kaufpreisempfehlung <span className="font-semibold">{betrag(b.empfehlung)}</span>.{' '}
          <span className="text-muted-foreground">
            {b.massgebend === 'bestand'
              ? <>Massgebend ist der Bestand: mit den heutigen Mieten ist das Haus {chf(b.wert!)} wert.</>
              : b.massgebend === 'miete'
              ? <>Massgebend ist ein Neubau zum Vermieten: {chf(b.wert!)} bleiben für das Land.</>
              : <>Massgebend ist ein Neubau zum Verkaufen: {chf(b.wert!)} bleiben für das Land.</>}
            {' '}Davon gehen {de(annahmen.abschlag * 100)} % Abschlag ab.
          </span>
        </p>
      ) : (
        <p className="text-[22px] leading-snug tracking-tight">
          Noch keine Empfehlung.{' '}
          <span className="text-muted-foreground">
            {!n ? `${s.grund ?? "Die Zone nennt keine Ziffer."} Ziffer und Geschosse lassen sich unten von Hand eingeben.` : 'Mit diesen Annahmen bleibt für das Land nichts übrig.'}
          </span>
        </p>
      )}

      {/* Der grösste Hebel gleich unter dem Preis: womit gerechnet ist und was der Markt sagt. */}
      {n && (() => {
        const weit = (x: number | null) => x != null && Math.abs(x / annahmen.erloes - 1) > 0.15;
        const land = weit(b.erloesLand) ? b.erloesLand : null;
        const inserate = weit(b.erloesInserate) ? Math.round(b.erloesInserate! / 100) * 100 : null;
        if (!land && !inserate) return null;
        return (
          <div className="space-y-2 border-l-2 border-accent pl-4">
            <p className="text-sm">
              Gerechnet ist mit einem Erlös von CHF {de(annahmen.erloes)} je m² ({b.erloesQuelle.text}).
              {land != null && <> Zum Bauland, das in der Gemeinde bezahlt wird{b.landMarkt ? ` (Median CHF ${de(b.landMarkt.jeM2)} je m²)` : ''}, passt CHF {de(land)}.</>}
              {inserate != null && <> {b.kaeufe} {b.kaeufe === 1 ? 'Kaufinserat verlangt' : 'Kaufinserate verlangen'} im Median CHF {de(inserate)}.</>}
            </p>
            {onErloes && (
              <div className="flex flex-wrap gap-2 print:hidden">
                {inserate != null && <button type="button" className={KNOPF} onClick={() => onErloes(inserate, { art: 'inserate', text: `Median aus ${b.kaeufe} Kaufinseraten` })}>CHF {de(inserate)} aus den Inseraten übernehmen</button>}
                {land != null && <button type="button" className={KNOPF} onClick={() => onErloes(land, { art: 'land', text: 'zurückgerechnet aus dem bezahlten Landpreis der Gemeinde' })}>CHF {de(land)} aus dem Landpreis übernehmen</button>}
              </div>
            )}
          </div>
        );
      })()}

      {eck.length > 0 && (
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded border bg-border lg:grid-cols-4">
          {eck.map(([titel, wert, unter]) => (
            <div key={titel} className="min-w-0 bg-card p-4">
              <dt className={ETIKETT}>{titel}</dt>
              <dd className="mt-1 text-[22px] leading-tight tracking-tight sm:text-[26px]">{wert}</dd>
              <dd className="mt-0.5 text-xs text-muted-foreground">{unter}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Drei Bewertungen: die höchste bestimmt den Preis. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-[3px] border bg-card p-4">
          <p className="flex items-center justify-between gap-2 font-medium">Neubau zum Verkaufen {b.massgebend === 'neubau' && <Marke art="lila">massgebend</Marke>}</p>
          <p className="text-sm text-muted-foreground">Was für das Land bleibt, wenn man das Mögliche baut und als Eigentum verkauft.</p>
          {n ? (
            <dl className="mt-3 space-y-1.5 text-sm">
              <Zeile titel="Verkaufserlös" wert={chf(n.erloes)} />
              <Zeile titel={`Baukosten, CHF ${de(n.baukostenJeM2)} je m²`} wert={chf(n.baukosten)} minus />
              {n.abbruch > 0 && <Zeile titel="Abbruch" wert={chf(n.abbruch)} minus />}
              <Zeile titel="Gewinn" wert={chf(n.gewinn)} minus />
              <Zeile titel="Bleibt für das Land" wert={mitZeichen(n.landwert)} fett />
            </dl>
          ) : <p className="mt-3 text-sm text-muted-foreground">Nicht rechenbar: {s.grund}</p>}
        </div>
        <div className="rounded-[3px] border bg-card p-4">
          <p className="flex items-center justify-between gap-2 font-medium">Neubau zum Vermieten {b.massgebend === 'miete' && <Marke art="lila">massgebend</Marke>}</p>
          <p className="text-sm text-muted-foreground">Was ein Anleger für die neuen Mietwohnungen zahlt, minus Bau und Gewinn.</p>
          {m ? (
            <>
              <dl className="mt-3 space-y-1.5 text-sm">
                <Zeile titel="Miete je m² und Monat" wert={`CHF ${de(m.miete, 2)}`} />
                <Zeile titel="Mietertrag im Jahr" wert={chf(m.ertrag)} />
                <Zeile titel={`Wert bei ${de(annahmen.rendite * 100, 1)} % Rendite`} wert={chf(m.wert)} />
                <Zeile titel={`Baukosten, CHF ${de(m.baukostenJeM2)} je m²`} wert={chf(m.baukosten)} minus />
                {m.abbruch > 0 && <Zeile titel="Abbruch" wert={chf(m.abbruch)} minus />}
                <Zeile titel="Gewinn" wert={chf(m.gewinn)} minus />
                <Zeile titel="Bleibt für das Land" wert={mitZeichen(m.landwert)} fett />
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">Miete: {m.mieteQuelle}.</p>
            </>
          ) : <p className="mt-3 text-sm text-muted-foreground">Nicht rechenbar: {s.grund ?? 'keine Miete bekannt.'}</p>}
        </div>
        <div className="rounded-[3px] border bg-card p-4">
          <p className="flex items-center justify-between gap-2 font-medium">Bestand {b.massgebend === 'bestand' && <Marke art="lila">massgebend</Marke>}</p>
          <p className="text-sm text-muted-foreground">Was das Haus mit seinen Mieten wert ist.</p>
          {h ? (
            <>
              <dl className="mt-3 space-y-1.5 text-sm">
                {h.wohnungen != null && <Zeile titel="Wohnungen" wert={de(h.wohnungen)} />}
                {h.flaeche != null && <Zeile titel={h.flaecheArt === 'hand' ? 'Vermietbare Fläche laut Eingabe' : 'Vermietbare Fläche aus dem Fussabdruck'} wert={m2(h.flaeche)} />}
                {h.mieteHeute != null && <Zeile titel="Miete je m² und Monat" wert={`CHF ${de(h.mieteHeute, 2)}`} />}
                <Zeile titel="Mietertrag im Jahr" wert={chf(h.ertragHeute)} />
                <Zeile titel="Rendite des Käufers" wert={`${de(annahmen.rendite * 100, 1)} %`} />
                <Zeile titel="Ertragswert" wert={chf(h.wert)} fett />
                {h.marktmiete != null && h.wertMarkt != null && (
                  <>
                    <Zeile titel={`Marktmiete aus ${h.vergleiche} ${h.vergleiche === 1 ? 'Inserat' : 'Inseraten'}`} wert={`CHF ${de(h.marktmiete, 2)}`} />
                    <Zeile titel="Ertragswert neu vermietet" wert={chf(h.wertMarkt)} />
                  </>
                )}
              </dl>
              <p className="mt-2 text-xs text-muted-foreground">Miete: {h.mieteQuelle}.</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Kein Mehrfamilienhaus im Register. Wer unten Mieten oder die vermietbare Fläche einträgt, bekommt die zweite Bewertung.</p>
          )}
        </div>
      </div>

      {/* Der Massstab: was in der Gemeinde für Land wirklich bezahlt wurde. */}
      {b.landMarkt && (
        <p className="text-sm">
          Zum Vergleich: zum Median dessen, was in der Gemeinde für Wohnbauland bezahlt wurde (CHF {de(b.landMarkt.jeM2)} je m², amtlich), kostet dieses Grundstück {chf(b.landMarkt.wert)}
          {b.landMarkt.wert >= 1e6 ? '' : '.'}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className={ETIKETT}>Chancen</p>
          {b.chancen.length
            ? <ul className="list-disc space-y-1.5 pl-5 text-sm marker:text-gruen">{b.chancen.map(c => <li key={c}>{c}</li>)}</ul>
            : <p className="text-sm text-muted-foreground">Keine gefunden.</p>}
        </div>
        <div className="space-y-1.5">
          <p className={ETIKETT}>Risiken</p>
          {b.risiken.length
            ? <ul className="list-disc space-y-1.5 pl-5 text-sm marker:text-destructive">{b.risiken.map(r => <li key={r}>{r}</li>)}</ul>
            : <p className="text-sm text-muted-foreground">Keine gefunden.</p>}
        </div>
      </div>

      {(s.rechenbar || n) && (
        <details className="rounded-[3px] border bg-card print:hidden">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium">Herkunft jeder Zahl</summary>
          <div className="space-y-4 border-t p-4">
            {(b.herkunft ?? s.abschnitte).map(a => (
              <div key={a.titel} className="space-y-1.5">
                <p className={ETIKETT}>{a.titel}</p>
                <dl className="divide-y rounded-[3px] border">
                  {a.zeilen.map(z => (
                    <div key={z.titel} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 px-3 py-2 text-sm">
                      <dt>{z.titel}</dt>
                      <dd className="text-right font-medium tabular-nums">{z.wert}</dd>
                      <dd className="col-span-2 text-xs text-muted-foreground">{ART[z.art]} · {z.quelle}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
            <div className="space-y-1.5">
              <p className={ETIKETT}>Vor einem Entscheid prüfen</p>
              <ul className="list-disc space-y-1 pl-5 text-sm">{s.pruefen.map(p => <li key={p}>{p}</li>)}</ul>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
