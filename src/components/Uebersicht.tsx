import { PhoneCall, Search, Building2, MapPin, Map, Camera, Loader2, TrendingUp, UserSearch } from 'lucide-react';
import { Objektansicht } from '@/components/Objektansicht';
import { Eigentuemersuche } from '@/components/Eigentuemersuche';
import { Card, CardContent } from '@/components/ui/card';
import { useCanton } from '@/hooks/use-canton';
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
          label="Anrufen"
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
          hinweis="Summe über Anrufen und Prüfen, lagegerecht gerechnet"
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

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Konkrete Adressen */}
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b p-5">
              <Building2 className="h-4 w-4 text-primary" />
              <h2 className="font-serif">Die nächsten Anrufe</h2>
            </div>
            <ul className="divide-y">
              {data.topChancen.map((c: Chance) => (
                <li key={c.id} className="flex items-start gap-4 p-4 transition-colors hover:bg-muted/40">
                  {/* Drei Blicke auf dasselbe Grundstück, umschaltbar:
                      von oben, mit den Bauzonen darüber, und von der
                      Strasse. Die Zonenansicht beantwortet die Frage, an der
                      die ganze Rechnung hängt -- reicht die Bauzone über die
                      ganze Parzelle oder nur über einen Teil. */}
                  <Objektansicht
                    address={c.address}
                    plzOrt={[c.plz, c.gemeinde].filter(Boolean).join(' ') || null}
                    parzelle={c.parzelle}
                    bfsNr={c.bfsNr}
                    gemeinde={c.gemeinde}
                    className="hidden h-36 w-52 shrink-0 sm:block"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <span className={`mt-0.5 shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${stil[c.empfehlung]}`}>
                        {EMPFEHLUNG_LABEL[c.empfehlung]}
                      </span>
                      <p className="min-w-0 font-medium leading-tight">{c.address}</p>
                    </div>

                    {/* Die Parzellennummer steht zuoberst, weil ohne sie weder
                        das Grundbuch noch das GIS weiterhilft -- und ein Anruf
                        ohne diese Nummer führt zu nichts. */}
                    <p className="mt-1 text-sm">
                      <span className="font-medium tabular-nums">
                        {c.parzelle ? `Parzelle ${c.parzelle}` : 'Parzelle unbekannt'}
                      </span>
                      <span className="text-muted-foreground">
                        {' · '}{[c.plz, c.gemeinde].filter(Boolean).join(' ')}
                        {c.baujahr ? ` · Baujahr ${c.baujahr}` : ''}
                      </span>
                    </p>
                    {c.egrid && (
                      <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{c.egrid}</p>
                    )}

                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {c.eigentuemer ?? 'Eigentümer unbekannt'}
                      {c.telefon ? (
                        <>
                          {' · '}
                          <a
                            href={`tel:${c.telefon.replace(/\s/g, '')}`}
                            className="tabular-nums text-primary hover:underline"
                          >
                            {c.telefon}
                          </a>
                        </>
                      ) : (
                        ' · keine Nummer'
                      )}
                    </p>

                    {/* Die Zahlen, aus denen die Empfehlung entsteht. Ohne sie
                        ist die Marge eine Behauptung; mit ihnen lässt sie sich
                        am Telefon vertreten. */}
                    <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {c.zone && (
                        <div className="flex gap-1"><dt>Zone</dt><dd className="text-foreground">{zoneKurzform(c.zone) ?? c.zone}</dd></div>
                      )}
                      {c.bebaubar != null && (
                        <div className="flex gap-1"><dt>Bauzone</dt><dd className="tabular-nums text-foreground">{m2(c.bebaubar)}</dd></div>
                      )}
                      {c.az != null && (
                        <div className="flex gap-1"><dt>AZ</dt><dd className="tabular-nums text-foreground">{c.az}</dd></div>
                      )}
                      {c.geschosse != null && (
                        <div className="flex gap-1"><dt>Geschosse</dt><dd className="tabular-nums text-foreground">{c.geschosse}</dd></div>
                      )}
                      {c.hnfNeu != null && (
                        <div className="flex gap-1">
                          <dt>HNF</dt>
                          <dd className="tabular-nums text-foreground">
                            {m2(c.hnfBestand)} → {m2(c.hnfNeu)}
                          </dd>
                        </div>
                      )}
                      {c.kategorie && (
                        <div className="flex gap-1"><dt>Art</dt><dd className="text-foreground">{c.kategorie}</dd></div>
                      )}
                    </dl>

                    {c.dafuer.length > 0 && (
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        {c.dafuer.slice(0, 2).join(' · ')}
                      </p>
                    )}

                    {/* Drei Blicke auf dasselbe Grundstück: von der Strasse,
                        von oben, und der amtliche Zonenplan. */}
                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          [c.address, c.plz, c.gemeinde].filter(Boolean).join(' ') + ' Schweiz',
                        )}&layer=c`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                      >
                        <Camera className="h-3 w-3" /> Street View
                      </a>
                      {c.mapsUrl && (
                        <a href={c.mapsUrl} target="_blank" rel="noreferrer"
                           className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                          <MapPin className="h-3 w-3" /> Google Maps
                        </a>
                      )}
                      {c.gisUrl && (
                        <a href={c.gisUrl} target="_blank" rel="noreferrer"
                           className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                          <Map className="h-3 w-3" /> GIS Kanton
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums">{chf(c.marge)}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">+{m2(c.hnfDelta)} HNF</p>
                  </div>
                </li>
              ))}
              {data.topChancen.length === 0 && (
                <li className="p-8 text-center text-muted-foreground">
                  Noch keine Kennzahlen berechnet. Unter Admin einmal
                  «Jetzt neu berechnen» ausführen.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

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
                      {g.anrufen > 0 ? `, davon ${g.anrufen} zum Anrufen` : ''}
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
