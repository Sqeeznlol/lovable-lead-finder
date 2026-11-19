import { BISHER_SATZ, NUR_BISHER_SATZ, standKurz, type Fundstelle, type Gesetz } from '@/lib/check-fundstelle';
import { FENSTER } from '@/lib/fenster';

/**
 * Die Rechnung mit Fundstelle, zum Aufklappen (check-fundstelle.ts):
 * zuerst die Rechnung, dann woher der Wert kommt, dann der Artikel mit
 * Zitat. Geschlossen steht nur eine Zeile da; Julian wollte die Quellen
 * nicht neben jeder Zahl (15. November).
 */
export function FundstelleTafel({ f, offen = false, titel = 'So ist gerechnet' }: { f: Fundstelle; offen?: boolean; titel?: string }) {
  return (
    <details className="fundstelle" open={offen}>
      <summary>{titel}<span>{f.titel}</span></summary>
      <ol className="f-rechnung">{f.rechnung.map(r => <li key={r}>{r}</li>)}</ol>
      <dl>
        <div><dt>Vorgabe</dt><dd>{f.vorgabe}{f.ordnung && (f.ordnung.url
          ? <small>Beschlossen in: <a href={f.ordnung.url} target={FENSTER.extern}>{f.ordnung.titel}</a></small>
          : <small>Beschlossen in: {f.ordnung.titel}</small>)}</dd></div>
        <div><dt>Gesetz</dt><dd>{f.gesetz
          ? <><GesetzText g={f.gesetz} />{f.gesetz.fassung === 'bisher' && <small>{NUR_BISHER_SATZ}</small>}
              {f.bisher && <span className="f-bisher"><small>{BISHER_SATZ}</small><GesetzText g={f.bisher} /></span>}</>
          : 'Wie die Ziffer gemessen wird, regelt das Baurecht des Kantons oder die Bauordnung der Gemeinde; diese Stelle prüfen wir in der Analyse.'}</dd></div>
        {f.annahme && <div><dt>Hinweis</dt><dd>{f.annahme}</dd></div>}
      </dl>
    </details>
  );
}

/** Ein Artikel mit Zitat und Verweis auf den amtlichen Text. */
export function GesetzText({ g }: { g: Gesetz }) {
  return (
    <>
      <b>{g.artikel} {g.erlass}</b>, Kanton {g.kanton}
      <q>{g.zitat}</q>
      <small><a href={g.url} target={FENSTER.extern}>Gesetzestext</a> · {standKurz(g)}</small>
    </>
  );
}
