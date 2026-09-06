import { useEffect, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { portalUrl } from '@/lib/portal';
import { protokolliere } from '@/lib/protokoll';

const PHONE_LS_KEY = 'sqeeztraum.my_phone';

export function getMyPhone(): string {
  try { return localStorage.getItem(PHONE_LS_KEY) || ''; } catch { return ''; }
}
export function setMyPhone(value: string) {
  try { localStorage.setItem(PHONE_LS_KEY, value.trim()); } catch { /* noop */ }
}

export function useExtensionAvailable() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const check = () => setAvailable(!!document.getElementById('akquise-extension-marker'));
    check();
    const t = setInterval(check, 3000);
    return () => clearInterval(t);
  }, []);
  return available;
}

interface StartArgs {
  propertyId: string;
  egrid?: string | null;
  bfsNr?: string | null;
  /** Jeder Kanton führt seine eigene Auskunft. */
  kanton?: string | null;
  parzelle?: string | null;
  address?: string | null;
  plzOrt?: string | null;
}

/**
 * Was nach der Abfrage von selbst passiert.
 *
 * Bis hierher endete die Arbeit mit dem Eigentümernamen in der
 * Datenbank; Telefonsuche und Pipedrive waren zwei weitere Reiter, die
 * jemand von Hand aufsuchen musste. Beides hängt aber am selben
 * Augenblick -- der Name steht fest --, und keine der beiden Aufgaben
 * verlangt eine Entscheidung.
 *
 * Also läuft es hier durch: Nummer suchen, Deal anlegen, Objekt aus der
 * Liste nehmen. Ob der Deal in Akquise landet oder in Search,
 * entscheidet die gefundene Nummer -- das tut der Push.
 *
 * Schlägt ein Schritt fehl, bleibt das Objekt in der Liste. Ein halb
 * abgelegtes Objekt wäre schlimmer als eines, das noch dasteht.
 */
export async function weiterverarbeiten(
  propertyId: string,
  toast: ReturnType<typeof useToast>['toast'],
): Promise<void> {
  const { data: p } = await supabase
    .from('properties')
    .select('*')
    .eq('id', propertyId)
    .maybeSingle();
  if (!p) return;

  // 1. Telefonnummer suchen -- nur, wenn noch keine dasteht.
  let telefon = p.owner_phone || '';
  if (!telefon && p.owner_name) {
    try {
      const { data: tel } = await supabase.functions.invoke('tel-search', {
        body: {
          lastName: p.owner_name,
          street: p.eigentuemer_adresse || '',
          ort: p.eigentuemer_plz_ort || '',
        },
      });
      if (tel?.match && tel?.phone) {
        telefon = tel.phone;
        await supabase.from('properties')
          .update({ owner_phone: telefon, phone_search_status: 'found' })
          .eq('id', propertyId);
      } else {
        await supabase.from('properties')
          .update({ phone_search_status: 'not_found' })
          .eq('id', propertyId);
      }
    } catch {
      /* Ohne Nummer geht der Deal nach Search -- das ist kein Fehler. */
    }
  }

  // 2. Deal anlegen.
  const { data: push, error: pushErr } = await supabase.functions.invoke(
    'pipedrive-push',
    { body: { properties: [{ ...p, owner_phone: telefon || null }] } },
  );
  if (pushErr || !(push?.summary?.created > 0)) {
    toast({
      title: 'Pipedrive: kein Deal angelegt',
      description: pushErr
        ? String(pushErr.message || pushErr)
        : 'Vermutlich schon vorhanden — das Objekt bleibt in der Liste.',
      variant: 'destructive',
    });
    return;
  }

  // 3. Erst jetzt aus der Liste nehmen.
  await supabase.from('properties')
    .update({
      is_queried: true,
      queried_at: new Date().toISOString(),
      status: 'Exportiert',
    })
    .eq('id', propertyId);

  void protokolliere('deal', `${p.address} — ${telefon ? 'Akquise' : 'Search'}`, p.kanton);
  toast({
    title: telefon ? '📞 Deal in Akquise angelegt' : '🔍 Deal in Search angelegt',
    description: telefon
      ? `${p.owner_name} · ${telefon}`
      : `${p.owner_name} — keine Nummer gefunden, Eigentümer stehen in der Notiz`,
  });
}

/**
 * Globally persists Eigentümer data returned from the Chrome extension into the
 * properties table. Mount once at the app root.
 */
