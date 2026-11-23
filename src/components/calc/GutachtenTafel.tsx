import { Loader2 } from 'lucide-react';
import { KNOPF, KNOPF_LEISE } from '@/components/rahmen';
import { datumLang } from '@/lib/angebot';
import type { Gutachten } from '@/lib/gutachten';
import { eintragKurz, type Oereb } from '@/lib/oereb';

/**
 * Ein Gutachten in CALC (23. November, Julian: «Bitte in CALC einpflegen ...
 * hochladen bzw. extrahieren»): hochladen, Aurora liest die Zahlen, die
 * Datei bleibt auf dem Gerät. Der Marktwert steht als Vergleich neben der
 * Empfehlung; in die Rechnung gehen Fläche und Mietertrag, wo nichts von
 * Hand steht.
 */
const de = (n: number, stellen = 0) => n.toLocaleString('de-CH', { maximumFractionDigits: stellen });
const chf = (n: number) => `CHF ${de(Math.round(n))}`;

function angaben(g: Gutachten): [string, string][] {
  const z: [string, string | null][] = [
    ['Kataster-Nr.', g.katNr],
    ['Grundstück', g.grundstueck != null ? `${de(g.grundstueck)} m²` : null],
    ['Zone', g.zone],
    ['Baujahr', g.baujahr != null ? String(g.baujahr) : null],
    ['Gebäudevolumen', g.volumen != null ? `${de(g.volumen)} m³` : null],
    ['Nutzfläche', g.nutzflaeche != null ? `${de(g.nutzflaeche, 1)} m²` : null],
    ['Mietzins heute', g.mietzinsJahr != null ? `${chf(g.mietzinsJahr)} im Jahr` : null],
    ['Mietwert heutiger Zustand', g.mietwertMonat != null ? `${chf(g.mietwertMonat)} im Monat` : null],
    ['Mietwert neuwertig', g.mietwertJahr != null ? `${chf(g.mietwertJahr)} im Jahr` : null],
    ['Kapitalisierungssatz', g.kapSatz != null ? `${de(g.kapSatz, 2)} %` : null],
    ['Ertragswert', g.ertragswert != null ? chf(g.ertragswert) : null],
    ['Versicherungswert', g.assekNeuwert != null ? chf(g.assekNeuwert) : null],
    ['Experte', g.experte],
  ];
  return z.filter((x): x is [string, string] => !!x[1]);
}

/** Marktwert neben der Empfehlung, in einem Satz. */
export function GutachtenVergleich({ g, empfehlung }: { g: Gutachten; empfehlung: number | null | undefined }) {
  if (g.marktwert == null) return null;
  return (
    <p className="text-[15px]">
      Marktwert laut Gutachten{g.stichtag ? ` vom ${datumLang(g.stichtag)}` : ''}: <span className="font-medium tabular-nums">{chf(g.marktwert)}</span>
      {empfehlung ? <span className="text-muted-foreground">. Die Empfehlung von CALC ({chf(empfehlung)}) sind {de(Math.round((empfehlung / g.marktwert) * 100))} % davon.</span> : null}
    </p>
  );
}

/** Der ÖREB-Auszug: je betroffenes Thema, was mit welcher Fläche gilt; Änderungen mit Vorwirkung als solche. */
export function OerebTeil({ o, flaecheCalc, entfernen }: { o: Oereb; flaecheCalc?: number | null; entfernen?: () => void }) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-[15px] font-medium">ÖREB-Auszug{o.datum ? ` vom ${datumLang(o.datum)}` : ''}</p>
        <p className="text-sm text-muted-foreground">
          {[o.grundstueckNr && `Grundstück ${o.grundstueckNr}`, o.gemeinde, o.flaeche != null && `${de(o.flaeche)} m²`, o.egrid].filter(Boolean).join(' · ')}
          {flaecheCalc && o.flaeche && Math.abs(flaecheCalc - o.flaeche) > 1 ? ` (CALC rechnet mit ${de(Math.round(flaecheCalc))} m²)` : ''}
        </p>
      </div>
      <dl className="space-y-1 text-sm">
        {o.themen.map((th, i) => (
          <div key={i} className="border-b border-border/60 py-1.5">
            <dt className="text-muted-foreground">{th.thema.replace(/^Nutzungsplanung \(kantonal\/kommunal\): /, '')}{th.stand !== 'Rechtskräftig' ? ` · ${th.stand}` : ''}</dt>
            <dd>{th.eintraege.map(e => `${eintragKurz(e)} ${de(e.wert)} ${e.einheit}${e.anteil != null ? ` (${de(e.anteil)} %)` : ''}`).join(' · ')}</dd>
          </div>
        ))}
      </dl>
      {entfernen && <button type="button" className={KNOPF_LEISE} onClick={entfernen}>ÖREB-Auszug entfernen</button>}
    </div>
  );
}

export function GutachtenTafel({ g, oereb, flaecheCalc, empfehlung, liest, fehler, laden, entfernen, oerebEntfernen }: {
  g: Gutachten | null; oereb: Oereb | null; flaecheCalc?: number | null; empfehlung: number | null | undefined; liest: boolean; fehler: string | null;
  laden: (datei: File | undefined) => void; entfernen: () => void; oerebEntfernen: () => void;
}) {
  const knopf = (text: string) => (
    <label className={`${KNOPF} cursor-pointer`}>
      {liest ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {liest ? 'Wird gelesen …' : text}
      <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={liest}
             onChange={e => { laden(e.target.files?.[0]); e.target.value = ''; }} />
    </label>
  );
  return (
    <div className="space-y-3 rounded-[3px] border bg-card p-4">
      {!g && oereb ? knopf('Gutachten dazu hochladen') : !g ? (
        <>
          <div>
            <p className="text-[15px] font-medium">Gutachten und ÖREB-Auszug</p>
            <p className="text-sm text-muted-foreground">Aus einem Gutachten liest Aurora Marktwert, Flächen, Mieten und Baujahr, aus einem ÖREB-Auszug Zonen, Gewässerraum, Wald und Baulinien. Die Datei bleibt auf diesem Gerät.</p>
          </div>
          {knopf('Gutachten oder ÖREB-Auszug hochladen (PDF)')}
        </>
      ) : (
        <>
          <div>
            <p className="text-[15px] font-medium">Gutachten{g.stichtag ? ` vom ${datumLang(g.stichtag)}` : ''}</p>
            <p className="text-sm text-muted-foreground">{g.datei}</p>
          </div>
          <GutachtenVergleich g={g} empfehlung={empfehlung} />
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {angaben(g).map(([t, w]) => (
              <div key={t} className="flex justify-between gap-3 border-b border-border/60 py-1.5">
                <dt className="text-muted-foreground">{t}</dt><dd className="text-right tabular-nums">{w}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-muted-foreground">In die Rechnung übernommen, wo nichts von Hand stand: Nutzfläche als vermietbare Fläche und der Mietzins von heute als Mietertrag.</p>
          <div className="flex flex-wrap gap-2">
            {knopf('Anderes Gutachten')}
            <button type="button" className={KNOPF_LEISE} onClick={entfernen}>Entfernen</button>
          </div>
        </>
      )}
      {oereb && <div className={g ? 'border-t pt-3' : ''}><OerebTeil o={oereb} flaecheCalc={flaecheCalc} entfernen={oerebEntfernen} /></div>}
      {g && !oereb && knopf('ÖREB-Auszug dazu hochladen')}
      {fehler && <p className="text-sm text-destructive" role="alert">{fehler}</p>}
    </div>
  );
}
