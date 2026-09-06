import { useEffect, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { PropertyDetailDialog } from '@/components/PropertyDetailDialog';

interface Treffer {
  id: string;
  parzelle: string | null;
  address: string;
  plz: string | null;
  gemeinde: string | null;
  kanton: string | null;
  egrid: string | null;
  owner_name: string | null;
}

/**
 * Ein Grundstück heraussuchen.
 *
 * Am Telefon nennt jemand eine Parzellennummer, und dann muss das
 * Objekt in zwei Sekunden auf dem Schirm sein -- nicht über Filter,
 * Sortierung und Seitenzahl der Masterliste.
 *
 * Gesucht wird über Parzelle, EGRID und Adresse zugleich, weil vorher
 * niemand weiss, was er gerade in der Hand hat. Die Parzellennummer
 * zuerst und mit genauem Treffer: "454" soll Parzelle 454 finden und
 * nicht die 4540 obenan stellen.
 *
 * Ohne Kanton wäre die Nummer mehrdeutig -- Parzelle 454 gibt es in
 * jeder Gemeinde. Der Kanton steht deshalb in jeder Zeile.
 */
export function Parzellensuche({ kanton }: { kanton?: string | null }) {
  const [wort, setWort] = useState('');
  const [treffer, setTreffer] = useState<Treffer[]>([]);
  const [sucht, setSucht] = useState(false);
  const [offen, setOffen] = useState<string | null>(null);

  useEffect(() => {
    const s = wort.trim();
    if (s.length < 2) { setTreffer([]); return; }

    // Erst tippen lassen, dann fragen -- sonst eine Abfrage je Zeichen.
    const zeit = setTimeout(async () => {
      setSucht(true);
      const felder = 'id, parzelle, address, plz, gemeinde, kanton, egrid, owner_name';
      const sauber = s.replace(/[%,()]/g, '');
      let q = supabase
        .from('properties')
        .select(felder)
        .or(
          `parzelle.eq.${sauber},plot_number.eq.${sauber},`
          + `egrid.ilike.%${sauber}%,address.ilike.%${sauber}%,`
          + `parzelle.ilike.${sauber}%`,
        )
        .limit(25);
      if (kanton) q = q.eq('kanton', kanton);
      const { data } = await q;
      setTreffer((data || []) as Treffer[]);
      setSucht(false);
    }, 300);
    return () => clearTimeout(zeit);
  }, [wort, kanton]);

  return (
    <div className="rounded-2xl border bg-card">
      <div className="relative">
        {sucht
          ? <Loader2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          : <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}
        <Input
          value={wort}
          onChange={e => setWort(e.target.value)}
          placeholder="Parzelle, EGRID oder Adresse suchen …"
          className="h-12 border-0 bg-transparent pl-10 text-base focus-visible:ring-0"
        />
      </div>

      {treffer.length > 0 && (
        <ul className="max-h-80 divide-y overflow-auto border-t">
          {treffer.map(t => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => setOffen(t.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{t.address}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {[t.parzelle ? `Parz. ${t.parzelle}` : null,
                      [t.plz, t.gemeinde].filter(Boolean).join(' '),
                      t.kanton].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t.owner_name || 'Eigentümer offen'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {wort.trim().length >= 2 && !sucht && treffer.length === 0 && (
        <p className="border-t px-4 py-3 text-sm text-muted-foreground">
          Nichts gefunden{kanton ? ` im Kanton ${kanton}` : ''}.
        </p>
      )}

      <PropertyDetailDialog id={offen} onClose={() => setOffen(null)} />
    </div>
  );
}