export function useEigentuemerLookupListener() {
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const { owners, error, egrid } = detail as {
        propertyId?: string;
        egrid?: string | null;
        owners?: Array<{ name?: string; address?: string; plz?: string; ort?: string }>;
        error?: string | null;
      };

      // Wer die Karte selbst geöffnet hat, hat nie auf "Abfragen"
      // geklickt -- dann gibt es keine Kennung. Der Auszug nennt die
      // EGRID aber selbst, und die ist schweizweit eindeutig: damit
      // findet sich das Objekt auch so.
      let propertyId = detail.propertyId as string | undefined;
      if (!propertyId && egrid) {
        const { data: gefunden } = await supabase
          .from('properties')
          .select('id')
          .eq('egrid', egrid)
          .maybeSingle();
        propertyId = gefunden?.id;
        if (!propertyId) {
          toast({
            title: 'Objekt nicht gefunden',
            description: `Zu ${egrid} steht nichts im Bestand — der Auszug `
              + 'gehört zu einem Grundstück, das wir nicht führen.',
            variant: 'destructive',
          });
          return;
        }
      }
      if (!propertyId) return;

      if (error || !owners || owners.length === 0) {
        toast({
          title: 'Eigentümer-Lookup fehlgeschlagen',
          description: error || 'Keine Daten gefunden — Portal manuell prüfen.',
          variant: 'destructive',
        });
        return;
      }

      const first = owners[0] || {};
      const plzOrt = [first.plz, first.ort].filter(Boolean).join(' ').trim();
      const patch: Record<string, unknown> = {
        eigentuemer_name: first.name || null,
        eigentuemer_adresse: first.address || null,
        eigentuemer_plz_ort: plzOrt || null,
        eigentuemer_fetched_at: new Date().toISOString(),
      };

      // Mirror into legacy owner_* fields when empty (do not overwrite)
      const { data: existing } = await supabase
        .from('properties')
        .select('owner_name, owner_address, owners_json')
        .eq('id', propertyId)
        .maybeSingle();
      if (existing && !existing.owner_name && first.name) patch.owner_name = first.name;
      if (existing && !existing.owner_address && first.address) {
        patch.owner_address = [first.address, plzOrt].filter(Boolean).join(', ');
      }
      if (existing && (!existing.owners_json || (Array.isArray(existing.owners_json) && existing.owners_json.length === 0))) {
        patch.owners_json = owners.map(o => ({
          name: o.name || '',
          address: o.address || '',
          plz: o.plz || '',
          ort: o.ort || '',
        }));
      }

      const { error: updErr } = await supabase
        .from('properties')
        .update(patch as never)
        .eq('id', propertyId);

      if (updErr) {
        toast({ title: 'Speichern fehlgeschlagen', description: updErr.message, variant: 'destructive' });
        return;
      }

      void protokolliere('eigentuemer', first.name || null);
      toast({ title: `✅ Eigentümer gespeichert: ${first.name || 'unbekannt'}` });
      qc.invalidateQueries({ queryKey: ['properties'] });
      qc.invalidateQueries({ queryKey: ['master'] });

      await weiterverarbeiten(propertyId, toast);
      qc.invalidateQueries({ queryKey: ['uebersicht'] });
      qc.invalidateQueries({ queryKey: ['master'] });
    };
    window.addEventListener('akquise-owner-data', handler);
    return () => window.removeEventListener('akquise-owner-data', handler);
  }, [toast, qc]);
}

export function useStartEigentuemerLookup() {
  const { toast } = useToast();
  const extensionAvailable = useExtensionAvailable();

  return useCallback((args: StartArgs) => {
    const phone = getMyPhone();
    if (!args.egrid) {
      toast({ title: 'Keine EGRID-Nummer', description: 'Property hat keine EGRID — Portal kann nicht aufgerufen werden.', variant: 'destructive' });
      return false;
    }
    const adresse = portalUrl(args.kanton, args.egrid, args.bfsNr);

    if (!extensionAvailable) {
      // Fallback: open portal manually
      window.open(adresse, '_blank', 'noopener,noreferrer');
      toast({
        title: 'Extension nicht installiert',
        description: 'Portal in neuem Tab geöffnet — Daten manuell übernehmen.',
      });
      return false;
    }

    if (!phone) {
      window.open(adresse, '_blank', 'noopener,noreferrer');
      toast({
        title: 'Telefonnummer fehlt',
        description: 'Hinterlege "Meine Telefonnummer" in Einstellungen für Auto-Fill.',
        variant: 'destructive',
      });
      return false;
    }

    window.dispatchEvent(new CustomEvent('akquise-start-lookup', {
      detail: {
        egrid: args.egrid,
        bfsNr: args.bfsNr || '',
        kanton: args.kanton || 'ZH',
        parzelle: args.parzelle || '',
        phoneNumber: phone,
        propertyId: args.propertyId,
        appOrigin: window.location.hostname,
        address: args.address || '',
        plzOrt: args.plzOrt || '',
      },
    }));
    void protokolliere('abfrage', args.address || args.egrid, args.kanton);
    toast({ title: '🤖 Portal wird geöffnet…', description: 'SMS-Code im Portal-Tab eingeben — Daten werden automatisch gespeichert.' });
    return true;
  }, [extensionAvailable, toast]);
}

export { PHONE_LS_KEY };