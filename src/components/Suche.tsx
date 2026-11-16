import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Loader2, Search } from 'lucide-react';
import { KNOPF, KNOPF_HAUPT, KNOPF_LEISE, LISTE, Leer, Seite } from '@/components/rahmen';
import { ObjektLink } from '@/components/ObjektLink';
import { useUrlWert } from '@/hooks/use-url-wert';
import { BILD } from '@/lib/luftbild';
import { istVorhanden } from '@/lib/potential';
import { BEISPIELE, gemeindenLaden, HEIZUNG, parzellenBild, satzVerstehen, suchen, zoneText, type Treffer } from '@/lib/suche';

/**
 * Suche: ein Satz, eine Liste (Julian, 16. November). Links das Bild der
 * Parzelle, in der Mitte Adresse und Eigentümer, rechts die Eckpunkte.
 *
 * Der Satz steht in der Adresse (?q=...): so führt «Zurück» zur vorigen
 * Suche, und eine Liste lässt sich als Link weitergeben.
 */

const de = (n: number) => n.toLocaleString('de-CH');

export function Suche() {
  const [q, setQ] = useUrlWert('q');
  const [eingabe, setEingabe] = useState(q ?? '');
  useEffect(() => setEingabe(q ?? ''), [q]);

  const gemeinden = useQuery({ queryKey: ['suche-gemeinden'], queryFn: gemeindenLaden, staleTime: 60 * 60 * 1000 });
  const verstanden = useMemo(() => (q && gemeinden.data ? satzVerstehen(q, gemeinden.data) : null), [q, gemeinden.data]);
  const filter = verstanden?.filter;
  const hatOrt = !!(filter?.gemeinden?.length || filter?.plz?.length);

  const liste = useInfiniteQuery({
    queryKey: ['suche', filter],
    enabled: hatOrt,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => suchen(filter!, pageParam),
    getNextPageParam: (letzte, alle) => {
      const geladen = alle.reduce((s, p) => s + p.zeilen.length, 0);
      return geladen < letzte.anzahl && letzte.zeilen.length > 0 ? geladen : undefined;
    },
    staleTime: 5 * 60 * 1000,
  });
  const erste = liste.data?.pages[0];
  const zeilen = liste.data?.pages.flatMap(p => p.zeilen) ?? [];
  const parzellenTotal = gemeinden.data?.reduce((s, g) => s + g.parzellen, 0);
  const orte = verstanden?.orte.join(', ') ?? '';

  const titel = erste && hatOrt
    ? `${de(erste.anzahl)} ${erste.anzahl === 1 ? 'Parzelle' : 'Parzellen'}${filter?.zone ? ` in ${filter.zone}` : ''}, ${orte}`
    : parzellenTotal ? `${de(parzellenTotal)} Parzellen, ein Satz genügt` : 'Ein Satz genügt';

  // Das Feld steht direkt unter dem Satz, auch nach einer Suche: die
  // Zonen des Ortes kommen darunter als eine Reihe, nicht als Kacheln
  // darüber (iPhone, 16. November: sonst lag das Feld unter dem Rand).
  return (
    <Seite bild={BILD.suche} ueber="Suche · Kanton Zürich und Thurgau" titel={titel}
      unter={!q ? <>Schreib, was du suchst: Ort, Zone, Grösse, Baujahr, Heizung, Potenzial oder Denkmalschutz.</> : undefined}>
      <form role="search" className="flex gap-2" onSubmit={e => { e.preventDefault(); setQ(eingabe.trim() || null); }}>
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Suche</span>
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          {/* 17 px: unter 16 px vergrössert Safari auf dem iPhone die Seite beim Tippen. */}
          <input value={eingabe} onChange={e => setEingabe(e.target.value)} type="search" enterKeyHint="search" autoComplete="off"
                 placeholder="Alle W2 in Dietikon" aria-label="Suche"
                 className="h-14 w-full min-w-0 rounded-[3px] border border-input bg-card pl-12 pr-4 text-[17px] placeholder:text-muted-foreground focus:border-foreground focus:outline-none" />
        </label>
        <button type="submit" className={`${KNOPF_HAUPT} h-14 px-5 sm:px-7`}>Suchen</button>
      </form>

      {!q && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Zum Beispiel</p>
          <div className="flex flex-wrap gap-2">
            {BEISPIELE.map(b => <button key={b} type="button" className={KNOPF_LEISE} onClick={() => setQ(b)}>{b}</button>)}
          </div>
        </div>
      )}

      {q && gemeinden.isLoading && <Laedt text="Orte werden geladen …" />}
      {gemeinden.error && <p className="text-sm text-destructive">Die Liste der Orte liess sich nicht laden. Bitte später noch einmal.</p>}

      {verstanden && (
        <p className="text-sm text-muted-foreground">
          {verstanden.teile.length ? <>Verstanden: <span className="text-foreground">{verstanden.teile.join(' · ')}</span></> : 'Nichts verstanden.'}
          {verstanden.offen.length > 0 && <> · nicht verstanden: «{verstanden.offen.join(' ')}»</>}
        </p>
      )}

      {/* Die Zonen des Ortes, häufigste zuerst: ein Tipp sucht genau diese. */}
      {erste && hatOrt && erste.zonen.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Zonen in {orte}</p>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {erste.zonen.slice(0, 10).map(z => {
              const an = filter?.zone === z.kurz;
              return (
                <button key={z.kurz} type="button" aria-pressed={an} title={zoneText(z.kurz)}
                        onClick={() => setQ(`${z.kurz} in ${orte}`)} className={`${an ? KNOPF_HAUPT : KNOPF} shrink-0`}>
                  {z.kurz} <span className={an ? 'opacity-70' : 'text-muted-foreground'}>{de(z.anzahl)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {verstanden && !hatOrt && (
        verstanden.fremderOrt
          ? <Leer titel={`${verstanden.fremderOrt} ist nicht im Bestand`}>Aurora führt die Gemeinden der Kantone Zürich und Thurgau.</Leer>
          : <Leer titel="Wo soll gesucht werden?">Nenne eine Gemeinde oder eine Postleitzahl, zum Beispiel «W2 in Dietikon».</Leer>
      )}

      {hatOrt && liste.isLoading && <Laedt text="wird gesucht …" />}
      {hatOrt && liste.error && <p className="text-sm text-destructive">Die Suche hat nicht geantwortet: {(liste.error as Error).message}</p>}

      {erste && hatOrt && erste.anzahl === 0 && (
        <Leer titel="Keine Parzelle passt.">
          {erste.zonen.length ? <>In {orte} kommen vor: {erste.zonen.slice(0, 6).map(z => `${z.kurz} (${de(z.anzahl)})`).join(', ')}.</> : 'Weniger Bedingungen versuchen.'}
        </Leer>
      )}

      {zeilen.length > 0 && (
        <>
          <ul className={LISTE}>
            {zeilen.map(t => <Zeile key={t.id} t={t} />)}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">{de(zeilen.length)} von {de(erste!.anzahl)}{filter?.sortierung ? '' : ', nach Potenzial'}</p>
            {liste.hasNextPage && (
              <button type="button" className={KNOPF_LEISE} disabled={liste.isFetchingNextPage} onClick={() => void liste.fetchNextPage()}>
                {liste.isFetchingNextPage ? 'Lädt …' : 'Weitere laden'}
              </button>
            )}
          </div>
        </>
      )}

      {/* Ehrlich, was fehlt: ohne Zone im Bestand kann eine Parzelle
          nicht als W2 gefunden werden (Dietikon, 16. November: 1'579 von 3'476). */}
      {erste && hatOrt && filter?.zone && erste.ohne_zone > 0 && (
        <p className="max-w-2xl text-sm text-muted-foreground">
          Bei {de(erste.ohne_zone)} der {de(erste.im_ort)} Parzellen in {orte} steht keine Zone im Bestand; sie fehlen in dieser Liste.
        </p>
      )}
    </Seite>
  );
}

function Laedt({ text }: { text: string }) {
  return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {text}</p>;
}

/** Eine Parzelle: Bild, Adresse und Eigentümer, Eckpunkte. */
function Zeile({ t }: { t: Treffer }) {
  const ort = [t.plz, t.gemeinde].filter(Boolean).join(' ');
  const denkmal = istVorhanden(t.denkmal) ? (t.denkmal_titel ? `ja · ${t.denkmal_titel}` : 'ja') : t.denkmal ? 'nein' : 'nicht erfasst';
  const isos = istVorhanden(t.isos);
  const reserve = t.reserve == null ? 'nicht gerechnet' : t.reserve > 0 ? `+${de(Math.round(t.reserve))} m² HNF` : 'keine Reserve';
  const eck: [string, string][] = [
    ['Fläche', t.flaeche ? `${de(Math.round(t.flaeche))} m²` : '–'],
    ['Baujahr', t.baujahr ? String(t.baujahr) : '–'],
    ['Geschosse', t.geschosse ? String(t.geschosse) : '–'],
    ['Heizung', t.heizung ? HEIZUNG[t.heizung] ?? 'andere' : '–'],
    ['Potenzial', reserve],
    ['Denkmalschutz', isos && !istVorhanden(t.denkmal) ? 'Ortsbild (ISOS)' : denkmal],
  ];
  return (
    <li className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-4 gap-y-3 p-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:p-4 lg:grid-cols-[120px_minmax(0,0.9fr)_minmax(0,1.3fr)] lg:items-start">
      <ObjektLink id={t.id} className="block">
        <ParzellenBild t={t} />
        <span className="sr-only">{t.adresse ?? 'Parzelle'} öffnen</span>
      </ObjektLink>

      <div className="min-w-0 space-y-1 pt-0.5">
        <ObjektLink id={t.id} className="block text-[16px] font-medium leading-snug">{t.adresse ?? 'Ohne Adresse'}</ObjektLink>
        <p className="text-sm text-muted-foreground">{ort}{t.parzelle ? ` · Parzelle ${t.parzelle}` : ''}</p>
        <p className={`text-sm ${t.eigentuemer ? '' : 'text-muted-foreground'}`}>{t.eigentuemer ?? 'Eigentümer unbekannt'}</p>
      </div>

      <dl className="col-span-2 grid grid-cols-3 gap-x-4 gap-y-2 sm:col-span-1 sm:col-start-2 lg:col-start-3">
        {eck.map(([titel, wert]) => (
          <div key={titel} className="min-w-0">
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{titel}</dt>
            <dd className="truncate text-[14px] sm:text-[15px]" title={wert}>{wert}</dd>
          </div>
        ))}
        <div className="col-span-3 min-w-0">
          <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Zone (BZO)</dt>
          <dd className="truncate text-[14px] sm:text-[15px]" title={t.zone ?? undefined}>
            {t.zone ? <>{t.zone_kurz && <span className="font-medium">{t.zone_kurz} · </span>}{t.zone}{t.az ? ` · AZ ${t.az.toLocaleString('de-CH')}` : ''}</> : 'nicht im Bestand'}
          </dd>
        </div>
      </dl>
    </li>
  );
}

/** Luftbild des Bundes mit dem Umriss der Parzelle darüber. */
function ParzellenBild({ t }: { t: Treffer }) {
  const b = parzellenBild(t, 240);
  return (
    <span className="relative block aspect-square w-full overflow-hidden rounded-[3px] bg-secondary">
      {b && (
        <>
          <img src={b.bild} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="absolute inset-0 h-full w-full">
            <path d={b.pfad} fill="rgb(61 69 245 / 0.16)" stroke="#fff" strokeWidth={3} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            <path d={b.pfad} fill="none" stroke="#3D45F5" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </svg>
        </>
      )}
    </span>
  );
}
