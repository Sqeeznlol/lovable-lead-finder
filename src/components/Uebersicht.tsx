import { Loader2 } from 'lucide-react';
import { Eigentuemersuche } from '@/components/Eigentuemersuche';
import { useCanton } from '@/hooks/use-canton';
import { Parzellensuche } from '@/components/Parzellensuche';
import { useUebersicht } from '@/hooks/use-uebersicht';
import { Abschnitt, Kopf, Leer, LISTE } from '@/components/rahmen';

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

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <Kopf ueber={`Kanton ${current}`} titel="Übersicht">
        {n(data.total)} Objekte im Bestand · {n(data.bewertet)} mit berechnetem Potenzial
      </Kopf>

      {/* Am Telefon wird eine Nummer genannt, und dann muss das
          Grundstück da sein -- nicht erst nach drei Filtern. */}
      <Parzellensuche kanton={current} />

      {/* Die vier Zahlen, an denen sich der Tag entscheidet. Hervorgehoben
          nur, was eine Handlung verlangt -- wie im Cockpit. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kennzahl wert={n(e.anrufen)} label="Abfragen" hinweis="unter den 2'000 mit dem grössten Flächenzuwachs" betont={e.anrufen > 0} />
        <Kennzahl wert={n(e.pruefen)} label="Prüfen" hinweis="lohnt sich, braucht einen zweiten Blick" />
        <Kennzahl wert={chf(data.margeSumme, 0)} label="Marge im Bestand" hinweis="über die 2'000 grössten, lagegerecht" />
        <Kennzahl wert={n(data.ohneEigentuemer)} label="Eigentümer fehlt" hinweis="der nächste Schritt ist die Abfrage" />
      </div>

      {/* Die knappste Ressource im Ablauf: fünf Grundbuchabfragen am Tag.
          Was einen Eigentümer hat, steht nicht mehr hier, sondern unter
          "Nummern". */}
      <Eigentuemersuche objekte={data.nachschlagen} />

      <Abschnitt titel="Wo es sich lohnt" zahl={data.topGemeinden.length || undefined}
        hinweis="Das Preisniveau je Gemeinde ist ein Erfahrungswert für die Reihenfolge, keine Schätzung.">
        {data.topGemeinden.length === 0 ? (
          <Leer titel="Noch keine Gemeinde mit Chancen.">Sobald Objekte bewertet sind, stehen hier die Gemeinden mit der grössten Marge.</Leer>
        ) : (
        <ul className={LISTE}>
          {data.topGemeinden.map(g => (
            <li key={g.gemeinde} className="flex items-center gap-4 px-5 py-4">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{g.gemeinde}</span>
                <span className="block text-sm text-muted-foreground">
                  {g.lage} · {g.chancen} Chancen{g.anrufen > 0 ? `, ${g.anrufen} zum Abfragen` : ''}
                </span>
              </span>
              <span className="shrink-0 font-semibold">{chf(g.margeSumme, 0)}</span>
            </li>
          ))}
        </ul>
        )}
      </Abschnitt>
    </div>
  );
}

function Kennzahl({ wert, label, hinweis, betont }: { wert: string; label: string; hinweis: string; betont?: boolean }) {
  return (
    <div className="rounded-2xl border bg-card p-5 sm:p-6">
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
      <p className={`mt-3 text-3xl font-bold tracking-tight sm:text-4xl ${betont ? 'text-accent' : ''}`}>{wert}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hinweis}</p>
    </div>
  );
}
