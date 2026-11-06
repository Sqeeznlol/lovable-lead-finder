import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { KNOPF, KNOPF_HAUPT, Leer } from '@/components/rahmen';
import { BILD } from '@/lib/luftbild';
import { HEIZ_GRUPPEN, heizGruppe } from '@/lib/karte3d';
import { ANLAESSE, ZUSTAENDE } from '@/hooks/use-gelegenheiten';
import { pdfDrucken } from '@/components/Merklisten';

/**
 * Der Portfolio-Bericht an einen Kunden (Tims Brief, 11D und 15):
 * Reserven, Ersatzneubau-Kandidaten, Nachbarn zum Zukauf, Baugesuche
 * der letzten zwölf Monate, Gelegenheiten mit Stand und Ergebnis.
 * Alles aus einer Abfrage (portfolio_bericht, Migration 20261103210000).
 *
 * Gestaltet wie das PDF der Merkliste: Luftbild-Bühne, Kennzahlenleiste,
 * Tafeln, dann die Tabellen -- auf dem Bildschirm ein weisses Blatt,
 * beim Drucken das Einzige auf der Seite (.bericht-druck in index.css).
 * Keine Eigentümernamen Dritter: der Bericht geht an den Kunden.
 */
export interface Bericht {
  kunde: string; produkt: string | null; seit: string | null;
  stand: { gebaeude: string | null; baugesuch: string | null; potenzial: string | null };
  portfolios: { id: string; name: string; parzellen: number }[];
  parzellen: number; offen: number; flaeche_m2: number; reserve_hnf: number; mit_reserve: number; ohne_rechnung: number; marge_chf: number;
  gebaeude: { mit_register: number; anzahl: number; wohnungen: number; baujahr_schnitt: number | null; bis_1975: number; fossil: number; heizungen: { titel: string; n: number }[] };
  nachbarn: { gesamt: number; mit_reserve: number; mit_eigentuemer: number };
  zukauf: { address: string | null; gemeinde: string | null; area: number | null; hnf_delta: number | null; marge_chf: number | null; eigentuemer_bekannt: boolean; neben: string | null }[];
  top_reserve: { address: string | null; gemeinde: string | null; zone: string | null; area: number | null; hnf_delta: number | null; marge_chf: number | null; baujahr: number | null; fossil: boolean; reserve_quote: number | null }[];
  ersatzneubau: { address: string | null; gemeinde: string | null; baujahr: number | null; hnf_delta: number | null; reserve_quote: number | null; fossil: boolean }[];
  baugesuche: { im_portfolio: number; beim_nachbarn: number; liste: { publiziert_am: string; adresse: string | null; gemeinde: string | null; beschreibung: string; im_portfolio: boolean; neben: string | null }[] };
  gelegenheiten: { je_zustand: { zustand: string; n: number }[]; je_anlass: { anlass: string; n: number }[];
    liste: { titel: string; anlass: string; zustand: string; erkannt_am: string; gemeldet_am: string | null; abgeschlossen_am: string | null; ergebnis: string | null; prioritaet: number | null }[] };
}

const n = (x: number | null | undefined) => (x == null ? '–' : Math.round(x).toLocaleString('de-CH'));
const m2 = (x: number | null | undefined) => (x == null || x === 0 ? '–' : `${n(x)} m²`);
const chf = (v: number | null | undefined) => (!v ? '–' : v >= 1e9 ? `${(v / 1e9).toFixed(1)} Mrd` : v >= 1e6 ? `${(v / 1e6).toFixed(1)} Mio` : `${n(v / 1000)}'000`);
const datum = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' }) : '–');
const kurz = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('de-CH') : '–');
const EXAKT = { WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as const;

export function usePortfolioBericht(mandantId: string | null) {
  return useQuery({
    queryKey: ['portfolio-bericht', mandantId],
    enabled: !!mandantId,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<Bericht | null> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await (supabase as any).rpc('portfolio_bericht', { p_mandant: mandantId });
      if (r.error) throw new Error(r.error.message);
      return (r.data as Bericht | null) ?? null;
    },
  });
}

