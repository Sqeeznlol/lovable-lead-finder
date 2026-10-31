import { useEffect, useState } from 'react';
import { Search, Loader2, Map, User, Ruler } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useNachbarn } from '@/hooks/use-nachbarn';
import { useCanton } from '@/hooks/use-canton';

/**
 * Wem gehört nebenan.
 *
 * Das ist die erste Frage beim Arrondieren, und bis heute war sie
 * nicht beantwortbar: gespeichert waren nur EGRID, Adresse und
 * Gemeindenummer. Aus zwei Adressen an derselben Strasse lässt sich
 * nicht ableiten, ob die Grundstücke aneinandergrenzen.
 *
 * Als eigener Bereich und nicht als Abschnitt im Objektfenster: dort
 * war die Liste zwar da, aber man musste erst ein Objekt suchen, es
 * öffnen und nach unten scrollen -- und wenn die Parzelle keinen
 * Umriss hatte, sah man gar nichts.
 */
interface Treffer {
  id: string;
  parzelle: string | null;
  address: string;
  gemeinde: string | null;
  kanton: string | null;
  owner_name: string | null;
}

function flaeche(m2: number | null | undefined) {
  if (m2 == null) return null;
  return `${Math.round(m2).toLocaleString('de-CH')} m²`;
}

export function Nachbarschaft() {
  const { current: kanton } = useCanton();
  const [wort, setWort] = useState('');
  const [treffer, setTreffer] = useState<Treffer[]>([]);
  const [sucht, setSucht] = useState(false);
  const [gewaehlt, setGewaehlt] = useState<Treffer | null>(null);

  const { data, isLoading } = useNachbarn(gewaehlt?.id ?? null);

  useEffect(() => {
    const s = wort.trim();
    if (s.length < 2) { setTreffer([]); return; }

    // Erst tippen lassen, dann fragen -- sonst eine Abfrage je Zeichen.
    const zeit = setTimeout(async () => {
      setSucht(true);
      const sauber = s.replace(/[%,()]/g, '');
      let q = supabase
        .from('properties')
        .select('id, parzelle, address, gemeinde, kanton, owner_name')
        .or(
          `parzelle.eq.${sauber},plot_number.eq.${sauber},`
          + `egrid.ilike.%${sauber}%,address.ilike.%${sauber}%,`
          + `parzelle.ilike.${sauber}%`,
        )
        .limit(25);
      if (kanton) q = q.eq('kanton', kanton);
      const { data: d } = await q;
      setTreffer((d || []) as Treffer[]);
      setSucht(false);
    }, 300);
    return () => clearTimeout(zeit);
  }, [wort, kanton]);

  const nachbarn = data?.nachbarn ?? [];
  const mitEigentuemer = nachbarn.filter(n => n.owner_name).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
          <Map className="h-8 w-8 text-primary" />
          Nachbarschaft
        </h2>
        <p className="mt-1 text-muted-foreground">
          Welche Grundstücke grenzen an — und wem gehören sie
        </p>
      </div>

      <div className="relative">
        {sucht
          ? <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          : <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}
        <Input
          className="pl-10"
          placeholder={`Parzelle, Adresse oder EGRID in ${kanton} …`}
          value={wort}
          onChange={e => setWort(e.target.value)}
        />
      </div>

      {treffer.length > 0 && !gewaehlt && (
        <div className="divide-y rounded-2xl border">
          {treffer.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setGewaehlt(t); setTreffer([]); }}
              className="flex w-full items-baseline gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/50"
            >
              <span className="min-w-0 flex-1 truncate">
                {t.address}
                {t.gemeinde && <span className="text-muted-foreground"> · {t.gemeinde}</span>}
              </span>
              {t.parzelle && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  Parz. {t.parzelle}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {gewaehlt && (
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-serif text-lg">{gewaehlt.address}</p>
                <p className="text-sm text-muted-foreground">
                  {[gewaehlt.gemeinde, gewaehlt.parzelle && `Parzelle ${gewaehlt.parzelle}`]
                    .filter(Boolean).join(' · ')}
                </p>
                {gewaehlt.owner_name && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {gewaehlt.owner_name}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setGewaehlt(null); setWort(''); }}
                className="shrink-0 text-xs underline underline-offset-2 text-muted-foreground"
              >
                andere suchen
              </button>
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Nachbarn werden gesucht …
            </div>
          )}

          {/* Drei Faelle, und sie sind nicht dasselbe. Frueher erschien
              in den ersten beiden gar nichts -- dann sieht es aus, als
              gaebe es die Funktion nicht. */}
          {!isLoading && data && !data.umrissDa && (
            <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
              Für dieses Grundstück ist noch kein Umriss eingelesen. Ohne
              Umriss lässt sich nicht berechnen, was angrenzt — die
              amtliche Vermessung dieses Kantons ist noch nicht
              vollständig geladen.
            </p>
          )}

          {!isLoading && data?.umrissDa && nachbarn.length === 0 && (
            <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
              Keine angrenzenden Grundstücke im Bestand. Die Nachbarn
              liegen ausserhalb der geladenen Parzellen.
            </p>
          )}

          {nachbarn.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{nachbarn.length}</span>
                {nachbarn.length === 1 ? ' angrenzendes Grundstück' : ' angrenzende Grundstücke'}
                {mitEigentuemer > 0 && `, ${mitEigentuemer} mit bekanntem Eigentümer`}
              </p>

              <div className="divide-y rounded-2xl border">
                {nachbarn.map(n => (
                  <div key={n.id} className="px-4 py-3">
                    <div className="flex items-baseline gap-3">
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {n.address || `Parzelle ${n.parzelle ?? '?'}`}
                      </span>
                      {n.grenzlaenge_m != null && (
                        <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-muted-foreground">
                          <Ruler className="h-3 w-3" />
                          {Math.round(n.grenzlaenge_m)} m
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      {n.gemeinde && <span>{n.gemeinde}</span>}
                      {flaeche(n.area) && <span>{flaeche(n.area)}</span>}
                      {n.zone && <span className="truncate">{n.zone}</span>}
                    </div>
                    {n.owner_name
                      ? (
                        <p className="mt-1 flex items-center gap-1.5 text-sm">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          {n.owner_name}
                        </p>
                      )
                      : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Eigentümer noch nicht abgefragt
                        </p>
                      )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {!gewaehlt && wort.trim().length < 2 && (
        <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
          Ein Grundstück suchen — dann steht hier, was daran grenzt, wie
          lang die gemeinsame Grenze ist und wem es gehört. Sortiert nach
          der längsten Grenze: wer arrondieren will, interessiert sich für
          den Nachbarn, mit dem er sich eine halbe Parzellenbreite teilt,
          nicht für den, der die Ecke berührt.
        </p>
      )}
    </div>
  );
}
