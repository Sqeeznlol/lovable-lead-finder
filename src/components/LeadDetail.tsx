import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { KNOPF, KNOPF_HAUPT, Marke } from '@/components/rahmen';
import { luftbildLv95 } from '@/lib/luftbild';
import { FENSTER } from '@/lib/fenster';
import { ANTWORT_TEXT, istTest } from '@/lib/lead-auswertung';

/**
 * Ein Lead ganz: wer, welche Liegenschaft, was er will, woher er kam
 * (Julian, 8. November: "die komplette Liste ... dass ich draufklicken
 * kann"). Die Notiz landet in anfrage.bemerkung.
 */
export type Lead = {
  id: string; name: string; email: string | null; telefon: string | null; adresse: string | null; egrid: string | null;
  angaben: Record<string, unknown>; erstellt_am: string; bearbeitet: boolean; bemerkung: string | null;
};

const zeile = (titel: string, wert: unknown) =>
  wert === null || wert === undefined || wert === '' ? null : (
    <div className="flex justify-between gap-4 border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{titel}</span>
      <span className="text-right font-medium">{String(wert)}</span>
    </div>
  );

export function LeadDetail({ lead, onClose, onErledigt, onNotiz }: {
  lead: Lead | null; onClose: () => void; onErledigt: (l: Lead) => void; onNotiz: (l: Lead, text: string) => Promise<void>;
}) {
  const [notiz, setNotiz] = useState('');
  const [speichert, setSpeichert] = useState(false);
  useEffect(() => { setNotiz(lead?.bemerkung ?? ''); }, [lead]);
  const a = lead?.angaben ?? {};
  const lv95 = Array.isArray(a.lv95) && a.lv95.length === 2 ? (a.lv95 as number[]) : null;
  const geoAdmin = lv95 ? `https://map.geo.admin.ch/?lang=de&E=${lv95[0]}&N=${lv95[1]}&zoom=12&bgLayer=ch.swisstopo.swissimage` : null;

  return (
    <Sheet open={!!lead} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[520px]">
        {lead && (
          <div className="space-y-6">
            <SheetHeader className="space-y-2 text-left">
              <div className="flex flex-wrap gap-2">
                {a.prioritaet === 'heiss' && <Marke art="heiss">heiss</Marke>}
                {a.prioritaet === 'warm' && <Marke art="violett">warm</Marke>}
                {istTest(lead) && <Marke>Test</Marke>}
                {a.domain ? <Marke>{String(a.domain)}</Marke> : null}
                {lead.bearbeitet && <Marke art="gruen">erledigt</Marke>}
              </div>
              <SheetTitle className="text-2xl">{lead.name}</SheetTitle>
              <SheetDescription>{lead.adresse ?? 'Ohne Adresse'}</SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-2 gap-2">
              {lead.telefon && <a className={KNOPF_HAUPT} href={`tel:${lead.telefon.replace(/\s/g, '')}`}>Anrufen</a>}
              {lead.email && <a className={KNOPF} href={`mailto:${lead.email}`}>E-Mail</a>}
            </div>

            {lv95 && (
              <a href={geoAdmin!} target={FENSTER.karte} className="block overflow-hidden rounded border">
                <img src={luftbildLv95(lv95[0], lv95[1], 160, 1000)} alt={`Luftbild ${lead.adresse ?? ''}`} className="aspect-video w-full object-cover" />
                <span className="block px-3 py-2 text-xs text-muted-foreground">Luftbild © swisstopo · in map.geo.admin.ch öffnen</span>
              </a>
            )}

            <section>
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Kontakt</h3>
              {zeile('Name', lead.name)}
              {zeile('Telefon', lead.telefon)}
              {zeile('E-Mail', lead.email)}
              {zeile('Eingegangen', new Date(lead.erstellt_am).toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' }))}
            </section>

            <section>
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Was die Person will</h3>
              {zeile('Eigentümer', ANTWORT_TEXT.eigentuemer[String(a.eigentuemer)])}
              {zeile('Absicht', ANTWORT_TEXT.absicht[String(a.absicht)])}
              {zeile('Zeitraum', ANTWORT_TEXT.zeitraum[String(a.zeitraum)])}
              {zeile('Priorität', a.prioritaet)}
            </section>

            <section>
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Liegenschaft</h3>
              {zeile('Adresse', lead.adresse)}
              {zeile('Gemeinde', a.gemeinde && a.kanton ? `${a.gemeinde} (${a.kanton})` : a.gemeinde)}
              {zeile('Parzelle', a.parzelle)}
              {zeile('EGRID', lead.egrid)}
              {zeile('Grundstück', a.flaeche ? `${Number(a.flaeche).toLocaleString('de-CH')} m²` : null)}
              {zeile('Zone', a.zone)}
              {zeile('Gebäude', a.gebaeude)}
              {zeile('Wohnungen', a.wohnungen)}
              {zeile('Ältestes Baujahr', a.baujahr)}
              {zeile('Bauprojekt im Register', a.projekt ? 'ja' : null)}
            </section>

            <section>
              <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Herkunft</h3>
              {zeile('Webseite', a.domain)}
              {zeile('Quelle', a.utm_source ?? (a.fbclid ? 'facebook' : a.gclid ? 'google' : null))}
              {zeile('Kampagne', a.utm_campaign)}
              {zeile('Anzeige', a.utm_content)}
              {zeile('Verweis', a.referrer)}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Notiz</h3>
              <textarea value={notiz} onChange={e => setNotiz(e.target.value)} rows={4} maxLength={2000}
                        placeholder="Was wurde besprochen, was ist der nächste Schritt?"
                        className="w-full rounded-[3px] border border-input bg-card p-3 text-[15px] focus:border-foreground focus:outline-none" />
              <div className="flex gap-2">
                <button type="button" className={KNOPF} disabled={speichert || notiz === (lead.bemerkung ?? '')}
                        onClick={async () => { setSpeichert(true); await onNotiz(lead, notiz); setSpeichert(false); }}>
                  {speichert ? 'Speichert …' : 'Notiz speichern'}
                </button>
                <button type="button" className={KNOPF} onClick={() => onErledigt(lead)}>{lead.bearbeitet ? 'Wieder offen' : 'Erledigt'}</button>
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
