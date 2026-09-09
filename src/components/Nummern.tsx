import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Phone, ExternalLink, Loader2, Check } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useOffeneNummern } from '@/hooks/use-properties';
import { weiterverarbeiten } from '@/hooks/use-eigentuemer-lookup';
import { Objektansicht } from '@/components/Objektansicht';

/**
 * Der Zwischenstand, an dem die Kette hängt.
 *
 * Nach der Abfrage steht der Eigentümer fest, die Nummer nicht immer.
 * Diese Objekte lagen bisher im Akquise-Modus zwischen allem anderen
 * -- und wer sie suchte, fand sie nicht. Sie brauchen einen eigenen
 * Ort, weil hier genau eine Frage offen ist und die Antwort ein Feld
 * lang ist.
 *
 * Steht die Nummer, geht der Deal nach Pipedrive, Akquise, Phase
 * "Neu", und die Zeile verschwindet. Das ist die ganze Rubrik.
 */
export function Nummern() {
  const { data, isLoading } = useOffeneNummern(200);
  const [entwurf, setEntwurf] = useState<Record<string, string>>({});
  const [speichert, setSpeichert] = useState<string | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const eintragen = async (id: string, adresse: string) => {
    const nummer = (entwurf[id] || '').trim();
    if (!nummer) return;
    setSpeichert(id);

    const { error } = await supabase
      .from('properties')
      .update({ owner_phone: nummer, phone_search_status: 'found' })
      .eq('id', id);

    if (error) {
      setSpeichert(null);
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return;
    }

    // Von hier an dasselbe wie nach einer gefundenen Nummer: Deal
    // anlegen, Objekt ablegen. Kein zweiter Knopf.
    await weiterverarbeiten(id, toast);
    setSpeichert(null);
    setEntwurf(e => ({ ...e, [id]: '' }));
    qc.invalidateQueries({ queryKey: ['properties'] });
    qc.invalidateQueries({ queryKey: ['uebersicht'] });
    qc.invalidateQueries({ queryKey: ['master'] });
    toast({ title: '📞 Nummer eingetragen', description: adresse });
  };

  if (isLoading) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const offen = data || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif tracking-tight">Nummern</h1>
        <p className="mt-1 text-muted-foreground">
          Eigentümer steht fest, die Telefonnummer fehlt. Sobald sie hier
          steht, entsteht der Deal in Pipedrive — Akquise, Phase „Neu".
        </p>
      </div>

      {offen.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Nichts offen. Alles, was einen Eigentümer hat, hat auch eine
            Nummer.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-2 border-b p-5">
              <Phone className="h-4 w-4 text-primary" />
              <h2 className="font-serif">Nummer gesucht</h2>
              <span className="ml-auto text-xs text-muted-foreground">
                {offen.length}
              </span>
            </div>

            <ul className="divide-y">
              {offen.map(p => {
                const name = p.owner_name || '';
                const ort = p.plz_ort || [p.plz, p.gemeinde].filter(Boolean).join(' ');
                return (
                  <li key={p.id} className="flex flex-wrap items-start gap-4 p-4">
                    <Objektansicht
                      address={p.address}
                      plzOrt={ort}
                      parzelle={p.parzelle}
                      bfsNr={p.bfs_nr}
                      gemeinde={p.gemeinde}
                      kanton={p.kanton}
                      className="hidden h-24 w-36 shrink-0 sm:block"
                    />

                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium leading-tight">{p.address}</p>
                      <p className="text-sm text-muted-foreground">
                        {p.parzelle ? `Parzelle ${p.parzelle} · ` : ''}{ort}
                        {p.marge_chf ? ` · ${(p.marge_chf / 1e6).toFixed(1)} Mio` : ''}
                      </p>

                      {/* Der Eigentümer mit seiner Adresse: mit beidem
                          zusammen findet man die Nummer, mit dem Namen
                          allein selten. */}
                      <p className="text-sm">
                        <span className="font-medium">{name}</span>
                        {p.owner_address && (
                          <span className="text-muted-foreground"> · {p.owner_address}</span>
                        )}
                      </p>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <a
                          href={`https://tel.search.ch/?was=${encodeURIComponent(name)}${
                            p.owner_address ? `&wo=${encodeURIComponent(p.owner_address)}` : ''}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Button size="sm" variant="outline">
                            <ExternalLink className="mr-1 h-3.5 w-3.5" /> tel.search.ch
                          </Button>
                        </a>
                        <a
                          href={`https://www.google.com/search?q=${encodeURIComponent(
                            `${name} ${p.owner_address ?? ''} Telefon`)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Button size="sm" variant="outline">
                            <ExternalLink className="mr-1 h-3.5 w-3.5" /> Google
                          </Button>
                        </a>
                        {/* Firmen stehen im Handelsregister, Private nicht. */}
                        {/\b(AG|GmbH|SA|Sàrl|Genossenschaft|Stiftung)\b/.test(name) && (
                          <a
                            href={`https://www.zefix.ch/de/search/entity/list?name=${encodeURIComponent(name)}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Button size="sm" variant="outline">
                              <ExternalLink className="mr-1 h-3.5 w-3.5" /> Zefix
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex w-full items-center gap-2 sm:w-auto">
                      <Input
                        value={entwurf[p.id] ?? ''}
                        onChange={e => setEntwurf(v => ({ ...v, [p.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') eintragen(p.id, p.address); }}
                        placeholder="079 123 45 67"
                        className="h-9 w-full sm:w-44"
                      />
                      <Button
                        size="sm"
                        onClick={() => eintragen(p.id, p.address)}
                        disabled={!((entwurf[p.id] || '').trim()) || speichert === p.id}
                      >
                        {speichert === p.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <><Check className="mr-1 h-3.5 w-3.5" /> Eintragen</>}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
