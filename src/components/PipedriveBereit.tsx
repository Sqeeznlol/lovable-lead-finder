import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Abschnitt, KNOPF, KNOPF_HAUPT, Kopf, Leer, LISTE } from '@/components/rahmen';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useBereitFuerPipedrive, useUebertragen, usePostObjekte } from '@/hooks/use-properties';
import { Brief } from '@/components/Brief';
import { FENSTER } from '@/lib/fenster';

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
type Meldung = { art: 'ok' | 'schon' | 'fehler'; text: string };
const MARKE: Record<Meldung['art'], string> = { ok: 'Angelegt', schon: 'Schon da', fehler: 'Fehler' };

export function PipedriveBereit() {
  const { data, isLoading, refetch } = useBereitFuerPipedrive(200);
  const { data: archiv, refetch: archivNeu } = useUebertragen(30);
  const { data: post } = usePostObjekte(100);
  // Für welches Objekt der Brief gerade offen ist.
  const [brief, setBrief] = useState<string | null>(null);
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(new Set());
  const [laeuft, setLaeuft] = useState(false);
  // Was aus jedem Objekt wurde. Als Art statt als Zeichen vorn im Text:
  // danach wird gezählt und eingefärbt.
  const [ergebnis, setErgebnis] = useState<Meldung[]>([]);
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

    const meldungen: Meldung[] = [];
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
        meldungen.push({ art: 'fehler', text: `${teil.length} Objekte: ${grund}` });
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
          meldungen.push({ art: 'ok', text: `${wo}: Deal ${r.dealId}` });
        } else if (r.skipped) {
          // Schon vorhanden: dann ist hier nichts mehr zu tun, aber
          // das Objekt darf nicht ewig in dieser Liste stehen.
          await supabase.from('properties').update({
            is_queried: true, status: 'Exportiert',
          }).eq('id', r.propertyId);
          meldungen.push({ art: 'schon', text: `${wo}: stand schon in Pipedrive` });
        } else {
          meldungen.push({ art: 'fehler', text: `${wo}: ${r.error ?? 'kein Deal entstanden'}` });
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
      title: `${meldungen.filter(m => m.art === 'ok').length} Deals angelegt`,
      description: meldungen.some(m => m.art === 'fehler')
        ? 'Nicht alles ging durch, die Liste oben sagt, was.'
        : undefined,
    });
  };

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> wird geladen …
      </p>
    );
  }

  const ort = (p: { plz_ort?: string | null; plz?: string | null; gemeinde?: string | null }) =>
    p.plz_ort || [p.plz, p.gemeinde].filter(Boolean).join(' ');

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <Kopf ueber="Akquise" titel="Pipedrive">
        Fertige Leads: Eigentümer und Nummer stehen fest, der Deal fehlt noch.
        Übertragen wird nach Akquise, Phase «Neu».
      </Kopf>

      {ergebnis.length > 0 && (
        <ul className={LISTE} aria-live="polite">
          {ergebnis.map((m, i) => (
            <li key={i} className="flex items-baseline gap-3 px-5 py-3 text-sm">
              <span className={`w-20 shrink-0 font-semibold ${m.art === 'fehler' ? 'text-destructive' : m.art === 'ok' ? 'text-accent' : 'text-muted-foreground'}`}>
                {MARKE[m.art]}
              </span>
              <span className="min-w-0">{m.text}</span>
            </li>
          ))}
        </ul>
      )}

      <Abschnitt
        titel="Bereit für Pipedrive"
        zahl={bereit.length ? (gewaehlt.size > 0 ? `${gewaehlt.size} von ${bereit.length} gewählt` : bereit.length) : undefined}
        rechts={bereit.length > 0 && (
          <>
            <button type="button" className={KNOPF}
                    onClick={() => setGewaehlt(alle ? new Set() : new Set(bereit.map(p => p.id)))}>
              {alle ? 'Keine wählen' : 'Alle wählen'}
            </button>
            <button type="button" className={KNOPF_HAUPT} onClick={pushen} disabled={gewaehlt.size === 0 || laeuft}>
              {laeuft
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Überträgt …</>
                : gewaehlt.size > 0 ? `${gewaehlt.size} nach Pipedrive` : 'Nach Pipedrive'}
            </button>
          </>
        )}
      >
        {bereit.length === 0 ? (
          <Leer titel="Nichts bereit.">Was einen Eigentümer und eine Nummer hat, steht schon in Pipedrive.</Leer>
        ) : (
          <ul className={LISTE}>
            {bereit.map(p => (
              <li key={p.id}>
                {/* Die ganze Zeile wählt aus, nicht nur das Kästchen:
                    auf dem Handy trifft man sonst daneben. */}
                <label className="flex cursor-pointer items-start gap-4 px-5 py-4">
                  <Checkbox className="mt-1" checked={gewaehlt.has(p.id)} onCheckedChange={() => umschalten(p.id)} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-4">
                      <span className="block font-semibold">{p.address}</span>
                      {p.marge_chf ? <span className="shrink-0 font-semibold">{(p.marge_chf / 1e6).toFixed(1)} Mio</span> : null}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {[p.parzelle ? `Parzelle ${p.parzelle}` : null, ort(p), p.kanton].filter(Boolean).join(' · ')}
                    </span>
                    <span className="mt-1 block text-sm">
                      <span className="font-medium">{p.owner_name}</span>
                      <span className="text-muted-foreground"> · {p.owner_phone}</span>
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </Abschnitt>

      {/* Wo der Anruf nicht geht. Der Brief steht hier und nicht in
          "Nummern": dort wird gesucht, hier wird verschickt. */}
      <Abschnitt titel="Brief statt Anruf" zahl={(post ?? []).length || undefined}>
        {(post ?? []).length === 0 ? (
          <Leer titel="Noch kein Brief fällig.">
            Objekte kommen hierher, wenn unter «Nummern» keine Telefonnummer zu finden ist.
          </Leer>
        ) : (
          <ul className={LISTE}>
            {(post ?? []).map(p => (
              <li key={p.id} className="flex items-center gap-4 px-5 py-4">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{p.address}</span>
                  <span className="block text-sm text-muted-foreground">
                    {[p.parzelle ? `Parzelle ${p.parzelle}` : null, ort(p)].filter(Boolean).join(' · ')}
                  </span>
                  <span className="mt-1 block text-sm">
                    <span className="font-medium">{p.owner_name}</span>
                    {p.owner_address && <span className="text-muted-foreground"> · {p.owner_address}</span>}
                  </span>
                </span>
                <button type="button" className={KNOPF} onClick={() => setBrief(p.id)}>Brief</button>

                {brief === p.id && (
                  <Brief
                    offen
                    onClose={() => setBrief(null)}
                    empfaenger={[
                      { name: p.owner_name ?? '', adresse: p.owner_address ?? null, plzOrt: null },
                      // Ein zweiter Eigentümer, falls einer eingetragen
                      // ist: dann richtet sich der Brief an beide.
                      ...(Array.isArray(p.owners_json) && p.owners_json.length > 1
                        ? [{
                            name: String(
                              (p.owners_json[1] as { fullName?: string; name?: string })?.fullName
                              ?? (p.owners_json[1] as { name?: string })?.name ?? ''),
                          }]
                        : []),
                    ].filter(e => e.name)}
                    objekt={{ address: p.address, parzelle: p.parzelle, plz: p.plz, gemeinde: p.gemeinde, plzOrt: p.plz_ort }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Abschnitt>

      {/* Was schon drüben ist -- sichtbar, damit niemand dasselbe ein
          zweites Mal schickt. Zum Nachsehen, nicht zum Tun. */}
      <Abschnitt titel="Bereits übertragen" zahl={(archiv ?? []).length || undefined}>
        {(archiv ?? []).length === 0 ? (
          <Leer titel="Noch nichts übertragen." />
        ) : (
          <ul className={LISTE}>
            {(archiv ?? []).map(p => (
              <li key={p.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.address}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {[p.owner_name,
                      p.last_export_at && new Date(p.last_export_at).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' }),
                    ].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <a href={`https://bauraum.pipedrive.com/deal/${p.pipedrive_deal_id}`} target={FENSTER.pipedrive}
                   className="-my-3 inline-flex h-11 shrink-0 items-center text-sm font-semibold text-accent">
                  Deal {p.pipedrive_deal_id}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Abschnitt>
    </div>
  );
}