// ohneMarge: für Fondsleitungen, die keine Marge sehen (FONDS_MARGE in fonds.ts).
export function PortfolioBericht({ mandantId, onZurueck, ohneMarge = false }: { mandantId: string; onZurueck: () => void; ohneMarge?: boolean }) {
  const { data, error, isLoading } = usePortfolioBericht(mandantId);
  const heute = new Date().toLocaleDateString('de-CH', { day: 'numeric', month: 'long', year: 'numeric' });
  if (isLoading) return <Leer titel="Der Bericht wird gerechnet …" />;
  if (error) return <Leer titel="Der Bericht lässt sich nicht laden.">{/function|schema cache/i.test(error.message) ? 'Die Migration 20261103210000_portfolio_bericht ist noch nicht eingespielt.' : error.message}</Leer>;
  if (!data) return <Leer titel="Kein Zugriff auf diesen Kunden." />;
  const b = data;
  const offen = b.gelegenheiten.je_zustand.filter(z => !['abgeschlossen', 'verworfen'].includes(z.zustand)).reduce((s, z) => s + z.n, 0);
  const erreicht = b.gelegenheiten.je_zustand.find(z => z.zustand === 'abgeschlossen')?.n ?? 0;
  // Heizungen nach Gruppe (Farben der 3D-Karte), grösste zuerst.
  const mix = HEIZ_GRUPPEN.map(g => ({ ...g, n: b.gebaeude.heizungen.filter(h => heizGruppe(h.titel)?.titel === g.titel).reduce((s, h) => s + h.n, 0) }))
    .filter(g => g.n > 0).sort((a, c) => c.n - a.n);
  const ohne = b.gebaeude.heizungen.filter(h => !heizGruppe(h.titel)).reduce((s, h) => s + h.n, 0);
  const basis = mix.reduce((s, g) => s + g.n, 0) + ohne;
  const zahlen: [string, string, string?][] = [
    ['Parzellen', n(b.parzellen), b.offen ? `${n(b.offen)} nicht zugeordnet` : undefined],
    ['Reserve', m2(b.reserve_hnf), b.mit_reserve ? `${n(b.mit_reserve)} ab 200 m²` : undefined],
    ...(ohneMarge ? [] : [['Marge gerechnet', chf(b.marge_chf)] as [string, string]]),
    ['Gelegenheiten offen', n(offen), erreicht ? `${n(erreicht)} erreicht` : undefined],
  ];
  const th = 'py-1.5 pr-3 font-normal';
  const td = 'py-2 pr-3 align-top';
  const Tafel = ({ titel, zahl, children }: { titel: string; zahl?: string; children: React.ReactNode }) => (
    <section className="break-inside-avoid rounded-[3px] border border-[#E4E4E7] px-4 py-3">
      <p className="flex items-baseline justify-between text-[10.5px] font-medium"><span>{titel}</span>{zahl && <span className="text-[#646B78]">{zahl}</span>}</p>
      <div className="mt-2">{children}</div>
    </section>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <button type="button" onClick={onZurueck} className={KNOPF}><ArrowLeft className="h-4 w-4" /> Zurück</button>
        <button type="button" onClick={() => pdfDrucken(`Portfolio-Bericht ${b.kunde}`)} className={KNOPF_HAUPT}><Printer className="h-4 w-4" /> Als PDF</button>
      </div>
      <div className="bericht-druck rounded border bg-white p-6 font-sans text-[#111] print:rounded-none print:border-0 print:p-0" style={EXAKT}>
        {/* Bühne */}
        <div className="relative h-[190px] overflow-hidden rounded-[3px] bg-[#F4F4F5]" style={EXAKT}>
          <img src={BILD.gelegenheiten} alt="" loading="eager" className="absolute inset-y-0 right-0 h-full w-[70%] object-cover" />
          <div className="absolute inset-0" style={{ ...EXAKT, background: 'linear-gradient(90deg, #F4F4F5 0%, #F4F4F5 32%, rgba(244,244,245,0.85) 55%, rgba(244,244,245,0) 100%)' }} />
          <div className="relative flex h-full flex-col justify-between p-6">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.16em] text-[#646B78]">
              <span className="inline-block h-2 w-2 rounded-[1px] bg-[#3D45F5]" style={EXAKT} />Bauraum · Portfolio-Bericht · vertraulich
            </div>
            <div>
              <h1 className="max-w-[70%] text-[30px] font-normal leading-[1.05] tracking-tight">{b.kunde}</h1>
              <p className="mt-2 max-w-[70%] text-[11px] text-[#646B78]">
                {[b.portfolios.map(p => `${p.name} (${n(p.parzellen)})`).join(', ') || 'Kein Portfolio', `Stand ${heute}`].join(' · ')}
              </p>
            </div>
          </div>
          <span className="absolute bottom-1.5 right-2.5 text-[7px] text-[#646B78]">Luftbild © swisstopo</span>
        </div>

        {/* Kennzahlenleiste */}
        <div className="mt-4 grid grid-cols-2 rounded-[3px] border border-[#E4E4E7] sm:grid-cols-4">
          {zahlen.map(([t, w, marke], i) => (
            <div key={t} className={`px-4 py-3 ${i % 2 ? 'border-l border-[#E4E4E7]' : ''} ${i >= 2 ? 'border-t border-[#E4E4E7] sm:border-t-0' : ''} ${i === 2 ? 'sm:border-l' : ''}`}>
              <p className="text-[9.5px] text-[#646B78]">{t}</p>
              <p className="mt-1.5 flex flex-wrap items-baseline gap-1.5">
                <span className="text-[22px] leading-none tracking-tight tabular-nums">{w}</span>
                {marke && <span className="rounded-[2px] bg-[#EEF0FF] px-1.5 py-0.5 text-[8.5px] font-medium text-[#3D45F5]" style={EXAKT}>{marke}</span>}
              </p>
            </div>
          ))}
        </div>

        {/* Gebäude und Heizungen */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Tafel titel="Gebäude im Register" zahl={`${n(b.gebaeude.mit_register)} von ${n(b.parzellen)} Parzellen`}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
              <dt className="text-[#646B78]">Gebäude</dt><dd className="text-right tabular-nums">{n(b.gebaeude.anzahl)}</dd>
              <dt className="text-[#646B78]">Wohnungen</dt><dd className="text-right tabular-nums">{n(b.gebaeude.wohnungen)}</dd>
              <dt className="text-[#646B78]">Baujahr im Schnitt</dt><dd className="text-right tabular-nums">{b.gebaeude.baujahr_schnitt ?? '–'}</dd>
              <dt className="text-[#646B78]">Gebaut bis 1975</dt><dd className="text-right tabular-nums">{n(b.gebaeude.bis_1975)}</dd>
              <dt className="text-[#646B78]">Heizt mit Öl oder Gas</dt><dd className="text-right tabular-nums">{n(b.gebaeude.fossil)}</dd>
              <dt className="text-[#646B78]">Ohne Potenzialrechnung</dt><dd className="text-right tabular-nums">{n(b.ohne_rechnung)}</dd>
            </dl>
          </Tafel>
          <Tafel titel="Heizungen">
            {basis === 0 ? <p className="text-[10px] text-[#9A9FA8]">Keine Angaben im Register.</p> : (
              <>
                <div className="flex h-2.5 overflow-hidden rounded-[2px] bg-[#F4F4F5]" style={EXAKT}>
                  {mix.map(g => <span key={g.titel} style={{ ...EXAKT, width: `${(100 * g.n) / basis}%`, background: g.farbe }} />)}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[9.5px] text-[#646B78]">
                  {mix.map(g => <span key={g.titel} className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ ...EXAKT, background: g.farbe }} /><span className="text-[#111]">{g.titel}</span> {n(g.n)}</span>)}
                  {ohne > 0 && <span>ohne Angabe {n(ohne)}</span>}
                </div>
              </>
            )}
          </Tafel>
        </div>

        {/* Reserven */}
        <div className="mt-4 space-y-3">
          <Tafel titel="Grösste Reserven" zahl={`${n(b.mit_reserve)} Parzellen ab 200 m²`}>
            {!b.top_reserve.length ? <p className="text-[10px] text-[#9A9FA8]">Keine gerechnete Reserve.</p> : (
              <div className="overflow-x-auto print:overflow-visible"><table className="w-full border-collapse text-[9.5px] leading-snug">
                <thead><tr className="border-b border-[#111] text-left text-[8.5px] text-[#646B78]">
                  <th className={th}>Adresse</th><th className={th}>Zone</th><th className={`${th} text-right`}>Fläche</th><th className={`${th} text-right`}>Reserve HNF</th>{!ohneMarge && <th className={`${th} text-right`}>Marge</th>}<th className={`${th} text-right`}>Baujahr</th></tr></thead>
                <tbody>
                  {b.top_reserve.map((t, i) => (
                    <tr key={i} className="break-inside-avoid border-b border-[#ECECEE]">
                      <td className={td}><span className="font-medium">{t.address ?? '–'}</span>{t.gemeinde ? <span className="text-[#646B78]">, {t.gemeinde}</span> : ''}{t.fossil && <span className="ml-1 text-[8px] text-[#8A6512]">Öl/Gas</span>}</td>
                      <td className={td}>{t.zone ?? '–'}</td><td className={`${td} text-right tabular-nums`}>{m2(t.area)}</td>
                      <td className={`${td} text-right tabular-nums`}>{m2(t.hnf_delta)}</td>{!ohneMarge && <td className={`${td} text-right tabular-nums`}>{chf(t.marge_chf)}</td>}
                      <td className={`${td} text-right tabular-nums`}>{t.baujahr ?? '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </Tafel>
          <Tafel titel="Ersatzneubau prüfen" zahl="50 Jahre oder älter, Zone unter 60 % genutzt">
            {!b.ersatzneubau.length ? <p className="text-[10px] text-[#9A9FA8]">Kein Kandidat nach dieser Regel.</p> : (
              <ul className="divide-y divide-[#ECECEE] text-[9.5px]">
                {b.ersatzneubau.map((e, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 py-1.5">
                    <span><span className="font-medium">{e.address ?? '–'}</span>{e.gemeinde ? <span className="text-[#646B78]">, {e.gemeinde}</span> : ''}</span>
                    <span className="shrink-0 tabular-nums text-[#646B78]">Baujahr {e.baujahr} · {m2(e.hnf_delta)} Reserve · {Math.round((e.reserve_quote ?? 0) * 100)} % frei{e.fossil ? ' · Öl/Gas' : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </Tafel>
          <Tafel titel="Nachbarn zum Zukauf" zahl={`${n(b.nachbarn.gesamt)} Nachbarn im Bestand, ${n(b.nachbarn.mit_reserve)} mit Reserve, ${n(b.nachbarn.mit_eigentuemer)} mit bekanntem Eigentümer`}>
            {!b.zukauf.length ? <p className="text-[10px] text-[#9A9FA8]">{b.nachbarn.gesamt ? 'Kein Nachbar mit Reserve oder bekanntem Eigentümer.' : 'Nachbarn noch nicht ermittelt (Gelegenheiten → Nachbarn prüfen).'}</p> : (
              <div className="overflow-x-auto print:overflow-visible"><table className="w-full border-collapse text-[9.5px] leading-snug">
                <thead><tr className="border-b border-[#111] text-left text-[8.5px] text-[#646B78]">
                  <th className={th}>Nachbar</th><th className={th}>Neben</th><th className={`${th} text-right`}>Fläche</th><th className={`${th} text-right`}>Reserve HNF</th><th className={th}>Eigentümer</th></tr></thead>
                <tbody>
                  {b.zukauf.map((z, i) => (
                    <tr key={i} className="break-inside-avoid border-b border-[#ECECEE]">
                      <td className={td}><span className="font-medium">{z.address ?? '–'}</span>{z.gemeinde ? <span className="text-[#646B78]">, {z.gemeinde}</span> : ''}</td>
                      <td className={`${td} text-[#646B78]`}>{z.neben ?? '–'}</td><td className={`${td} text-right tabular-nums`}>{m2(z.area)}</td>
                      <td className={`${td} text-right tabular-nums`}>{m2(z.hnf_delta)}</td>
                      <td className={td}>{z.eigentuemer_bekannt ? 'bekannt' : <span className="text-[#9A9FA8]">abzufragen</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </Tafel>
          <Tafel titel="Baugesuche der letzten zwölf Monate" zahl={`${n(b.baugesuche.im_portfolio)} im Portfolio, ${n(b.baugesuche.beim_nachbarn)} beim Nachbarn`}>
            {!b.baugesuche.liste.length ? <p className="text-[10px] text-[#9A9FA8]">Keines publiziert (Quelle: Kanton Zürich, eingereichte Gesuche).</p> : (
              <ul className="divide-y divide-[#ECECEE] text-[9.5px]">
                {b.baugesuche.liste.map((g, i) => (
                  <li key={i} className="break-inside-avoid py-1.5">
                    <span className="tabular-nums text-[#646B78]">{kurz(g.publiziert_am)}</span> · <span className="font-medium">{g.adresse ?? '–'}</span>{g.gemeinde ? `, ${g.gemeinde}` : ''}
                    <span className="text-[#646B78]"> · {g.im_portfolio ? 'im Portfolio' : `neben ${g.neben ?? 'einer Parzelle'}`}</span>
                    {g.beschreibung && <span className="block text-[#646B78]">{g.beschreibung}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Tafel>
          <Tafel titel="Gelegenheiten" zahl={b.gelegenheiten.je_zustand.map(z => `${n(z.n)} ${ZUSTAENDE.find(x => x[0] === z.zustand)?.[1].toLowerCase() ?? z.zustand}`).join(' · ') || 'keine'}>
            {!b.gelegenheiten.liste.length ? <p className="text-[10px] text-[#9A9FA8]">Noch keine erkannt.</p> : (
              <div className="overflow-x-auto print:overflow-visible"><table className="w-full border-collapse text-[9.5px] leading-snug">
                <thead><tr className="border-b border-[#111] text-left text-[8.5px] text-[#646B78]">
                  <th className={th}>Gelegenheit</th><th className={th}>Anlass</th><th className={th}>Stand</th><th className={th}>Erkannt</th><th className={th}>Ergebnis</th></tr></thead>
                <tbody>
                  {b.gelegenheiten.liste.map((g, i) => (
                    <tr key={i} className="break-inside-avoid border-b border-[#ECECEE]">
                      <td className={`${td} font-medium`}>{g.titel}</td><td className={td}>{ANLAESSE[g.anlass] ?? g.anlass}</td>
                      <td className={`${td} whitespace-nowrap`}>{ZUSTAENDE.find(x => x[0] === g.zustand)?.[1] ?? g.zustand}</td>
                      <td className={`${td} whitespace-nowrap tabular-nums`}>{kurz(g.erkannt_am)}</td><td className={td}>{g.ergebnis ?? <span className="text-[#9A9FA8]">–</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </Tafel>
        </div>

        <p className="mt-4 text-[8px] leading-relaxed text-[#9A9FA8]">
          Grundlagen: Parzellen und Nachbarn vom Bund (geo.admin.ch), Gebäude aus dem Gebäude- und Wohnungsregister (Stand {datum(b.stand.gebaeude)}),
          Baugesuche aus dem offenen Datensatz des Kantons Zürich (neuestes vom {datum(b.stand.baugesuch)}, nur eingereichte Gesuche).
          {ohneMarge ? 'Die Reserve ist ein gerechneter Richtwert' : 'Reserve und Marge sind gerechnete Richtwerte'} aus Zone und Bestand (Stand {datum(b.stand.potenzial)}), keine Bewertung. Zonenplanänderungen sind an keine Quelle angebunden.
          Eigentümer Dritter werden erst mit Ihrer Zustimmung und in Ihrem Namen angefragt; ihre Namen stehen in diesem Bericht nicht.
        </p>
      </div>
    </div>
  );
}
