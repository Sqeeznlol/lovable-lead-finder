import { Eigentuemersuche } from '@/components/Eigentuemersuche';
import { useCanton } from '@/hooks/use-canton';
import { Parzellensuche } from '@/components/Parzellensuche';
import { useUebersicht } from '@/hooks/use-uebersicht';
import { Loader2, MapPin } from 'lucide-react';
import { Abschnitt, Leer, LISTE, Marke, Seite, Strichbalken } from '@/components/rahmen';
import { BILD } from '@/lib/luftbild';

// Ab einer Milliarde in Mrd: "2840 Mio" liest niemand auf einen Blick.
const chf = (v: number | null | undefined, stellen = 1) =>
  v == null ? '–' : Math.abs(v) >= 1e9 ? `${(v / 1e9).toFixed(1)} Mrd` : `${(v / 1e6).toFixed(stellen)} Mio`;

/**
 * Die Übersicht beantwortet eine Frage: Wo fange ich an?
 *
 * Oben die Zahlen, die den Tag bestimmen -- wie viele Objekte einen Anruf
 * wert sind und was dahinter steht. Darunter die konkreten Adressen und die
 * Gemeinden, in denen sich die Chancen häufen.
 */
export function Uebersicht() {
  // Ohne den Kanton zeigte die Übersicht Zürcher Chancen, auch wenn
  // oben Thurgau gewählt war.
  const { current } = useCanton();
  const { data, isLoading } = useUebersicht(current);

  if (isLoading || !data) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Objekte werden beurteilt …
      </p>
    );
  }

  const e = data.nachEmpfehlung;
  const n = (x: number) => x.toLocaleString('de-CH');
  const maxMarge = Math.max(1, ...data.topGemeinden.map(g => g.margeSumme));
  const FARBEN = ['heiss', 'akzent', 'gruen'] as const;

  return (
    <Seite bild={BILD.uebersicht} ueber={`Übersicht · Kanton ${current}`}
      titel={e.anrufen ? `${n(e.anrufen)} Objekte lohnen eine Abfrage` : 'Heute ist nichts abzufragen'}
      unter={`${n(data.total)} Objekte im Bestand, ${n(data.bewertet)} mit berechnetem Potenzial.`}
      kennzahlen={[
        { titel: 'Abfragen', wert: n(e.anrufen), marke: <Marke art="heiss">heiss</Marke> },
        { titel: 'Prüfen', wert: n(e.pruefen), marke: <Marke art="lila">zweiter Blick</Marke> },
        { titel: 'Marge', wert: chf(data.margeSumme, 0), marke: <Marke art="violett">2'000 grösste</Marke> },
        { titel: 'Eigentümer fehlt', wert: n(data.ohneEigentuemer), marke: <Marke art="rosa">abfragen</Marke> },
      ]}>
      {/* Auf dem Desktop steht die Suche oben in der Kopfzeile; auf dem
          Handy hier, weil am Telefon die Parzellennummer genannt wird. */}
      <div className="lg:hidden"><Parzellensuche kanton={current} /></div>

      {/* Die knappste Ressource im Ablauf: fünf Grundbuchabfragen am Tag. */}
      <Eigentuemersuche objekte={data.nachschlagen} />

      <Abschnitt titel="Wo es sich lohnt" unter="Gemeinden nach Marge der Chancen" symbol={MapPin} kachel="schwarz"
                 zahl={data.topGemeinden.length || undefined}
                 hinweis="Das Preisniveau je Gemeinde ist ein Erfahrungswert für die Reihenfolge, keine Schätzung.">
        {data.topGemeinden.length === 0 ? (
          <Leer titel="Noch keine Gemeinde mit Chancen.">Sobald Objekte bewertet sind, stehen hier die Gemeinden mit der grössten Marge.</Leer>
        ) : (
          <ul className={LISTE}>
            {data.topGemeinden.map((g, i) => (
              <li key={g.gemeinde} className="grid grid-cols-[minmax(0,1fr)_minmax(110px,38%)_auto] items-center gap-4 px-4 py-3.5">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{g.gemeinde}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {g.lage} · {g.chancen} Chancen{g.anrufen > 0 ? `, ${g.anrufen} zum Abfragen` : ''}
                  </span>
                </span>
                <Strichbalken titel="Anteil" anteil={g.margeSumme / maxMarge} farbe={FARBEN[i % 3]} />
                <span className="shrink-0 text-right font-semibold text-violett">{chf(g.margeSumme, 0)}</span>
              </li>
            ))}
          </ul>
        )}
      </Abschnitt>
    </Seite>
  );
}

