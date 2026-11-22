import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNachbarn } from '@/hooks/use-nachbarn';
import { useCanton } from '@/hooks/use-canton';
import { useUrlWert } from '@/hooks/use-url-wert';
import { FELD, KNOPF_LEISE, LISTE } from '@/components/rahmen';
import { ObjektLink } from '@/components/ObjektLink';

/**
 * Wem gehört nebenan: die Nachbarn einer beliebigen Parzelle, mit der
 * Länge der gemeinsamen Grenze und dem Eigentümer, soweit abgefragt.
 *
 * Seit dem 22. November ein Teil des Reiters «Arrondierung» (Julian:
 * «mach Nachbarschaft und Arrondierung zusammen»): dort oben die Suche
 * für jede Parzelle, darunter die Liegenschaften der Kundenfonds. Die
 * gewählte Parzelle steht in der Adresse (?nachbarn=...), damit
 * «Zurück» im Browser zur Suche führt und sich der Link weitergeben lässt.
 *
 * Gerechnet ist die Nachbarschaft vorab (Ablauf «Nachbarschaft», auf dem
 * Runner); hier wird nur nachgeschlagen (use-nachbarn.ts).
 */
interface Treffer {
  id: string;
  parzelle: string | null;
  address: string;
  gemeinde: string | null;
  kanton: string | null;
  owner_name: string | null;
}

const SPALTEN = 'id, parzelle, address, gemeinde, kanton, owner_name';
const flaeche = (m2: number | null | undefined) => (m2 == null ? null : `${Math.round(m2).toLocaleString('de-CH')} m²`);

export function NachbarnSuche() {
  const { current: kanton } = useCanton();
  const [id, setId] = useUrlWert('nachbarn');
  const [wort, setWort] = useState('');
  const [treffer, setTreffer] = useState<Treffer[]>([]);
  const [sucht, setSucht] = useState(false);

  // Die gewählte Parzelle kommt aus der Adresse; ihre Angaben werden einzeln geholt.
  const gewaehlt = useQuery({
    queryKey: ['nachbarn-parzelle', id],
    enabled: !!id,
    queryFn: async (): Promise<Treffer | null> => {
      const { data } = await supabase.from('properties').select(SPALTEN).eq('id', id!).maybeSingle();
      return (data as Treffer | null) ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
  const { data, isLoading } = useNachbarn(id || null);

  useEffect(() => {
    const s = wort.trim();
    if (s.length < 2) { setTreffer([]); return; }
    // Erst tippen lassen, dann fragen -- sonst eine Abfrage je Zeichen.
    const zeit = setTimeout(async () => {
      setSucht(true);
      const sauber = s.replace(/[%,()]/g, '');
      let q = supabase
        .from('properties')
        .select(SPALTEN)
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

  const waehlen = (t: Treffer) => { setTreffer([]); setWort(''); setId(t.id); };
  const nachbarn = data?.nachbarn ?? [];

  if (!id) {
    return (
      <div className="space-y-3">
        <label className="relative block">
          <span className="sr-only">Parzelle suchen</span>
          {sucht
            ? <Loader2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            : <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}
          <input className={`${FELD} w-full pl-10`} value={wort} onChange={e => setWort(e.target.value)}
                 placeholder={`Parzelle, Adresse oder EGRID${kanton ? ` in ${kanton}` : ''}`} enterKeyHint="search" />
        </label>
        {treffer.length > 0 && (
          <ul className={LISTE}>
            {treffer.map(t => (
              <li key={t.id}>
                <button type="button" onClick={() => waehlen(t)}
                        className="flex min-h-11 w-full items-baseline justify-between gap-3 px-4 py-3 text-left hover:bg-secondary/60">
                  <span className="min-w-0 truncate">{t.address}{t.gemeinde && <span className="text-muted-foreground"> · {t.gemeinde}</span>}</span>
                  {t.parzelle && <span className="shrink-0 text-xs text-muted-foreground">Parzelle {t.parzelle}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {wort.trim().length >= 2 && !sucht && !treffer.length && (
          <p className="text-sm text-muted-foreground">Keine Parzelle gefunden{kanton ? ` in ${kanton}` : ''}.</p>
        )}
      </div>
    );
  }

  const p = gewaehlt.data;
  const mitEigentuemer = nachbarn.filter(n => n.owner_name).length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded border bg-card p-4">
        <span className="min-w-0">
          {p ? <ObjektLink id={p.id} className="relative -my-2.5 block py-2.5 text-[16px] font-medium">{p.address}</ObjektLink>
            : <span className="block text-[16px] font-medium">{gewaehlt.isLoading ? 'Parzelle wird geladen …' : 'Parzelle nicht gefunden'}</span>}
          {p && <span className="block text-sm text-muted-foreground">{[p.gemeinde, p.parzelle && `Parzelle ${p.parzelle}`, p.owner_name].filter(Boolean).join(' · ')}</span>}
        </span>
        <button type="button" className={KNOPF_LEISE} onClick={() => setId(null)}>Andere Parzelle</button>
      </div>

      {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Nachbarn werden gesucht …</p>}
      {/* Drei Fälle, und sie sind nicht dasselbe: kein Umriss geladen,
          Umriss da aber ohne Nachbarn im Bestand, oder Nachbarn. */}
      {!isLoading && data && !data.umrissDa && (
        <p className="text-sm text-muted-foreground">Für diese Parzelle ist noch kein Umriss eingelesen; ohne Umriss lässt sich nicht rechnen, was angrenzt.</p>
      )}
      {!isLoading && data?.umrissDa && !nachbarn.length && (
        <p className="text-sm text-muted-foreground">Keine angrenzende Parzelle im Bestand; die Nachbarn liegen ausserhalb der geladenen Parzellen.</p>
      )}
      {nachbarn.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {nachbarn.length} {nachbarn.length === 1 ? 'Nachbar' : 'Nachbarn'}{mitEigentuemer ? `, ${mitEigentuemer} mit bekanntem Eigentümer` : ''}. Die längste gemeinsame Grenze zuerst.
          </p>
          <ul className={LISTE}>
            {nachbarn.map(n => (
              <li key={n.id} className="flex items-start justify-between gap-4 p-4">
                <span className="min-w-0">
                  <ObjektLink id={n.id} className="relative -my-2.5 block py-2.5 font-medium">{n.address || `Parzelle ${n.parzelle ?? '?'}`}</ObjektLink>
                  <span className="block text-sm text-muted-foreground">{[n.gemeinde, flaeche(n.area), n.zone].filter(Boolean).join(' · ')}</span>
                  <span className={`block text-sm ${n.owner_name ? '' : 'text-muted-foreground'}`}>{n.owner_name ?? 'Eigentümer noch nicht abgefragt'}</span>
                </span>
                {n.grenzlaenge_m != null && (
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="block font-medium">{Math.round(n.grenzlaenge_m)} m</span>
                    <span className="block text-xs text-muted-foreground">Grenze</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
