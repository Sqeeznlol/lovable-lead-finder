import { useState } from 'react';
import { Calculator, Loader2, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import {
  calculatePotential,
  potentialScore,
  potentialTier,
  istAusgeschlossen,
  ausschlussGrund,
  type PotentialInput,
} from '@/lib/potential';

/** Felder, die für die Rechnung gebraucht werden. */
const LESEN =
  'id, address, zone, ausnuetzung, area, gebaeudeflaeche, geschosse, vollgeschosse, ' +
  'baujahr, renovationsjahr, denkmalschutz, isos, preselection_status';

const SEITE = 2000;   // Zeilen je Leseanfrage
const BLOCK = 500;    // Zeilen je Schreibanfrage

interface Stand {
  gelesen: number;
  geschrieben: number;
  total: number;
  ausgeschlossen: number;
  berechenbar: number;
  fehler: string[];
}

/**
 * Rechnet alle Kennzahlen im Browser neu und schreibt sie zurück.
 *
 * Dieselbe Rechnung liegt auch als Datenbankfunktion vor, die beim Import
 * greift. Wer die aktualisieren will, muss aber ein SQL-Skript einspielen --
 * und dafür braucht es Zugang zum SQL-Editor. Diese Schaltfläche kommt ohne
 * aus: sie liest die Rohdaten, rechnet hier und schreibt nur die
 * Ergebnisspalten zurück.
 *
 * Der Trigger in der Datenbank hängt an den Rohspalten (Zone, Fläche,
 * Geschosse). Da hier ausschliesslich Ergebnisspalten geschrieben werden,
 * löst das Zurückschreiben ihn nicht aus -- die Werte bleiben so, wie sie
 * hier berechnet wurden.
 */
export function Neuberechnung() {
  const [laeuft, setLaeuft] = useState(false);
  const [fertig, setFertig] = useState(false);
  const [stand, setStand] = useState<Stand>({
    gelesen: 0, geschrieben: 0, total: 0, ausgeschlossen: 0, berechenbar: 0, fehler: [],
  });
  const qc = useQueryClient();

  const rechnen = async () => {
    setLaeuft(true);
    setFertig(false);
    const s: Stand = { gelesen: 0, geschrieben: 0, total: 0, ausgeschlossen: 0, berechenbar: 0, fehler: [] };

    const { count } = await supabase
      .from('properties')
      .select('id', { count: 'exact', head: true });
    s.total = count || 0;
    setStand({ ...s });

    for (let von = 0; von < s.total; von += SEITE) {
      const { data, error } = await supabase
        .from('properties')
        .select(LESEN)
        .order('id')
        .range(von, von + SEITE - 1);

      if (error) {
        s.fehler.push(`Lesen ab Zeile ${von}: ${error.message}`);
        break;
      }
      if (!data?.length) break;
      s.gelesen += data.length;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates = (data as any[]).map(p => {
        const eingabe = p as PotentialInput;
        const r = calculatePotential(eingabe);
        const score = potentialScore(eingabe, undefined, r);
        const raus = istAusgeschlossen(eingabe);
        const grund = ausschlussGrund(eingabe);
        if (raus) s.ausgeschlossen++;
        else if (r.hnfDelta !== null) s.berechenbar++;

        return {
          id: p.id,
          address: p.address,
          bebaubar_m2: r.gfZulaessig !== null && r.az ? Math.round(r.gfZulaessig / r.az) : null,
          gf_zulaessig: r.gfZulaessig,
          gf_bestand: r.gfBestand,
          reserve_gf: r.reserveGf,
          reserve_quote: r.reserveQuote,
          hnf_faktor: 0.77,
          vollgeschosse_zulaessig: r.vollgeschosse,
          anrechenbare_geschosse: r.anrechenbareGeschosse,
          hnf_bestand: r.hnfBestand,
          hnf_neu: r.hnfNeu,
          hnf_delta: r.hnfDelta,
          hnf_schaetzung: r.hnfNeu,
          investition_chf: r.investition,
          erloes_chf: r.erloes,
          marge_chf: r.marge,
          marge_quote: r.margeQuote,
          potenzial_score: score,
          score_tier: potentialTier(score),
          confidence: r.confidence,
          score_killers: r.killer,
          score_reasons: r.assumptions,
          az_quelle: r.azQuelle,
          ausgeschlossen: raus,
          ausschluss_grund: grund,
          // Nur setzen, solange niemand von Hand entschieden hat
          preselection_status:
            raus && p.preselection_status === 'Nicht geprüft'
              ? 'Ausschliessen'
              : p.preselection_status,
          scored_at: new Date().toISOString(),
        };
      });

      for (let i = 0; i < updates.length; i += BLOCK) {
        const teil = updates.slice(i, i + BLOCK);
        const { error: e2 } = await supabase
          .from('properties')
          .upsert(teil as never, { onConflict: 'id' });
        if (e2) s.fehler.push(`Schreiben ab Zeile ${von + i}: ${e2.message}`);
        else s.geschrieben += teil.length;
      }

      setStand({ ...s });
    }

    setStand({ ...s });
    setLaeuft(false);
    setFertig(true);
    qc.invalidateQueries({ queryKey: ['properties'] });
    qc.invalidateQueries({ queryKey: ['master'] });
  };

  const anteil = stand.total ? Math.round((stand.geschrieben / stand.total) * 100) : 0;

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Calculator className="mt-0.5 h-5 w-5 text-primary" />
          <div className="flex-1">
            <h3 className="font-semibold">Kennzahlen neu berechnen</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Rechnet Ausnützung, bebaubare Fläche, Reserve, HNF, Investition und
              Marge für alle Objekte neu — mit der aktuellen Formel. Nötig, wenn
              sich die Rechnung geändert hat oder Objekte ohne Kennzahlen in der
              Liste stehen. Bestehende Entscheide, Notizen und Eigentümer bleiben
              unangetastet.
            </p>
          </div>
        </div>

        {(laeuft || fertig) && (
          <div className="space-y-2">
            <Progress value={anteil} className="h-2" />
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <span>
                {stand.geschrieben.toLocaleString('de-CH')} / {stand.total.toLocaleString('de-CH')} Objekte
              </span>
              <span>{stand.berechenbar.toLocaleString('de-CH')} mit Potenzial</span>
              <span>{stand.ausgeschlossen.toLocaleString('de-CH')} ausgeschlossen</span>
            </div>
            {stand.fehler.length > 0 && (
              <ul className="space-y-0.5">
                {stand.fehler.slice(0, 3).map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <Button onClick={rechnen} disabled={laeuft} className="gap-2">
          {laeuft ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Rechnet … {anteil}%</>
          ) : fertig ? (
            <><Check className="h-4 w-4" /> Nochmal rechnen</>
          ) : (
            <><Calculator className="h-4 w-4" /> Jetzt neu berechnen</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
