import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink, UserSearch, Check, Archive } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { gemeindeBfsNr } from '@/lib/swisstopo';
import { grundbuchUrl, verkauftNie, ARCHIV_STATUS } from '@/lib/grundbuch';
import type { Chance } from '@/hooks/use-uebersicht';

/** Wie viele Auskünfte das Portal pro Tag freigibt. */
const PRO_TAG = 5;

const heute = () => new Date().toISOString().slice(0, 10);
const SCHLUESSEL = 'grundbuch.abfragen.';

function gezaehlt(): number {
  try {
    return Number(localStorage.getItem(SCHLUESSEL + heute()) || '0');
  } catch {
    return 0;
  }
}

function zaehlen() {
  try {
    localStorage.setItem(SCHLUESSEL + heute(), String(gezaehlt() + 1));
  } catch {
    /* Ohne Speicher zählt der Browser eben nicht mit. */
  }
}

/**
 * Die fünf Grundbuchabfragen des Tages.
 *
 * Das Portal des Kantons verlangt für jede Auskunft eine Bestätigung per
 * SMS und gibt fünf pro Tag frei. Damit ist die Eigentümerrecherche die
 * knappste Ressource im ganzen Ablauf -- und die Frage ist nicht mehr
 * "wie finde ich Eigentümer", sondern "welche fünf heute".
 *
 * Beantwortet wird sie nach der Marge: die wertvollsten Objekte ohne
 * bekannten Eigentümer zuerst. Der eingetragene Name wird gleich hier
 * gespeichert, damit der Weg über das Detailfenster entfällt; ist es die
 * öffentliche Hand, wandert das Objekt sofort ins Archiv.
 */
export function Eigentuemersuche({ objekte }: { objekte: Chance[] }) {
  const [verbraucht, setVerbraucht] = useState(gezaehlt);
  const [entwurf, setEntwurf] = useState<Record<string, string>>({});
  const [speichert, setSpeichert] = useState<string | null>(null);
  // In den importierten Daten fehlt die Gemeindenummer durchgehend, ohne sie
  // lässt sich das Grundstück im Portal nicht adressieren. Sie wird deshalb
  // einmal je Gemeinde nachgeschlagen, nicht einmal je Objekt.
  const [bfsNachGemeinde, setBfsNachGemeinde] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const qc = useQueryClient();

  const gemeinden = [...new Set(objekte.map(o => o.gemeinde).filter(Boolean) as string[])];
  const fehlend = gemeinden.filter(g => !(g in bfsNachGemeinde)).join('|');

  useEffect(() => {
    if (!fehlend) return;
    const ctrl = new AbortController();
    Promise.all(
      fehlend.split('|').map(g =>
        gemeindeBfsNr(g, ctrl.signal).then(nr => [g, nr] as const).catch(() => [g, null] as const)),
    ).then(paare => {
      if (ctrl.signal.aborted) return;
      setBfsNachGemeinde(v => {
        const neu = { ...v };
        for (const [g, nr] of paare) neu[g] = nr ?? '';
        return neu;
      });
    });
    return () => ctrl.abort();
  }, [fehlend]);

  if (objekte.length === 0) return null;

  const uebrig = Math.max(PRO_TAG - verbraucht, 0);

  const eintragen = async (c: Chance) => {
    const name = (entwurf[c.id] || '').trim();
    if (!name) return;
    setSpeichert(c.id);

    const oeffentlich = verkauftNie(name);
    const { error } = await supabase
      .from('properties')
      .update({
        owner_name: name,
        // Die öffentliche Hand verkauft nicht -- das Objekt ist erledigt,
        // sobald der Name feststeht.
        ...(oeffentlich
          ? {
              preselection_status: ARCHIV_STATUS,
              preselection_note: 'Öffentliche Hand als Eigentümerin — verkauft nicht',
              preselection_decided_at: new Date().toISOString(),
            }
          : {}),
      })
      .eq('id', c.id);

    setSpeichert(null);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return;
    }
    toast({
      title: oeffentlich ? '✓ Eingetragen und archiviert' : '✓ Eigentümer eingetragen',
      description: oeffentlich ? 'Öffentliche Hand — verkauft nicht' : name,
    });
    setEntwurf(e => ({ ...e, [c.id]: '' }));
    qc.invalidateQueries({ queryKey: ['uebersicht'] });
    qc.invalidateQueries({ queryKey: ['master'] });
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-3 border-b p-5">
          <div className="flex items-center gap-2">
            <UserSearch className="h-4 w-4 text-primary" />
            <h2 className="font-serif">Heute nachschlagen</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {uebrig} von {PRO_TAG} Abfragen übrig
          </span>
        </div>

        <p className="border-b px-5 py-3 text-xs leading-relaxed text-muted-foreground">
          Das Grundbuchportal bestätigt jede Auskunft per SMS und gibt fünf pro
          Tag frei. Hier stehen die fünf Objekte, bei denen sich das heute am
          meisten lohnt — grösste Marge, Eigentümer noch offen.
        </p>

        <ul className="divide-y">
          {objekte.map(c => {
            const bfs = c.bfsNr || (c.gemeinde ? bfsNachGemeinde[c.gemeinde] : '');
            const link = grundbuchUrl(c.egrid, bfs);
            return (
              <li key={c.id} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium leading-tight">{c.address}</p>
                    <p className="text-sm text-muted-foreground">
                      <span className="tabular-nums">
                        {c.parzelle ? `Parzelle ${c.parzelle}` : 'Parzelle unbekannt'}
                      </span>
                      {' · '}
                      {[c.plz, c.gemeinde].filter(Boolean).join(' ')}
                    </p>
                  </div>
                  <p className="shrink-0 text-right font-semibold tabular-nums">
                    {c.marge != null ? `${(c.marge / 1e6).toFixed(1)} Mio` : '—'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => { zaehlen(); setVerbraucht(gezaehlt()); }}
                    >
                      <Button size="sm" variant="outline">
                        <ExternalLink className="mr-1 h-3.5 w-3.5" /> Grundbuch öffnen
                      </Button>
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      EGRID oder Gemeindenummer fehlt
                    </span>
                  )}

                  <Input
                    value={entwurf[c.id] ?? ''}
                    onChange={e => setEntwurf(v => ({ ...v, [c.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') eintragen(c); }}
                    placeholder="Eigentümer aus dem Auszug einfügen"
                    className="h-9 min-w-[220px] flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={() => eintragen(c)}
                    disabled={!((entwurf[c.id] || '').trim()) || speichert === c.id}
                  >
                    {verkauftNie(entwurf[c.id] || '')
                      ? <><Archive className="mr-1 h-3.5 w-3.5" /> Archivieren</>
                      : <><Check className="mr-1 h-3.5 w-3.5" /> Eintragen</>}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
