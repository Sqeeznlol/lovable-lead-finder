import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { leseAuskunft } from '@/lib/eigentuemer';
import { weiterverarbeiten } from '@/hooks/use-eigentuemer-lookup';
import { protokolliere } from '@/lib/protokoll';
import { useAuth } from '@/hooks/use-auth';
import { naechsteParzelle, naechsteAdresse } from '@/lib/naechste';
import { FENSTER, oeffne } from '@/lib/fenster';

/**
 * Nimmt entgegen, was das Lesezeichen aus dem Portal mitbringt.
 *
 * Die Daten stehen hinter der Raute in der Adresse. Das ist Absicht:
 * alles hinter "#" schickt der Browser nicht an den Server, es bleibt
 * hier. Gespeichert wird mit der angemeldeten Sitzung -- das
 * Lesezeichen selbst trägt keinen Schlüssel.
 *
 * Zugeordnet wird über die EGRID. Sie steht im Auszug und ist
 * schweizweit eindeutig; über die Adresse wäre es geraten.
 */
export function AuskunftAusLesezeichen() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const laeuft = useRef<string | null>(null);
  const { user, loading } = useAuth();
  // Eine Meldung, die wieder verschwindet, taugt hier nicht: der Tag
  // geht auf, etwas geschieht -- oder eben nicht --, und man sieht
  // nichts mehr. Der Stand bleibt stehen, bis man ihn wegklickt.
  const [stand, setStand] = useState<{ art: 'lauft' | 'gut' | 'fehler'; text: string } | null>(null);

  useEffect(() => {
    // Beim zweiten Mal ist dieser Tag schon offen. Dann laedt nichts
    // neu, es wechselt nur der Teil hinter der Raute -- und wer nur
    // beim Laden hinsieht, sieht diesen zweiten Auszug nie. Genau so
    // blieb der Balken beim ersten Eigentuemer stehen, waehrend oben
    // schon der zweite in der Adresse stand.
    const verarbeite = () => {
    const hash = window.location.hash;
    if (!hash.startsWith('#auskunft=')) return;
    // Erst anmelden lassen: ohne Sitzung liest die Datenbank nichts,
    // und der Auszug waere verloren.
    if (loading) return;
    if (!user) {
      setStand({ art: 'fehler', text: 'Nicht angemeldet — bitte anmelden, dann nochmals übernehmen.' });
      return;
    }
    // Der Riegel gilt fuer diesen einen Auszug, nicht fuer alle
    // folgenden: sonst ist nach dem ersten fuer immer zu.
    if (laeuft.current === hash) return;
    laeuft.current = hash;
    setStand({ art: 'lauft', text: 'Auskunft wird übernommen …' });

    (async () => {
      let daten: { text?: string; egrid?: string; parzelle?: string };
      try {
        daten = JSON.parse(decodeURIComponent(hash.slice('#auskunft='.length)));
      } catch {
        setStand({ art: 'fehler', text: 'Auskunft unleserlich.' });
        return;
      }
      // Die Adresse aufräumen, damit ein Neuladen nicht alles wiederholt.
      window.history.replaceState(null, '', window.location.pathname);

      const gelesen = leseAuskunft(daten.text || '');
      if (gelesen.length === 0) {
        setStand({ art: 'fehler', text: 'Keine Eigentümer erkannt — im Portal die Zeilen markieren und nochmals klicken.' });
        return;
      }

      if (!daten.egrid) {
        setStand({ art: 'fehler', text: `${gelesen[0].name} — keine EGRID im Auszug, `
          + 'damit lässt sich das Grundstück nicht zuordnen.' });
        return;
      }

      const { data: objekt } = await supabase
        .from('properties')
        .select('id, address')
        .eq('egrid', daten.egrid)
        .maybeSingle();

      if (!objekt) {
        setStand({ art: 'fehler', text: `Zu ${daten.egrid} steht nichts im Bestand.` });
        return;
      }

      const erster = gelesen[0];
      const plzOrt = [erster.plz, erster.ort].filter(Boolean).join(' ');
      const { error } = await supabase
        .from('properties')
        .update({
          owner_name: erster.name,
          owner_address: [erster.address, plzOrt].filter(Boolean).join(', ') || null,
          owner_name_2: gelesen[1]?.name ?? null,
          eigentuemer_name: erster.name,
          eigentuemer_adresse: erster.address || null,
          eigentuemer_plz_ort: plzOrt || null,
          eigentuemer_fetched_at: new Date().toISOString(),
          owners_json: gelesen.map(o => ({
            name: o.name, fullName: o.name, address: o.address,
            plz: o.plz, ort: o.ort, ownershipType: o.ownershipType,
          })),
        } as never)
        .eq('id', objekt.id);

      if (error) {
        setStand({ art: 'fehler', text: `Speichern fehlgeschlagen: ${error.message}` });
        return;
      }

      void protokolliere('eigentuemer', erster.name);
      setStand({
        art: 'gut',
        text: `${erster.name}${gelesen.length > 1 ? ` und ${gelesen.length - 1} weitere` : ''}`
          + ` — eingetragen bei ${objekt.address}`,
      });

      await weiterverarbeiten(objekt.id, toast);
      qc.invalidateQueries({ queryKey: ['uebersicht'] });
      qc.invalidateQueries({ queryKey: ['master'] });
      qc.invalidateQueries({ queryKey: ['properties'] });

      // Und weiter, ohne dass jemand die Liste sucht: das nächste
      // Grundstück nach Potenzial, im Portal seines Kantons. Ein
      // Fenster von selbst aufzumachen verbieten die meisten Browser
      // ausserhalb eines Klicks -- deshalb steht daneben ein Knopf,
      // und der Versuch bleibt der Versuch.
      const { data: weitere } = await supabase
        .from('properties')
        .select('id, egrid, bfs_nr, kanton, address, parzelle, owner_name, marge_chf')
        .eq('ausgeschlossen', false)
        .eq('is_queried', false)
        .is('owner_name', null)
        .not('egrid', 'is', null)
        .order('marge_chf', { ascending: false, nullsFirst: false })
        .limit(20);

      const naechste = naechsteParzelle(
        (weitere || []).map(w => ({
          id: w.id,
          egrid: w.egrid,
          bfsNr: w.bfs_nr,
          kanton: w.kanton,
          address: w.address,
          parzelle: w.parzelle,
          eigentuemer: w.owner_name,
          marge: w.marge_chf,
        })),
        [objekt.id],
      );

      if (!naechste) {
        setStand(v => ({ art: 'gut', text: `${v?.text ?? ''} · nichts mehr offen` }));
        return;
      }

      const adresse = naechsteAdresse(naechste);
      // Immer derselbe Tab: sonst steht nach zehn Abfragen die
      // Leiste voll.
      const auf = oeffne(adresse, FENSTER.portal);
      setStand(v => ({
        art: 'gut',
        text: `${v?.text ?? ''} · weiter mit ${naechste.address ?? ''}`
          + `${naechste.parzelle ? ` (Parz. ${naechste.parzelle})` : ''}`
          + (auf ? '' : ' — das Fenster wurde blockiert, Popups erlauben'),
      }));
    })();
    };

    verarbeite();
    window.addEventListener('hashchange', verarbeite);
    return () => window.removeEventListener('hashchange', verarbeite);
  }, [toast, qc, user, loading]);

  if (!stand) return null;

  const farbe = stand.art === 'gut'
    ? 'bg-emerald-600'
    : stand.art === 'fehler' ? 'bg-destructive' : 'bg-foreground';

  return (
    <div className={`fixed inset-x-0 top-0 z-[100] flex items-center gap-3 px-4 py-2 text-sm text-background ${farbe}`}>
      <span className="min-w-0 flex-1">{stand.text}</span>
      <button
        type="button"
        onClick={() => setStand(null)}
        className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold underline underline-offset-2"
      >
        schliessen
      </button>
    </div>
  );
}
