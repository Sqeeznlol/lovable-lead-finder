import { useMemo, useState } from 'react';
import { Printer, Mail } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  ABSENDER, brieftext, type Anredeform, type BriefEmpfaenger, type BriefObjekt,
} from '@/lib/brief';

interface Props {
  offen: boolean;
  onClose: () => void;
  empfaenger: BriefEmpfaenger[];
  objekt: BriefObjekt;
}

/**
 * Der fertige Brief, druckbar.
 *
 * Gedruckt wird die Seite selbst: beim Druck wird alles ausgeblendet
 * ausser dem Brief (siehe index.css, "@media print"). Das ist
 * verlässlicher als ein zweites Fenster, das ein Sperrer wegnimmt.
 *
 * Der Text lässt sich vor dem Drucken ändern -- kein Brief passt auf
 * jeden Fall, und ein Feld, das man nicht anfassen kann, führt dazu,
 * dass jemand den Brief anderswo neu schreibt.
 */
export function Brief({ offen, onClose, empfaenger, objekt }: Props) {
  const [form, setForm] = useState<Anredeform>(
    empfaenger.length > 1 ? 'beide' : 'neutral');
  const vorgabe = useMemo(
    () => brieftext(form, empfaenger, objekt), [form, empfaenger, objekt]);
  const [text, setText] = useState<string | null>(null);

  const inhalt = text ?? vorgabe;
  const heute = new Date().toLocaleDateString('de-CH', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const erster = empfaenger[0];

  return (
    <Dialog open={offen} onOpenChange={o => { if (!o) { setText(null); onClose(); } }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader className="print:hidden">
          <DialogTitle>Brief</DialogTitle>
          <DialogDescription>
            Anrede wählen, Text bei Bedarf anpassen, drucken.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <Select value={form} onValueChange={v => { setForm(v as Anredeform); setText(null); }}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="neutral">Sehr geehrte Damen und Herren</SelectItem>
              <SelectItem value="herr">Sehr geehrter Herr …</SelectItem>
              <SelectItem value="frau">Sehr geehrte Frau …</SelectItem>
              <SelectItem value="beide">Frau und Herr …</SelectItem>
            </SelectContent>
          </Select>

          <Button className="ml-auto gap-2" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Drucken
          </Button>
        </div>

        {/* Was gedruckt wird. */}
        <div className="brief-druck space-y-8 rounded-xl border bg-background p-10 text-[13px] leading-relaxed">
          <div className="flex justify-between gap-8">
            <div>
              <p className="font-semibold">{ABSENDER.firma}</p>
              <p className="text-muted-foreground">{ABSENDER.ort}</p>
            </div>
          </div>

          <div>
            <p className="font-medium">{erster?.name}</p>
            {erster?.adresse && <p>{erster.adresse}</p>}
            {erster?.plzOrt && <p>{erster.plzOrt}</p>}
          </div>

          <p className="text-right">{ABSENDER.ort}, {heute}</p>

          <p className="font-semibold">
            Ihr Grundstück {objekt.parzelle ? `Parzelle ${objekt.parzelle}, ` : ''}
            {objekt.address}
          </p>

          <Textarea
            value={inhalt}
            onChange={e => setText(e.target.value)}
            rows={16}
            className="brief-text resize-none border-0 bg-transparent p-0 text-[13px] leading-relaxed shadow-none focus-visible:ring-0"
          />

          <div className="space-y-1 pt-4">
            <p className="font-semibold">{ABSENDER.firma}</p>
            {ABSENDER.personen.map(p => (
              <p key={p.mail}>
                {p.name} · <span className="text-muted-foreground">{p.mail}</span>
              </p>
            ))}
          </div>
        </div>

        <p className="flex items-center gap-2 text-xs text-muted-foreground print:hidden">
          <Mail className="h-3 w-3" />
          Gedruckt wird nur der Brief — alles andere blendet der Druck aus.
        </p>
      </DialogContent>
    </Dialog>
  );
}
