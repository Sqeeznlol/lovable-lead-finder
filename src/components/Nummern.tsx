import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Phone, Send } from 'lucide-react';
import { Abschnitt, FELD, KNOPF, KNOPF_HAUPT, Leer, LISTE, Marke, Seite } from '@/components/rahmen';
import { BILD } from '@/lib/luftbild';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useOffeneNummern } from '@/hooks/use-properties';
import { weiterverarbeiten } from '@/hooks/use-eigentuemer-lookup';
import { Objektansicht } from '@/components/Objektansicht';
import { FENSTER } from '@/lib/fenster';

/**
 * Der Zwischenstand, an dem die Kette hängt.
 *
 * Nach der Abfrage steht der Eigentümer fest, die Nummer nicht immer.
 * Diese Objekte lagen bisher im Akquise-Modus zwischen allem anderen
 * -- und wer sie suchte, fand sie nicht. Sie brauchen einen eigenen
 * Ort, weil hier genau eine Frage offen ist und die Antwort ein Feld
 * lang ist.
 *
 * Steht die Nummer, geht der Deal nach Pipedrive, Akquise, Phase
 * "Neu", und die Zeile verschwindet. Das ist die ganze Rubrik.
 */
export function Nummern() {
  const { data, isLoading } = useOffeneNummern(200);
  const [entwurf, setEntwurf] = useState<Record<string, string>>({});
  const [speichert, setSpeichert] = useState<string | null>(null);
  // Wohin es ging: sonst verschwindet die Zeile, und niemand weiss,
  // ob der Deal entstanden ist oder etwas schiefging.
  const [uebergeben, setUebergeben] = useState<
    { adresse: string; name: string; dealId?: string | null }[]>([]);
  const { toast } = useToast();
  const qc = useQueryClient();

  // Beim Öffnen die letzten Übergaben zeigen -- auch die von gestern.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('properties')
        .select('address, owner_name, pipedrive_deal_id, last_export_at')
        .not('pipedrive_deal_id', 'is', null)
        .order('last_export_at', { ascending: false, nullsFirst: false })
        .limit(8);
      if (data?.length) {
        setUebergeben(data.map(d => ({
          adresse: d.address,
          name: d.owner_name ?? '',
          dealId: d.pipedrive_deal_id,
        })));
      }
    })();
  }, []);

  /**
   * Keine Nummer zu finden -- dann Brief.
   *
   * Sonst stehen solche Objekte ewig hier und werden bei jedem
   * Durchgang neu erfolglos gesucht.
   */
  const aufPost = async (id: string, adresse: string) => {
    setSpeichert(id);
    const { error } = await supabase
      .from('properties')
      .update({ status: 'Post', phone_search_status: 'not_found' })
      .eq('id', id);
    setSpeichert(null);
    if (error) {
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return;
    }
    qc.invalidateQueries({ queryKey: ['properties'] });
    toast({ title: 'Auf Post gesetzt', description: `${adresse} steht jetzt unter Pipedrive, Post` });
  };

  const eintragen = async (id: string, adresse: string) => {
    const nummer = (entwurf[id] || '').trim();
    if (!nummer) return;
    setSpeichert(id);

    const { error } = await supabase
      .from('properties')
      .update({ owner_phone: nummer, phone_search_status: 'found' })
      .eq('id', id);

    if (error) {
      setSpeichert(null);
      toast({ title: 'Fehler', description: error.message, variant: 'destructive' });
      return;
    }

    // Von hier an dasselbe wie nach einer gefundenen Nummer: Deal
    // anlegen, Objekt ablegen. Kein zweiter Knopf.
    await weiterverarbeiten(id, toast);

    // Nachsehen, was daraus wurde -- die Zeile verschwindet gleich,
    // und ohne diesen Eintrag bliebe offen, wohin.
    const { data: danach } = await supabase
      .from('properties')
      .select('owner_name, pipedrive_deal_id')
      .eq('id', id)
      .maybeSingle();
    setUebergeben(v => [{
      adresse,
      name: danach?.owner_name ?? '',
      dealId: danach?.pipedrive_deal_id ?? null,
    }, ...v].slice(0, 8));

    setSpeichert(null);
    setEntwurf(e => ({ ...e, [id]: '' }));
    qc.invalidateQueries({ queryKey: ['properties'] });
    qc.invalidateQueries({ queryKey: ['uebersicht'] });
    qc.invalidateQueries({ queryKey: ['master'] });
    toast({ title: 'Nummer eingetragen', description: adresse });
  };

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> wird geladen …
      </p>
    );
  }

  const offen = data || [];

  const firmen = offen.filter(p => /\b(AG|GmbH|SA|Sàrl|Genossenschaft|Stiftung)\b/.test(p.owner_name || '')).length;
  const mitAdresse = offen.filter(p => p.owner_address).length;

  return (
    <Seite bild={BILD.nummern} ueber="Nummern · Akquise"
      titel={offen.length ? `${offen.length} ${offen.length === 1 ? 'Eigentümer wartet' : 'Eigentümer warten'} auf die Nummer` : 'Jeder Eigentümer hat eine Nummer'}
      unter="Sobald die Nummer hier steht, entsteht der Deal in Pipedrive, Akquise, Phase «Neu»."
      kennzahlen={[
        { titel: 'Offen', wert: String(offen.length), marke: offen.length ? <Marke art="rosa">suchen</Marke> : undefined },
        { titel: 'Firmen', wert: String(firmen), marke: <Marke art="lila">Zefix</Marke> },
        { titel: 'Mit Adresse', wert: String(mitAdresse), marke: <Marke art="minze">tel.search</Marke> },
        { titel: 'Übergeben', wert: String(uebergeben.length), marke: <Marke art="violett">zuletzt</Marke> },
      ]}>
      <Abschnitt titel="Nummer gesucht" unter="Eigentümer steht fest, die Telefonnummer fehlt" symbol={Phone} kachel="heiss" zahl={offen.length || undefined}>
        {offen.length === 0 ? (
          <Leer titel="Nichts offen.">Alles, was einen Eigentümer hat, hat auch eine Nummer.</Leer>
        ) : (
          <ul className={LISTE}>
            {offen.map(p => {
              const name = p.owner_name || '';
              const ort = p.plz_ort || [p.plz, p.gemeinde].filter(Boolean).join(' ');
              const text = entwurf[p.id] ?? '';
              const firma = /\b(AG|GmbH|SA|Sàrl|Genossenschaft|Stiftung)\b/.test(name);
              return (
                <li key={p.id} className="flex gap-5 px-5 py-5">
                  <Objektansicht
                    address={p.address}
                    plzOrt={ort}
                    parzelle={p.parzelle}
                    bfsNr={p.bfs_nr}
                    gemeinde={p.gemeinde}
                    kanton={p.kanton}
                    className="hidden h-28 w-40 shrink-0 overflow-hidden rounded-[3px] sm:block"
                  />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="space-y-0.5">
                      <div className="flex items-start justify-between gap-4">
                        <span className="min-w-0 font-semibold">{p.address}</span>
                        {p.marge_chf ? <span className="shrink-0 font-semibold">{(p.marge_chf / 1e6).toFixed(1)} Mio</span> : null}
                      </div>
                      {/* "Per Post" als leise Nebenhandlung neben der
                          Parzelle, wie "Nicht rentabel" in der Übersicht. */}
                      <div className="flex items-center justify-between gap-4">
                        <span className="min-w-0 text-sm text-muted-foreground">
                          {p.parzelle ? `Parzelle ${p.parzelle} · ` : ''}{ort}
                        </span>
                        <button type="button"
                                className="-my-3 -mr-2 inline-flex h-11 shrink-0 items-center px-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                                onClick={() => aufPost(p.id, p.address)} disabled={speichert === p.id}
                                title="Keine Nummer zu finden, per Brief anschreiben">
                          Per Post
                        </button>
                      </div>
                    </div>

                    {/* Der Eigentümer mit seiner Adresse: mit beidem
                        zusammen findet man die Nummer, mit dem Namen
                        allein selten. */}
                    <p className="text-sm">
                      <span className="font-medium">{name}</span>
                      {p.owner_address && <span className="text-muted-foreground"> · {p.owner_address}</span>}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <a className={KNOPF} target={FENSTER.suche}
                         href={`https://tel.search.ch/?was=${encodeURIComponent(name)}${p.owner_address ? `&wo=${encodeURIComponent(p.owner_address)}` : ''}`}>
                        tel.search.ch
                      </a>
                      <a className={KNOPF} target={FENSTER.suche}
                         href={`https://www.google.com/search?q=${encodeURIComponent(`${name} ${p.owner_address ?? ''} Telefon`)}`}>
                        Google
                      </a>
                      {/* Firmen stehen im Handelsregister, Private nicht. */}
                      {firma && (
                        <a className={KNOPF} target={FENSTER.suche}
                           href={`https://www.zefix.ch/de/search/entity/list?name=${encodeURIComponent(name)}`}>
                          Zefix
                        </a>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="tel"
                        inputMode="tel"
                        value={text}
                        onChange={e => setEntwurf(v => ({ ...v, [p.id]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') eintragen(p.id, p.address); }}
                        placeholder="079 123 45 67"
                        aria-label={`Telefonnummer für ${p.address}`}
                        className={`${FELD} flex-1 sm:max-w-xs`}
                      />
                      <button type="button" className={KNOPF_HAUPT}
                              onClick={() => eintragen(p.id, p.address)}
                              disabled={!text.trim() || speichert === p.id}>
                        {speichert === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eintragen'}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Abschnitt>

      {/* Wohin die Leads gegangen sind. Ohne das ist die Frage
          berechtigt: "jetzt ist er weg -- wo?" */}
      {uebergeben.length > 0 && (
        <Abschnitt titel="Nach Pipedrive übergeben" unter="Akquise, Phase «Neu». Die letzten acht." symbol={Send} kachel="akzent">
          <ul className={LISTE}>
            {uebergeben.map((u, i) => (
              <li key={`${u.adresse}-${i}`} className="flex items-center justify-between gap-4 px-5 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{u.adresse}</span>
                  {u.name && <span className="block truncate text-sm text-muted-foreground">{u.name}</span>}
                </span>
                {u.dealId ? (
                  <a href={`https://bauraum.pipedrive.com/deal/${u.dealId}`} target={FENSTER.pipedrive}
                     className="-my-3 inline-flex h-11 shrink-0 items-center text-sm font-semibold text-accent">
                    Deal {u.dealId}
                  </a>
                ) : (
                  <span className="shrink-0 text-sm text-muted-foreground">kein Deal entstanden</span>
                )}
              </li>
            ))}
          </ul>
        </Abschnitt>
      )}
    </Seite>
  );
}
