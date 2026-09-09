import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Send, ExternalLink, Archive } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useBereitFuerPipedrive, useUebertragen } from '@/hooks/use-properties';

/**
 * Die fertigen Leads, bereit für Pipedrive.
 *
 * Eigentümer und Nummer stehen fest, eine Deal-Nummer gibt es noch
 * nicht. Bisher war dieser Zustand unsichtbar: die Objekte verliessen
 * "Nummern" und tauchten in Pipedrive wieder auf -- wenn der Push
 * gelang. Ging er schief, wie tagelang wegen des fehlenden Tokens,
 * lagen sie dazwischen und niemand sah sie.
 *
 * Hier stehen sie, mit allem, was ein Anruf braucht, und einem Knopf.
 */
export function PipedriveBereit() {
  const { data, isLoading, refetch } = useBereitFuerPipedrive(200);
  const { data: archiv, refetch: archivNeu } = useUebertragen(30);
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [laeuft, setLaeuft] = useState(false);
  const [ergebnis, setErgebnis] = useState<string[]>([]);
  const { toast } = useToast();
  const qc = useQueryClient();

  const bereit = data ?? [];
  const alle = gewaehlt.size > 0 && gewaehlt.size === bereit.length;

  const umschalten = (id: string) => setGewaehlt(v => {
    const neu = new Set(v);
    if (neu.has(id)) neu.delete(id); else neu.add(id);
    return neu;
  });

  const pushen = async () => {
    const objekte = bereit.filter(p => gewaehlt.has(p.id));
    if (objekte.length === 0) return;
    setLaeuft(true);
    setErgebnis([]);

    const meldungen: string[] = [];
    // In Häppchen von zehn: die Funktion legt je Objekt Organisation,
    // Person, Deal und Notiz an -- vier Anfragen an Pipedrive. Fünfzig
    // auf einmal liefen in die Zeitgrenze.
    for (let i = 0; i < objekte.length; i += 10) {
      const teil = objekte.slice(i, i + 10);
      const { data: push, error } = await supabase.functions.invoke(
        'pipedrive-push', { body: { properties: teil } });

      if (error) {
        let grund = String(error.message || error);
        try {
          const antwort = (error as { context?: Response }).context;
          if (antwort?.text) grund += ` — ${(await antwort.text()).slice(0, 200)}`;
        } catch { /* dann eben ohne */ }
        meldungen.push(`${teil.length} Objekte: ${grund}`);
        continue;
      }

      for (const r of (push?.results ?? [])) {
        const objekt = teil.find(t => t.id === r.propertyId);
        const wo = objekt?.address ?? r.propertyId;
        if (r.dealId) {
          await supabase.from('properties').update({
            is_queried: true,
            status: 'Exportiert',
            last_export_at: new Date().toISOString(),
            pipedrive_deal_id: String(r.dealId),
          }).eq('id', r.propertyId);
          meldungen.push(`✓ ${wo} → Deal ${r.dealId}`);
        } else if (r.skipped) {
          // Schon vorhanden: dann ist hier nichts mehr zu tun, aber
          // das Objekt darf nicht ewig in dieser Liste stehen.
          await supabase.from('properties').update({
            is_queried: true, status: 'Exportiert',
          }).eq('id', r.propertyId);
          meldungen.push(`— ${wo}: stand schon in Pipedrive`);
        } else {
          meldungen.push(`✗ ${wo}: ${r.error ?? 'kein Deal entstanden'}`);
        }
      }
    }

    setErgebnis(meldungen);
    setGewaehlt(new Set());
    setLaeuft(false);
    await refetch();
    await archivNeu();
    qc.invalidateQueries({ queryKey: ['uebersicht'] });
    qc.invalidateQueries({ queryKey: ['master'] });
    toast({
      title: `${meldungen.filter(m => m.startsWith('✓')).length} Deals angelegt`,
      description: meldungen.some(m => m.startsWith('✗'))
        ? 'Nicht alles ging durch — die Liste unten sagt, was.'
        : undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif tracking-tight">Pipedrive</h1>
        <p className="mt-1 text-muted-foreground">
          Fertige Leads: Eigentümer und Nummer stehen fest, der Deal fehlt
          noch. Übertragen wird nach Akquise, Phase „Neu".
        </p>
      </div>

      {ergebnis.length > 0 && (
        <Card>
          <CardContent className="space-y-1 p-5 text-sm">
            {ergebnis.map((m, i) => (
              <p key={i} className={m.startsWith('✗') ? 'text-destructive' : ''}>{m}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {bereit.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Nichts bereit. Was einen Eigentümer und eine Nummer hat, steht
            schon in Pipedrive.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center gap-3 border-b p-5">
              <Checkbox
                checked={alle}
                onCheckedChange={() => setGewaehlt(
                  alle ? new Set() : new Set(bereit.map(p => p.id)))}
              />
              <h2 className="font-serif">Bereit für Pipedrive</h2>
              <span className="text-xs text-muted-foreground">
                {gewaehlt.size > 0 ? `${gewaehlt.size} von ${bereit.length} gewählt` : bereit.length}
              </span>
              <Button
                className="ml-auto"
                onClick={pushen}
                disabled={gewaehlt.size === 0 || laeuft}
              >
                {laeuft
                  ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Überträgt …</>
                  : <><Send className="mr-1 h-4 w-4" /> {gewaehlt.size || ''} nach Pipedrive</>}
              </Button>
            </div>

            <ul className="divide-y">
              {bereit.map(p => (
                <li key={p.id} className="flex items-start gap-3 p-4">
                  <Checkbox
                    className="mt-1"
                    checked={gewaehlt.has(p.id)}
                    onCheckedChange={() => umschalten(p.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-tight">{p.address}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.parzelle ? `Parzelle ${p.parzelle} · ` : ''}
                      {p.plz_ort || [p.plz, p.gemeinde].filter(Boolean).join(' ')}
                      {p.kanton ? ` · ${p.kanton}` : ''}
                      {p.marge_chf ? ` · ${(p.marge_chf / 1e6).toFixed(1)} Mio` : ''}
                    </p>
                    <p className="mt-1 text-sm">
                      <span className="font-medium">{p.owner_name}</span>
                      <span className="text-muted-foreground"> · {p.owner_phone}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
