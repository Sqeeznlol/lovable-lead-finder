import { useEffect, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

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
  parzelle?: string | null;
  address?: string | null;
  plzOrt?: string | null;
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
      const { propertyId, owners, error } = detail as {
        propertyId?: string;
        owners?: Array<{ name?: string; address?: string; plz?: string; ort?: string }>;
        error?: string | null;
      };
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

      toast({ title: `✅ Eigentümer gespeichert: ${first.name || 'unbekannt'}` });
      qc.invalidateQueries({ queryKey: ['properties'] });
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
    const portalUrl = `https://portal.objektwesen.zh.ch/aks/detail?egrid=${encodeURIComponent(args.egrid)}&bfsNr=${encodeURIComponent(args.bfsNr || '')}`;

    if (!extensionAvailable) {
      // Fallback: open portal manually
      window.open(portalUrl, '_blank', 'noopener,noreferrer');
      toast({
        title: 'Extension nicht installiert',
        description: 'Portal in neuem Tab geöffnet — Daten manuell übernehmen.',
      });
      return false;
    }

    if (!phone) {
      window.open(portalUrl, '_blank', 'noopener,noreferrer');
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
        parzelle: args.parzelle || '',
        phoneNumber: phone,
        propertyId: args.propertyId,
        appOrigin: window.location.hostname,
        address: args.address || '',
        plzOrt: args.plzOrt || '',
      },
    }));
    toast({ title: '🤖 Portal wird geöffnet…', description: 'SMS-Code im Portal-Tab eingeben — Daten werden automatisch gespeichert.' });
    return true;
  }, [extensionAvailable, toast]);
}

export { PHONE_LS_KEY };