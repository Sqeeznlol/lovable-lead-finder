import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, Building2, CalendarDays, Download, FileText, X, Gauge, HardHat, Map as KarteSymbol, MessageSquare, MoreHorizontal, Search, Loader2, LogOut, Map as Karte, Orbit, Sparkles, Upload } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { useUrlWert } from '@/hooks/use-url-wert';
import { ThemeToggle } from '@/components/ThemeToggle';
import { KontoMenu, useGesellschaften } from '@/components/KontoMenu';
import { Abschnitt, AUF, KNOPF, KNOPF_HAUPT, KNOPF_LEISE, Kennzahlen, Leer, LISTE, Marke, Reiter, Strichbalken } from '@/components/rahmen';
import { Universum } from '@/components/fonds/Universum';
import { FondsImport } from '@/components/fonds/FondsImport';
import { ImmoKalender } from '@/components/ImmoKalender';
import { FondsBaugesuche, FondsBericht, FondsGespraeche, FondsKalender, FondsKarte, FondsPotenziale, FondsSuchprofile, type BereichProps } from '@/components/fonds/FondsBereiche';
import { baugesucheLaden, faellig, fondsTeam, notizenLaden } from '@/lib/fonds-werkzeuge';
import type { ComponentType } from 'react';
import { fondsFarbe, imBestand, POTENZIAL, potenzialeAlsCsv, universumLaden, verorten, type PotenzialArt } from '@/lib/fonds';
import { FENSTER } from '@/lib/fenster';

const n = (x: number | null | undefined) => (x == null ? '–' : Math.round(x).toLocaleString('de-CH'));
const chf = (v: number | null | undefined) => (!v ? '–' : v >= 1e9 ? `${(v / 1e9).toFixed(1)} Mrd` : `${(v / 1e6).toFixed(1)} Mio`);
const flaeche = (m2: number) => (m2 >= 100_000 ? `${(m2 / 10_000).toLocaleString('de-CH', { maximumFractionDigits: 1 })} ha` : `${n(m2)} m²`);
const MARKE: Record<PotenzialArt, 'heiss' | 'lila' | 'violett' | 'grau'> = { arrondierung: 'heiss', nachbar_baut: 'lila', reserve: 'violett', offen: 'grau' };

/**
 * Wohntraums -- die Oberfläche für Fondsleitungen.
 *
 * Aufbau wie jede Seite (DESIGN.md): Bühne, Satz mit Zahl, Kennzahlen,
 * Tafeln, rechte Spalte. Die Bühne ist hier das Universum der eigenen
 * Liegenschaften. Darunter, was ein Algorithmus aus den eingespielten
 * Datensätzen herausliest: die pendenten Potenziale, das grösste zuerst.
 * Eigentümer sind hier nachrangig -- es geht um das eigene Portfolio.
 */
/** Die Bereiche von Wohntraums, in der Reihenfolge der Leiste. */
const BEREICHE: { id: string; titel: string; symbol: ComponentType<{ className?: string }>; unten?: boolean; inhalt?: ComponentType<BereichProps> }[] = [
  { id: 'uebersicht', titel: 'Übersicht', symbol: Gauge, unten: true },
  { id: 'karte', titel: 'Karte', symbol: KarteSymbol, unten: true, inhalt: FondsKarte },
  { id: 'potenziale', titel: 'Potenziale', symbol: Sparkles, unten: true, inhalt: FondsPotenziale },
  { id: 'baugesuche', titel: 'Baugesuche', symbol: HardHat, unten: true, inhalt: FondsBaugesuche },
  { id: 'gespraeche', titel: 'Gespräche', symbol: MessageSquare, inhalt: FondsGespraeche },
  { id: 'suchprofile', titel: 'Suchprofile', symbol: Search, inhalt: FondsSuchprofile },
  { id: 'kalender', titel: 'Immo-Kalender', symbol: CalendarDays, inhalt: FondsKalender },
  // Der Bericht des Kunden, online und als PDF (Punkt 12 der Nacht vom 3. November).
  { id: 'bericht', titel: 'Bericht', symbol: FileText, inhalt: FondsBericht },
];

