import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import './check.css';
import { BETREIBER, markeFuerHost, markeNachId, STANDARD_MARKE, type Marke } from '@/lib/check-marken';
import { KATASTER } from '@/lib/check-hintergrund';
import { artikelNachSlug, zumCheck, type Artikel } from '@/lib/ratgeber';

/**
 * Ein Ratgeber-Artikel auf einer Marken-Domain (/ratgeber/<slug>) oder
 * zur Vorschau auf unserer Domain (/check/<marke>/ratgeber/<slug>).
 *
 * Gelesen wird er vor allem von älteren Eigentümern, die über Facebook
 * kommen (Tim, 7. November). Darum grosse Schrift, kurze Absätze, hoher
 * Kontrast und nichts, was ablenkt. Die Seite liest und schreibt nichts
 * in der Datenbank; der Lead entsteht erst im Check.
 */
export default function Ratgeber({ marke: vorgabe }: { marke?: Marke }) {
  const { marke: markeId, artikel: slug } = useParams();
  const aufMarkenDomain = !!markeFuerHost(window.location.hostname);
  const marke = useMemo(() => vorgabe ?? markeFuerHost(window.location.hostname) ?? markeNachId(markeId) ?? STANDARD_MARKE, [vorgabe, markeId]);
  const artikel = artikelNachSlug(slug);
  const ziel = zumCheck({ aufMarkenDomain, markeId: marke.id, suche: window.location.search, slug: artikel?.slug ?? 'unbekannt' });

  useEffect(() => {
    document.title = artikel ? `${artikel.titel} | ${marke.name.join('')}` : marke.name.join('');
    if (!document.getElementById('gisk-fonts')) {
      const l = document.createElement('link');
      l.id = 'gisk-fonts'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Urbanist:wght@300;400;500;600;700&display=swap';
      document.head.appendChild(l);
    }
  }, [artikel, marke]);

  const wortmarke = <><span className="zeichen" aria-hidden="true"><i /></span><span>{marke.name[0]}<b>{marke.name[1]}</b></span></>;

  return (
    <div className="pc ratgeber" style={{ ['--marke' as string]: marke.farbe, ['--marke-hell' as string]: marke.hell }}>
      <header className="kopf">
        <div className="huelle">
          <a className="wortmarke" href={ziel}>{wortmarke}</a>
          <div className="rechts"><a className="knopf marke" href={ziel}>Kostenlos prüfen</a></div>
        </div>
      </header>

      {artikel ? <Inhalt artikel={artikel} ziel={ziel} /> : (
        <main className="huelle artikel">
          <h1>Diesen Artikel gibt es nicht.</h1>
          <p>Vielleicht wurde er verschoben. Ihr Grundstück können Sie trotzdem prüfen.</p>
          <a className="knopf marke" href={ziel}>Zum Check</a>
        </main>
      )}

      <footer>
        <div className="huelle">
          <div><span className="wortmarke">{wortmarke}</span>
            <p>Ein Ratgeber von {BETREIBER}. Wir begleiten Eigentümer bei Verkauf und Entwicklung von Liegenschaften und kaufen auch selbst.</p></div>
          <div className="unten">Dieser Ratgeber ersetzt keine Rechts- oder Steuerberatung.</div>
        </div>
      </footer>
    </div>
  );
}

function Inhalt({ artikel, ziel }: { artikel: Artikel; ziel: string }) {
  const kasten = (
    <aside className="ratgeber-kasten" aria-label="Angebot">
      <div>
        <h3>{artikel.kasten.titel}</h3>
        <p>{artikel.kasten.satz}</p>
      </div>
      <a className="knopf marke" href={ziel}>{artikel.kasten.knopf}</a>
    </aside>
  );
  return (
    <main>
      <section className="ratgeber-kopf">
        <svg className="kataster" viewBox={`0 0 ${KATASTER.breite} ${KATASTER.hoehe}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path className="linien" d={KATASTER.linien} />
        </svg>
        <div className="huelle">
          <div className="ueber">Ratgeber · {artikel.rubrik}</div>
          <h1>{artikel.titel}</h1>
          <p className="lead-text">{artikel.lead}</p>
          <div className="meta">Lesezeit {artikel.lesezeit} · Stand {artikel.stand}</div>
        </div>
      </section>
      <article className="huelle artikel">
        {artikel.abschnitte.map(a => (
          <section key={a.titel}>
            <h2>{a.titel}</h2>
            {a.absaetze.map((t, i) => <p key={i}>{t}</p>)}
            {a.kasten && kasten}
          </section>
        ))}
        {kasten}
        <div className="quellen">
          <h4>Quellen</h4>
          <ul>{artikel.quellen.map(q => <li key={q.url}><a href={q.url}>{q.text}</a></li>)}</ul>
        </div>
      </article>
    </main>
  );
}
