import { PhoneCall, Search, Building2, MapPin, Map, Camera, Loader2, TrendingUp, UserSearch } from 'lucide-react';
import { Objektansicht } from '@/components/Objektansicht';
import { Eigentuemersuche } from '@/components/Eigentuemersuche';
import { Card, CardContent } from '@/components/ui/card';
import { useCanton } from '@/hooks/use-canton';
import { Parzellensuche } from '@/components/Parzellensuche';
import { useUebersicht, type Chance } from '@/hooks/use-uebersicht';
import { EMPFEHLUNG_LABEL, type Empfehlung } from '@/lib/akquise';
import { zoneKurzform } from '@/lib/potential';

const chf = (v: number | null | undefined, stellen = 1) =>
  v == null ? '—' : `${(v / 1e6).toFixed(stellen)} Mio`;

const m2 = (v: number | null | undefined) =>
  v == null ? '—' : `${Math.round(v).toLocaleString('de-CH')} m²`;

const stil: Record<Empfehlung, string> = {
  anrufen:        'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  pruefen:        'bg-primary/12 text-primary border-primary/25',
  zurueckstellen: 'bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/25',
  nein:           'bg-muted text-muted-foreground border-border',
};

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
      <div className="grid min-h-[50vh] place-items-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Objekte werden beurteilt …</span>
        </div>
      </div>
    );
  }

  const e = data.nachEmpfehlung;

  return (
    <div className="space-y-8">
      {/* Ganz oben: am Telefon wird eine Nummer genannt, und dann muss
          das Grundstück da sein -- nicht erst nach drei Filtern. */}
      <Parzellensuche kanton={current} />
      <div>
        <h1 className="font-serif tracking-tight">Übersicht</h1>
        <p className="mt-1 text-muted-foreground">
          {data.total.toLocaleString('de-CH')} Objekte im Bestand ·{' '}
          {data.bewertet.toLocaleString('de-CH')} mit berechnetem Potenzial
        </p>
      </div>

      {/* Die vier Zahlen, an denen sich der Tag entscheidet */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kennzahl
          icon={<PhoneCall className="h-5 w-5" />}
          wert={e.anrufen.toLocaleString('de-CH')}
          label="Abfragen"
          hinweis="Potenzial, Eigentümer und Anlass sprechen dafür"
          betont
        />
        <Kennzahl
          icon={<Search className="h-5 w-5" />}
          wert={e.pruefen.toLocaleString('de-CH')}
          label="Prüfen"
          hinweis="Lohnt sich, braucht aber einen zweiten Blick"
        />
        <Kennzahl
          icon={<TrendingUp className="h-5 w-5" />}
          wert={chf(data.margeSumme, 0)}
          label="Marge im Bestand"
          hinweis="Summe über Abfragen und Prüfen, lagegerecht gerechnet"
        />
        <Kennzahl
          icon={<UserSearch className="h-5 w-5" />}
          wert={data.ohneEigentuemer.toLocaleString('de-CH')}
          label="Eigentümer fehlt"
          hinweis="Hier ist der nächste Schritt die Recherche"
        />
      </div>

      {/* Die knappste Ressource im Ablauf: fünf Grundbuchabfragen am Tag. */}
      <Eigentuemersuche objekte={data.nachschlagen} />

      {/* Was einen Eigentümer hat, steht nicht mehr hier, sondern im
          Akquise-Modus: dort wird die Nummer gesucht. Die Übersicht
          zeigt nur, was noch abzufragen ist. */}

      {/* Die zweite Liste zeigte dieselben Objekte wie die Liste oben:
          seit Objekte mit Eigentümer hier verschwinden, sind es
          dieselben. Zwei Listen desselben Inhalts sind eine zu viel. */}
      <div className="grid gap-6">
        {/* Wo sich die Chancen häufen */}
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b p-5">
              <MapPin className="h-4 w-4 text-primary" />
              <h2 className="font-serif">Wo es sich lohnt</h2>
            </div>
            <ul className="divide-y">
              {data.topGemeinden.map(g => (
                <li key={g.gemeinde} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{g.gemeinde}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.lage} · {g.chancen} Chancen
                      {g.anrufen > 0 ? `, davon ${g.anrufen} zum Abfragen` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{chf(g.margeSumme, 0)}</span>
                </li>
              ))}
            </ul>
            <p className="border-t p-4 text-xs leading-relaxed text-muted-foreground">
              Das Preisniveau je Gemeinde ist ein Erfahrungswert für die
              Priorisierung, keine Schätzung. Es steht in
              <code className="mx-1 rounded bg-muted px-1">gemeinden-zh.ts</code>
              und lässt sich mit euren Abschlüssen nachschärfen.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kennzahl({ icon, wert, label, hinweis, betont }: {
  icon: React.ReactNode; wert: string; label: string; hinweis: string; betont?: boolean;
}) {
  return (
    <Card className={betont ? 'ring-1 ring-emerald-500/25' : undefined}>
      <CardContent className="p-5">
        <div className={`flex items-center gap-2 ${betont ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
          {icon}
          <span className="text-sm font-medium">{label}</span>
        </div>
        <p className="mt-3 font-serif text-4xl tracking-tight tabular-nums">{wert}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{hinweis}</p>
      </CardContent>
    </Card>
  );
}
