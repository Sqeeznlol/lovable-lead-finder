import { useState } from 'react';

/**
 * Der Schnitt durch die Parzelle: wie das Haus heute steht und was die
 * Zone erlaubt (Julian, 19. November, nach dem Vergleich mit
 * baugesuch.prüfer.ch: «die bewegte Schnittzeichnung zeigt vor dem ersten
 * Klick, was man bekommt»). Zuerst der Boden, dann die Grenzen, dann das
 * Haus Geschoss für Geschoss, zuletzt in der Farbe der Marke, was dazukommen
 * dürfte.
 *
 * Ein Schema, nicht massstäblich, und so beschriftet: die Breite des Hauses
 * kennt die Seite nicht im Schnitt, nur Grundfläche und Geschosse. Wer im
 * Gerät weniger Bewegung eingestellt hat, sieht das fertige Bild (check.css).
 */
export interface SchnittDaten { heute: number; erlaubt: number; dach: 'attika' | 'dach' | null; hoehe: number | null }

const B = 640, BODEN = 300, GESCHOSS = 46, LINKS = 60, RECHTS = 580;

export function Schnitt({ d, titel }: { d: SchnittDaten; titel: string }) {
  const [lauf, setLauf] = useState(0);
  const heute = Math.min(d.heute, 12), erlaubt = Math.min(d.erlaubt, 12);
  const haus = { x: 190, b: 260 };
  // Die Hülle oben drauf: Attika zurückversetzt, Dachgeschoss als Giebel.
  const dachH = d.dach ? GESCHOSS * 0.9 : 0;
  const oben = BODEN - erlaubt * GESCHOSS - dachH;
  const skala = Math.min(1, (BODEN - 50) / (BODEN - oben));
  const y = (v: number) => BODEN - (BODEN - v) * skala;
  const g = GESCHOSS * skala;
  const mehr = Math.max(0, erlaubt - heute) + (d.dach ? 1 : 0);
  const beschriftung = [
    `${heute ? `Heute ${heute} Geschoss${heute === 1 ? '' : 'e'}` : 'Heute unbebaut'}`,
    `möglich ${erlaubt} Vollgeschoss${erlaubt === 1 ? '' : 'e'}${d.dach === 'attika' ? ' + Attika' : d.dach === 'dach' ? ' + Dachgeschoss' : ''}`,
  ].join(', ');

  return (
    <figure className="schnitt" aria-label={`${titel}: ${beschriftung}`}>
      {/* Oben nur so viel Raum, wie die Zeichnung braucht: auf dem iPhone zählt jede Zeile. */}
      <svg key={lauf} viewBox={`0 ${Math.floor(y(oben) - 40)} ${B} ${Math.ceil(BODEN + 30 - (y(oben) - 40))}`} role="img" aria-hidden="true">
        <line className="s-boden" x1="20" y1={BODEN} x2={B - 20} y2={BODEN} />
        <text className="s-klein" x={B - 22} y={BODEN + 18} textAnchor="end">Boden</text>
        {[LINKS, RECHTS].map((x, i) => (
          <g key={x} className="s-grenze" style={{ animationDelay: `${200 + i * 120}ms` }}>
            <line x1={x} y1={BODEN + 8} x2={x} y2={y(oben) - 14} />
            {i === 0 && <text className="s-klein" x={x + 6} y={y(oben) - 18}>Parzellengrenze</text>}
          </g>
        ))}
        {/* Was heute steht, Geschoss für Geschoss. */}
        {Array.from({ length: heute }, (_, i) => (
          <rect key={`h${i}`} className="s-heute" x={haus.x} y={BODEN - (i + 1) * g} width={haus.b} height={g - 2}
                style={{ animationDelay: `${600 + i * 180}ms` }} />
        ))}
        {/* Was die Zone darüber und daneben zulässt. */}
        {Array.from({ length: Math.max(0, erlaubt - heute) }, (_, i) => (
          <rect key={`m${i}`} className="s-moeglich" x={haus.x - 30} y={BODEN - (heute + i + 1) * g} width={haus.b + 60} height={g - 2}
                style={{ animationDelay: `${700 + heute * 180 + i * 200}ms` }} />
        ))}
        {d.dach === 'attika' && (
          <rect className="s-moeglich" x={haus.x + 20} y={BODEN - erlaubt * g - dachH * skala} width={haus.b - 40} height={dachH * skala - 2}
                style={{ animationDelay: `${800 + (heute + mehr) * 200}ms` }} />
        )}
        {d.dach === 'dach' && (
          <polygon className="s-moeglich" points={`${haus.x - 30},${BODEN - erlaubt * g} ${haus.x + haus.b / 2},${BODEN - erlaubt * g - dachH * skala * 1.4} ${haus.x + haus.b + 30},${BODEN - erlaubt * g}`}
                   style={{ animationDelay: `${800 + (heute + mehr) * 200}ms` }} />
        )}
        {d.hoehe != null && (
          <g className="s-masz" style={{ animationDelay: `${1100 + (heute + mehr) * 200}ms` }}>
            <line x1={RECHTS - 40} y1={BODEN} x2={RECHTS - 40} y2={y(oben)} />
            <text className="s-klein" x={RECHTS - 48} y={y(oben) + 14} textAnchor="end">zulässig {d.hoehe.toLocaleString('de-CH')} m</text>
          </g>
        )}
      </svg>
      <figcaption>
        <span><i className="s-punkt heute" />{heute ? `Heute ${heute} Geschoss${heute === 1 ? '' : 'e'}` : 'Heute unbebaut'}</span>
        <span><i className="s-punkt moeglich" />Möglich {erlaubt} Vollgeschoss{erlaubt === 1 ? '' : 'e'}{d.dach === 'attika' ? ' + Attika' : d.dach === 'dach' ? ' + Dachgeschoss' : ''}</span>
        <span className="s-klein-text">Schema, nicht massstäblich</span>
        <button type="button" className="s-nochmals" onClick={() => setLauf(l => l + 1)}>Zeichnung nochmals abspielen</button>
      </figcaption>
    </figure>
  );
}
