import { useMemo, useState } from 'react';
import { ClipboardPaste, Check, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { leseAuskunft } from '@/lib/eigentuemer';
import { weiterverarbeiten } from '@/hooks/use-eigentuemer-lookup';
import { protokolliere } from '@/lib/protokoll';

interface Props {
  propertyId: string | null;
  adresse?: string | null;
  onClose: () => void;
}

/**
 * Die Auskunft von Hand einfügen.
 *
 * Bis die Extension steht, ist das der Weg: im Portal den Block mit den
 * Eigentümern markieren, kopieren, hier einfügen. Was erkannt wurde,
 * steht sofort darunter -- wer einfügt, sieht also vor dem Speichern,
 * ob es stimmt. Das ist der Vorteil gegenüber jeder Automatik.
 *
 * Danach läuft dasselbe wie nach einer Abfrage durch die Extension:
 * Telefonnummer suchen, Deal anlegen, Objekt aus der Liste nehmen.
 */
export function AuskunftEinfuegen({ propertyId, adresse, onClose }: Props) {
  const [text, setText] = useState('');
  const [speichert, setSpeichert] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const gelesen = useMemo(() => leseAuskunft(text), [text]);

  const speichern = async () => {
    if (!propertyId || gelesen.length === 0) return;
    setSpeichert(true);

    const erster = gelesen[0];
    const plzOrt = [erster.plz, erster.ort].filter(Boolean).join(' ');
    const { error } = await supabase
      .from('properties')
      .update({
        eigentuemer_name: erster.name,
        eigentuemer_adresse: erster.address || null,
        eigentuemer_plz_ort: plzOrt || null,
        eigentuemer_fetched_at: new Date().toISOString(),
        owner_name: erster.name,
        owner_address: [erster.address, plzOrt].filter(Boolean).join(', ') || null,
        owner_name_2: gelesen[1]?.name ?? null,
        owners_json: gelesen.map(o => ({
          name: o.name,
          fullName: o.name,
          address: o.address,
          plz: o.plz,
          ort: o.ort,
          ownershipType: o.ownershipType,
        })),
      } as never)
      .eq('id', propertyId);

    if (error) {
      setSpeichert(false);
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return;
    }

    void protokolliere('eigentuemer', erster.name);
    await weiterverarbeiten(propertyId, toast);
    qc.invalidateQueries({ queryKey: ['uebersicht'] });
    qc.invalidateQueries({ queryKey: ['master'] });
    qc.invalidateQueries({ queryKey: ['properties'] });
    setSpeichert(false);
    setText('');
    onClose();
  };

  return (
    <Dialog open={!!propertyId} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Auskunft einfügen</DialogTitle>
          <DialogDescription>
            {adresse
              ? `${adresse} — den Block mit den Eigentümern aus dem Portal kopieren.`
              : 'Den Block mit den Eigentümern aus dem Portal kopieren.'}
          </DialogDescription>
        </DialogHeader>

        <Textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          rows={8}
          placeholder={'Hans Müller, Dorfstrasse 3, 8253 Diessenhofen, Alleineigentum'}
          className="font-mono text-xs"
        />

        {/* Was erkannt wurde, steht vor dem Speichern da -- niemand
            speichert blind, was ein Muster gerade herausgelesen hat. */}
        {text.trim() && (
          <div className="rounded-xl border p-3 text-sm">
            {gelesen.length === 0 ? (
              <p className="text-muted-foreground">
                Nichts erkannt. Erkannt wird eine Zeile mit Name, Adresse und
                Postleitzahl — Überschriften und Feldnamen werden übergangen.
              </p>
            ) : (
              <ul className="space-y-1">
                {gelesen.map((o, i) => (
                  <li key={i} className="flex items-baseline gap-2">
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>
                      <span className="font-medium">{o.name}</span>
                      {o.address || o.plz ? (
                        <span className="text-muted-foreground">
                          {' — '}{[o.address, [o.plz, o.ort].filter(Boolean).join(' ')]
                            .filter(Boolean).join(', ')}
                        </span>
                      ) : null}
                      {o.ownershipType && (
                        <span className="text-muted-foreground"> · {o.ownershipType}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button onClick={speichern} disabled={gelesen.length === 0 || speichert}>
            {speichert
              ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Speichern …</>
              : <><ClipboardPaste className="mr-1 h-4 w-4" /> Übernehmen
                  {gelesen.length > 0 ? ` (${gelesen.length})` : ''}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
