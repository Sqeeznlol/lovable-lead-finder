import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { leseAuskunft } from '@/lib/eigentuemer';
import { weiterverarbeiten } from '@/hooks/use-eigentuemer-lookup';
import { protokolliere } from '@/lib/protokoll';
import { naechsteParzelle, naechsteAdresse } from '@/lib/naechste';

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
  const laeuft = useRef(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith('#auskunft=') || laeuft.current) return;
    laeuft.current = true;

    (async () => {
      let daten: { text?: string; egrid?: string; parzelle?: string };
      try {
        daten = JSON.parse(decodeURIComponent(hash.slice('#auskunft='.length)));
      } catch {
        toast({ title: 'Auskunft unleserlich', variant: 'destructive' });
        return;
      }
      // Die Adresse aufräumen, damit ein Neuladen nicht alles wiederholt.
      window.history.replaceState(null, '', window.location.pathname);

      const gelesen = leseAuskunft(daten.text || '');
      if (gelesen.length === 0) {
        toast({
          title: 'Keine Eigentümer erkannt',
          description: 'Im Portal die Zeilen markieren und nochmals klicken.',
          variant: 'destructive',
        });
        return;
      }

      if (!daten.egrid) {
        toast({
          title: 'Keine EGRID im Auszug',
          description: `${gelesen[0].name} — ohne EGRID lässt sich nicht `
            + 'sagen, zu welchem Grundstück das gehört.',
          variant: 'destructive',
        });
        return;
      }

      const { data: objekt } = await supabase
        .from('properties')
        .select('id, address')
        .eq('egrid', daten.egrid)
        .maybeSingle();

      if (!objekt) {
        toast({
          title: 'Objekt nicht im Bestand',
          description: `Zu ${daten.egrid} steht nichts in der Datenbank.`,
          variant: 'destructive',
        });
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
        toast({ title: 'Speichern fehlgeschlagen', description: error.message, variant: 'destructive' });
        return;
      }

      void protokolliere('eigentuemer', erster.name);
      toast({
        title: `✓ ${gelesen.length > 1 ? gelesen.length + ' Eigentümer' : erster.name}`,
        description: objekt.address,
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
        toast({ title: 'Nichts mehr offen', description: 'Alle Objekte tragen einen Eigentümer.' });
        return;
      }

      const adresse = naechsteAdresse(naechste);
      const auf = window.open(adresse, '_blank');
      toast({
        title: auf ? 'Weiter zur nächsten Parzelle' : 'Nächste Parzelle bereit',
        description: `${naechste.address ?? ''}${naechste.parzelle ? ` · Parz. ${naechste.parzelle}` : ''}`
          + (auf ? '' : ' — Popup blockiert, Knopf unten in der Liste.'),
      });
    })();
  }, [toast, qc]);

  return null;
}