export function FondsOberflaeche() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  // Unsere Konten wählen oben rechts eine Fondsleitung (?als=); ohne
  // Wahl die erste, damit nie mehrere Gesellschaften vermischt sind.
  const { data: leitungen, isLoading: leitungenLaden } = useGesellschaften();
  const [alsWert] = useUrlWert('als');
  const als = alsWert ?? leitungen?.[0]?.id ?? null;
  const intern = (leitungen?.length ?? 0) > 0;
  const { data, isLoading, error } = useQuery({
    queryKey: ['fonds-universum', als], queryFn: () => universumLaden(als), staleTime: 60 * 1000, enabled: !leitungenLaden,
  });
  // Jeder Bereich eine eigene Adresse (/fonds/baugesuche ...), damit
  // "Zurück" im Browser geht -- wie in Bauraum.
  const { bereich: bereichWert } = useParams();
  const bereich = BEREICHE.some(b => b.id === bereichWert) ? bereichWert! : 'uebersicht';
  const [mehrAuf, setMehrAuf] = useState(false);
  const { data: team } = useQuery({ queryKey: ['fonds-team', als], queryFn: () => fondsTeam(als), enabled: !leitungenLaden });
  const { data: woche } = useQuery({ queryKey: ['fonds-baugesuche', als, 7], queryFn: () => baugesucheLaden(als, 7), enabled: !leitungenLaden });
  const { data: notizen } = useQuery({ queryKey: ['fonds-notizen', team], queryFn: () => notizenLaden(team!), enabled: !!team });
  const gehe = (b: string, extra: Record<string, string> = {}) => {
    const q = new URLSearchParams(extra);
    if (alsWert) q.set('als', alsWert);
    navigate(`/fonds${b === 'uebersicht' ? '' : `/${b}`}${q.toString() ? `?${q}` : ''}`);
    setMehrAuf(false);
    window.scrollTo({ top: 0 });
  };
  const [gewaehlt, setGewaehlt] = useUrlWert('liegenschaft');
  const [artWert, setArt] = useUrlWert('potenzial', 'alle');
  const [import_, setImport] = useUrlWert('einspielen');
  const [kalender, setKalender] = useUrlWert('kalender');
  // Ein Fonds antippen zeigt nur seine Potenziale (Prüfung, 1. November).
  const [nurFonds, setNurFonds] = useUrlWert('fonds');
  const [alleZeigen, setAlleZeigen] = useState(false);
  const art = artWert as PotenzialArt | 'alle';

  // Wer noch keinen Punkt hat, wird beim Bund verortet -- einmal je
  // Laden, im Hintergrund; danach steht er im Universum.
  // Je Fondsleitung einmal: nach einem Wechsel über das Kontomenü
  // wurde sonst nie mehr verortet.
  const verortet = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!data || verortet.current === als) return;
    const offen = data.punkte.filter(p => p.e == null && p.egrid).map(p => ({ id: p.id, egrid: p.egrid }));
    if (!offen.length) return;
    verortet.current = als;
    void verorten(offen).then(() => qc.invalidateQueries({ queryKey: ['fonds-universum'] }));
  }, [data, qc, als]);

  const nr = useMemo(() => new Map((data?.fonds ?? []).map(f => [f.id, f.nr])), [data]);
  const punkt = useMemo(() => new Map((data?.punkte ?? []).map(p => [p.id, p])), [data]);

  if (isLoading || leitungenLaden) return <div className="grid min-h-safe-screen place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (error || !data) return <div className="p-10"><Leer titel="Das Universum lässt sich nicht laden.">Angemeldet? Sonst später nochmals.</Leer></div>;

  const fremd = data.kanten.filter(k => k.fremd);
  const anFremd = new Set(fremd.flatMap(k => [k.a, k.b])).size;
  const reserve = data.fonds.reduce((s, f) => s + f.reserve, 0);
  const marge = data.fonds.reduce((s, f) => s + f.marge, 0);
  const zahl = (a: PotenzialArt) => data.potenziale.filter(p => p.art === a).length;
  const imFonds = (id: string | null) => !nurFonds || (id != null && punkt.get(id)?.fonds === nurFonds);
  const liste = data.potenziale.filter(p => (art === 'alle' || p.art === art) && (imFonds(p.parzelle) || imFonds(p.parzelle2)));
  const fondsWahl = nurFonds ? data.fonds.find(f => f.id === nurFonds) : undefined;
  const csv = () => potenzialeAlsCsv(liste, punkt, nr, `potenziale-${(data.gesellschaft ?? 'fonds').replace(/[^\wäöü-]+/gi, '-').toLowerCase()}.csv`);
  const wahl = gewaehlt ? punkt.get(gewaehlt) : undefined;
  const maxLieg = Math.max(...data.fonds.map(f => f.liegenschaften), 1);

  return (
    <div className="flex min-h-safe-screen bg-background">
      {/* Die Leiste wie in Bauraum: Symbole, der aktive Bereich schwarz. */}
      <aside className="sticky top-0 hidden h-screen w-[76px] shrink-0 flex-col items-center gap-1 border-r bg-card py-5 lg:flex" aria-label="Bereiche">
        <span className="mb-5 grid h-11 w-11 place-items-center rounded-[3px] bg-foreground text-background"><Orbit className="h-6 w-6" /></span>
        {BEREICHE.map(b => (
          <button key={b.id} type="button" onClick={() => gehe(b.id)} aria-label={b.titel} aria-current={bereich === b.id ? 'page' : undefined}
                  className={`group relative grid h-11 w-11 place-items-center rounded-[3px] transition-colors ${bereich === b.id ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
            <b.symbol className="h-5 w-5" />
            <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-[3px] bg-foreground px-2.5 py-1.5 text-xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{b.titel}</span>
          </button>
        ))}
      </aside>
      <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-30 border-b bg-background pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 lg:px-10">
          <span className="grid h-9 w-9 place-items-center rounded-[3px] bg-foreground text-background"><Orbit className="h-5 w-5" /></span>
          <span className="min-w-0 leading-tight">
            <span className="block text-[17px] font-semibold">Wohntraums</span>
            <span className="block truncate text-xs text-muted-foreground">{data.gesellschaft ?? 'Fondsleitung'}</span>
          </span>
          <span className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            {intern ? <KontoMenu aktiv={als} /> : (
              <button type="button" onClick={() => void signOut()} aria-label="Abmelden" title="Abmelden"
                      className="grid h-11 w-11 place-items-center rounded-[3px] border bg-card hover:bg-secondary"><LogOut className="h-5 w-5" /></button>
            )}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-6 overflow-x-clip px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 lg:px-10 lg:pb-16" key={bereich}>
        {bereich !== 'uebersicht' ? (() => {
          const B = BEREICHE.find(b => b.id === bereich)!.inhalt!;
          return <B data={data} als={als} team={team ?? null} gehe={gehe} />;
        })() : (<>
        <div className={`space-y-2 ${AUF}`}>
          <p className="text-sm text-muted-foreground">Ihr Portfolio · {data.fonds.length} Fonds · Reserve {flaeche(reserve)} · pendente Marge {chf(marge)}</p>
          <h1 className="max-w-3xl text-[34px] leading-[1.08] sm:text-[48px]">
            {n(data.punkte.length)} Liegenschaften{anFremd ? `, ${n(anFremd)} grenzen an einen anderen Ihrer Fonds` : ''}
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Jeder Punkt eine Liegenschaft an ihrem Ort, die Farbe ist der Fonds. Orange Linie: hier grenzen Liegenschaften
            verschiedener Fonds aneinander -- gemeinsam lässt sich mehr entwickeln.
          </p>
        </div>

        <Universum punkte={data.punkte} kanten={data.kanten} fonds={data.fonds} gewaehlt={gewaehlt} onWahl={setGewaehlt} />

        <Kennzahlen werte={[
          { titel: 'Liegenschaften', wert: n(data.punkte.length), marke: <Marke art="lila">{data.fonds.length} Fonds</Marke> },
          { titel: 'Grenzen an anderen Fonds', wert: n(fremd.length), marke: fremd.length ? <Marke art="heiss">Arrondierung</Marke> : <Marke>keine</Marke>, onClick: () => setArt('arrondierung') },
          { titel: 'Baugesuche 7 Tage', wert: woche ? n(new Set(woche.map(g => g.id)).size) : '–', marke: <Marke art="minze">an oder neben Ihren</Marke>, onClick: () => gehe('baugesuche', { tage: '7' }) },
          { titel: 'Wiedervorlagen', wert: notizen ? n(notizen.filter(x => faellig(x)).length) : '–', marke: <Marke art="rosa">fällig</Marke>, onClick: () => gehe('gespraeche', { sicht: 'faellig' }) },
        ]} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-6">
            <Abschnitt titel="Pendente Potenziale" zahl={liste.length} symbol={Sparkles} kachel="schwarz"
                       unter="Aus Ihren Datensätzen gerechnet, das grösste zuerst"
                       rechts={liste.length > 0 && <button type="button" className={KNOPF_LEISE} onClick={csv}><Download className="h-4 w-4" /> CSV</button>}>
              {fondsWahl && (
                <button type="button" onClick={() => setNurFonds(null)}
                        className="inline-flex min-h-11 items-center gap-2 rounded-[3px] bg-foreground px-3 text-sm text-background">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: fondsFarbe(fondsWahl.nr) }} />
                  Nur Fonds {fondsWahl.nr} <X className="h-4 w-4" />
                </button>
              )}
              <Reiter<string> wahl={art} setWahl={w => setArt(w)} optionen={[
                { wert: 'alle', titel: 'Alle', zahl: data.potenziale.length },
                ...(['arrondierung', 'nachbar_baut', 'reserve', 'offen'] as PotenzialArt[])
                  .filter(a => zahl(a) > 0 || a === art).map(a => ({ wert: a, titel: POTENZIAL[a].kurz, zahl: zahl(a) })),
              ]} />
              {liste.length === 0 ? <Leer titel="Keine Potenziale in dieser Auswahl." /> : (
                <ul className={LISTE}>
                  {liste.slice(0, alleZeigen ? undefined : 80).map((p, i) => {
                    const a = punkt.get(p.parzelle), b = p.parzelle2 ? punkt.get(p.parzelle2) : undefined;
                    return (
                      <li key={`${p.art}-${p.parzelle}-${p.parzelle2 ?? ''}-${i}`}>
                        <button type="button" onClick={() => setGewaehlt(p.parzelle)}
                                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-secondary">
                          <span className="min-w-0 space-y-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <Marke art={MARKE[p.art]}>{POTENZIAL[p.art].kurz}</Marke>
                              {[a, b].filter(Boolean).map(x => (
                                <span key={x!.id} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <span className="h-2 w-2 rounded-full" style={{ background: fondsFarbe(nr.get(x!.fonds) ?? 1) }} />Fonds {nr.get(x!.fonds)}
                                </span>
                              ))}
                            </span>
                            <span className="block font-semibold">{p.titel}</span>
                            <span className="block text-sm text-muted-foreground">
                              {[p.wo, p.flaeche ? `${n(p.flaeche)} m²` : null, p.reserve && p.reserve > 0 ? `Reserve ${n(p.reserve)} m²` : null].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                          <span className="shrink-0 font-semibold text-violett">{p.marge ? chf(p.marge) : ''}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {/* Vorher still bei 80 abgeschnitten, während Kopf und Reiter die volle Zahl nannten. */}
              {!alleZeigen && liste.length > 80 && (
                <button type="button" className={`${KNOPF_LEISE} w-full`} onClick={() => setAlleZeigen(true)}>Alle {n(liste.length)} zeigen</button>
              )}
            </Abschnitt>

            <Abschnitt titel="Fonds" zahl={data.fonds.length} symbol={Building2} kachel="akzent" unter="Liegenschaften, Reserve und Marge je Fonds">
              <ul className={LISTE}>
                {data.fonds.map(f => (
                  <li key={f.id}>
                  <button type="button" onClick={() => setNurFonds(nurFonds === f.id ? null : f.id)} aria-pressed={nurFonds === f.id}
                          className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-4 text-left hover:bg-secondary sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] ${nurFonds === f.id ? 'bg-secondary' : ''}`}>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: fondsFarbe(f.nr) }} />
                      <span className="truncate font-semibold">Fonds {f.nr}</span>
                      <span className="hidden truncate text-sm text-muted-foreground sm:inline">{f.name.replace(/^Immofonds \d+ · /, '')}</span>
                    </span>
                    <span className="order-3 col-span-2 sm:order-none sm:col-span-1"><Strichbalken anteil={f.liegenschaften / maxLieg} farbe="akzent" /></span>
                    <span className="text-right text-sm"><span className="font-semibold">{n(f.liegenschaften)}</span> <span className="text-muted-foreground">· {chf(f.marge)}</span></span>
                  </button>
                  </li>
                ))}
              </ul>
            </Abschnitt>

            {/* Messen und Kongresse der Branche -- dort trifft man die
                Gegenseite einer Arrondierung. */}
            <Abschnitt titel="Immo-Kalender" symbol={CalendarDays} kachel="hell" unter="Messen und Kongresse, wann und wo"
                       rechts={<button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setKalender(kalender ? null : 'alle')}>
                         {kalender ? 'Weniger zeigen' : 'Alle zeigen'}</button>}>
              <ImmoKalender kurz={kalender ? undefined : 4} />
            </Abschnitt>
          </div>

          <aside className={`min-w-0 space-y-4 self-start rounded border bg-card p-4 ${AUF}`}>
            {import_ ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between"><h2 className="text-lg">Datensätze einspielen</h2>
                  <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setImport(null)}>Schliessen</button></div>
                {data.mandant ? <FondsImport mandant={data.mandant} fonds={data.fonds} onFertig={() => setImport(null)} /> : <p className="text-sm text-muted-foreground">Keine Fondsleitung zugeordnet.</p>}
              </section>
            ) : (
              <button type="button" className={`${KNOPF_HAUPT} w-full`} onClick={() => setImport('1')}><Upload className="h-4 w-4" /> Datensätze einspielen</button>
            )}

            {wahl ? (
              <section className="space-y-3 border-t pt-4">
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: fondsFarbe(nr.get(wahl.fonds) ?? 1) }} />
                  Fonds {nr.get(wahl.fonds)}
                </p>
                <h2 className="text-xl leading-tight">{wahl.adresse}</h2>
                <p className="text-sm text-muted-foreground">{wahl.gemeinde}{!imBestand(wahl) && ' · Lage vom Bund, Zone und Reserve folgen mit dem Bestand'}</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  {([['Fläche', wahl.flaeche ? `${n(wahl.flaeche)} m²` : '–'], ['Zone', wahl.zone ?? (imBestand(wahl) ? 'fehlt' : '–')],
                     ['Reserve', wahl.reserve && wahl.reserve > 0 ? `${n(wahl.reserve)} m²` : '–'], ['Marge', chf(wahl.marge)]] as [string, string][])
                    .map(([t, v]) => <div key={t} className="min-w-0"><dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{t}</dt><dd className="break-words font-medium">{v}</dd></div>)}
                </dl>
                {(() => {
                  const nb = data.kanten.filter(k => k.a === wahl.id || k.b === wahl.id).map(k => punkt.get(k.a === wahl.id ? k.b : k.a)).filter(Boolean);
                  return nb.length ? (
                    <div className="space-y-1.5">
                      <p className="flex items-center gap-1.5 text-sm font-medium"><ArrowLeftRight className="h-4 w-4" /> Grenzt an</p>
                      {nb.map(x => (
                        <button key={x!.id} type="button" onClick={() => setGewaehlt(x!.id)} className="flex min-h-11 w-full items-center gap-2 rounded-[3px] border px-3 text-left text-sm hover:bg-secondary">
                          <span className="h-2 w-2 rounded-full" style={{ background: fondsFarbe(nr.get(x!.fonds) ?? 1) }} />
                          <span className="min-w-0 flex-1 truncate">{x!.adresse}</span>
                          <span className="shrink-0 text-muted-foreground">Fonds {nr.get(x!.fonds)}</span>
                        </button>
                      ))}
                    </div>
                  ) : null;
                })()}
                {wahl.egrid && (
                  <a className={`${KNOPF} w-full`} href={`https://map.geo.admin.ch/?swisssearch=${wahl.egrid}&lang=de`} target={FENSTER.karte}>
                    <Karte className="h-4 w-4" /> Auf der Karte des Bundes
                  </a>
                )}
              </section>
            ) : (
              <p className="border-t pt-4 text-sm text-muted-foreground">Eine Liegenschaft im Universum oder in der Liste antippen, um sie hier zu sehen.</p>
            )}

            {/* Für unsere Konten: zurück in die eigene Arbeit. Ein
                Fondsmanager kommt hier nicht hin (Index leitet ihn um). */}
            {/* Nur für unsere Konten -- ein Fondsmanager hat dort nichts verloren. */}
            {intern && <button type="button" onClick={() => navigate('/')} className="min-h-11 w-full text-sm text-muted-foreground hover:text-foreground">Zur internen Oberfläche</button>}
          </aside>
        </div>
        </>)}
      </main>
      </div>

      {/* Handy: vier feste Ziele und "Mehr", wie in Bauraum. */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Bereiche">
        <div className="grid grid-cols-5">
          {[...BEREICHE.filter(b => b.unten), { id: 'mehr', titel: 'Mehr', symbol: MoreHorizontal }].map(b => {
            const an = b.id === 'mehr' ? mehrAuf || !BEREICHE.find(x => x.id === bereich)?.unten : bereich === b.id;
            return (
              <button key={b.id} type="button" onClick={() => (b.id === 'mehr' ? setMehrAuf(v => !v) : gehe(b.id))}
                      className="flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px]">
                <span className={`grid h-8 w-12 place-items-center rounded-[3px] ${an ? 'bg-foreground text-background' : 'text-muted-foreground'}`}><b.symbol className="h-5 w-5" /></span>
                <span className={an ? 'font-medium' : 'text-muted-foreground'}>{b.titel}</span>
              </button>
            );
          })}
        </div>
      </nav>
      {mehrAuf && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 lg:hidden" onClick={() => setMehrAuf(false)}>
          <div className="w-full rounded-t-[6px] bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" onClick={e => e.stopPropagation()}>
            <div className="grid grid-cols-1 gap-1">
              {BEREICHE.filter(b => !b.unten).map(b => (
                <button key={b.id} type="button" onClick={() => gehe(b.id)}
                        className={`flex min-h-12 items-center gap-3 rounded-[3px] px-3 text-left ${bereich === b.id ? 'bg-foreground text-background' : 'hover:bg-secondary'}`}>
                  <b.symbol className="h-5 w-5" /> {b.titel}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
