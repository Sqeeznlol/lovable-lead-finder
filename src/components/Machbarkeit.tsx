import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Loader2, Printer } from 'lucide-react';
import { FELD, KNOPF, KNOPF_HAUPT } from '@/components/rahmen';
import { FENSTER } from '@/lib/fenster';
import { chf, m2, studieRechnen, type Art } from '@/lib/machbarkeit';
import { bewerten, CALC_ANNAHMEN, ERLOES_ANNAHME, zuerichKm, type CalcAnnahmen, type ErloesQuelle, type Neubau } from '@/lib/calc';
import { neigungLaden } from '@/lib/calc-daten';
import { ERLOES_AMTLICH } from '@/lib/erloes-daten';
import { ERLOES_ANGABEN } from '@/lib/erloes-angaben';
import { grundlageLaden, zeichnung, zoneAusBestand, zoneZh } from '@/lib/machbarkeit-daten';
import { gemeindePreise, landText, wohnungText } from '@/lib/preise';
import { drucken } from '@/lib/drucken';

/**
 * Die Machbarkeitsstudie in der Objektansicht (Julian, 15. November:
 * "richtig gute, die realistisch sind").
 *
 * Sie rechnet erst auf Wunsch: jeder Aufruf fragt den Zonenplan des
 * Kantons und die Datenbank. Gezeigt wird zuerst ein Satz mit der Zahl,
 * dann die Zeichnung, dann jede Zahl mit ihrer Herkunft -- amtlich,
 * berechnet oder Annahme. Die Annahmen lassen sich ändern, und was eine
 * Fachperson noch prüfen muss, steht am Schluss statt im Kleingedruckten.
 */
interface Parzelle {
  id: string; address?: string | null; gemeinde?: string | null; kanton?: string | null; area?: number | null; bfs_nr?: string | number | null;
  zone?: string | null; ausnuetzung?: number | string | null; vollgeschosse_zulaessig?: number | null; egrid?: string | null;
  gebaeudeflaeche?: number | null; geschosse?: number | null; baujahr?: number | null; wohnungen?: number | null;
}

/** Kantone, für die das Gebäuderegister ganz in der Datenbank steht (Tabelle gebaeude). */
const REGISTER_GELADEN = ['ZH'];

const ART: Record<Art, string> = { amtlich: 'amtlich', berechnet: 'berechnet', annahme: 'Annahme' };
const de = (n: number, stellen = 0) => n.toLocaleString('de-CH', { maximumFractionDigits: stellen });

/** Zahlenfeld, das erst beim Verlassen übernimmt -- sonst rechnet jede Ziffer neu. */
export function Zahl({ titel, wert, einheit, setWert, min, max, schritt }: { titel: string; wert: number; einheit: string; setWert: (n: number) => void; min: number; max: number; schritt: number }) {
  const [text, setText] = useState(String(wert));
  useEffect(() => { setText(String(wert)); }, [wert]);
  const uebernehmen = () => {
    const n = Number(text.replace(',', '.'));
    if (Number.isFinite(n) && n >= min && n <= max) { if (n !== wert) setWert(n); } else setText(String(wert));
  };
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{titel}</span>
      <span className="flex items-center gap-2">
        <input inputMode="decimal" value={text} step={schritt} onChange={e => setText(e.target.value)} onBlur={uebernehmen}
               onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} className={`${FELD} w-full text-base`} />
        <span className="shrink-0 text-sm text-muted-foreground">{einheit}</span>
      </span>
    </label>
  );
}

/**
 * Was es wert ist, mit denselben Zahlen wie CALC YOU LATER: Nutzfläche
 * nach Julians Praxisformel, Baukosten je m² Nutzfläche nach Preisstufe,
 * 20 % Gewinn (calc.ts). Vorher rechnete die Objektansicht mit eigenen
 * Werten (3'200 je m² Geschossfläche, 15 %) und zeigte für dieselbe
 * Parzelle eine andere Zahl als die Kalkulation.
 */
function NeubauTafel({ n, annahmen }: { n: Neubau; annahmen: CalcAnnahmen }) {
  const zeile = (titel: string, wert: string, fett = false) => (
    <div className={`flex justify-between gap-3 ${fett ? 'border-t pt-1.5 font-medium' : ''}`}>
      <dt className={fett ? '' : 'text-muted-foreground'}>{titel}</dt><dd className="tabular-nums">{wert}</dd>
    </div>
  );
  return (
    <div className="rounded-[3px] border p-4">
      <p className="font-medium">{n.abbruch > 0 ? 'Ersatzneubau' : 'Neubau'}</p>
      <p className="text-sm text-muted-foreground">{n.abbruch > 0 ? 'Bestand abbrechen, das Mögliche neu bauen und verkaufen.' : 'Das Mögliche bauen und als Eigentum verkaufen.'}</p>
      <dl className="mt-3 space-y-1.5 text-sm">
        {zeile('Nutzfläche', m2(n.hnf))}
        {zeile('Wohnungen', `rund ${de(n.wohnungen)}`)}
        {zeile('Erlös', chf(n.erloes))}
        {zeile(`Baukosten, CHF ${de(n.baukostenJeM2)} je m²`, `− ${chf(n.baukosten)}`)}
        {n.abbruch > 0 && zeile('Abbruch', `− ${chf(n.abbruch)}`)}
        {zeile(`Gewinn ${de(annahmen.marge * 100)} %`, `− ${chf(n.gewinn)}`)}
        {zeile('Bleibt für das Land', n.landwert < 0 ? `− ${chf(-n.landwert)}` : chf(n.landwert), true)}
        {zeile('je m² Grundstück', `CHF ${de(Math.round(n.jeM2 / 10) * 10)}`)}
      </dl>
    </div>
  );
}

export function Machbarkeit({ parzelle }: { parzelle: Parzelle }) {
  const navigate = useNavigate();
  const [auf, setAuf] = useState(false);
  const bfs = parzelle.bfs_nr != null ? String(Number(parzelle.bfs_nr)) : null;
  // Wo der Verkaufspreis je m² bekannt ist, gilt er statt der Annahme (wie in CALC YOU LATER).
  const vorgabe = useMemo((): { annahmen: CalcAnnahmen; quelle: ErloesQuelle } => {
    const amtlich = bfs ? ERLOES_AMTLICH[bfs] : null, angabe = bfs ? ERLOES_ANGABEN[bfs] : null;
    if (amtlich) return { annahmen: { ...CALC_ANNAHMEN, erloes: amtlich.m2 }, quelle: { art: 'amtlich', text: amtlich.text } };
    if (angabe) return { annahmen: { ...CALC_ANNAHMEN, erloes: Math.round((angabe.von + angabe.bis) / 2) },
      quelle: { art: 'angabe', text: `Angabe Julian vom ${angabe.am}: ${angabe.gemeinde} ${de(angabe.von)} bis ${de(angabe.bis)} je m², Mitte` } };
    return { annahmen: CALC_ANNAHMEN, quelle: ERLOES_ANNAHME };
  }, [bfs]);
  const [annahmen, setAnnahmen] = useState<CalcAnnahmen>(vorgabe.annahmen);
  const [erloesQuelle, setErloesQuelle] = useState<ErloesQuelle>(vorgabe.quelle);
  const setze = (teil: Partial<CalcAnnahmen>) => setAnnahmen(a => ({ ...a, ...teil }));
  // Eine andere Parzelle: zu, und mit den Ausgangswerten.
  useEffect(() => { setAuf(false); setAnnahmen(vorgabe.annahmen); setErloesQuelle(vorgabe.quelle); }, [parzelle.id, vorgabe]);

  const grundlage = useQuery({
    queryKey: ['machbarkeit-grundlage', parzelle.id, annahmen.grenzabstand],
    queryFn: () => grundlageLaden(parzelle.id, annahmen.grenzabstand),
    enabled: auf, staleTime: 5 * 60 * 1000, placeholderData: alt => alt,
  });
  const punkt = grundlage.data?.punkt ?? null;
  // Der amtliche Zonenplan ist nur für Zürich angebunden; fällt er aus, gilt die eigene Liste.
  const amtlich = useQuery({
    queryKey: ['machbarkeit-zone', punkt?.[0], punkt?.[1]],
    queryFn: ({ signal }) => zoneZh(punkt![0], punkt![1], signal),
    enabled: auf && !!punkt && parzelle.kanton === 'ZH', staleTime: 60 * 60 * 1000, retry: 1,
  });
  const preise = useQuery({ queryKey: ['gemeinde-preise', parzelle.bfs_nr], queryFn: () => gemeindePreise(parzelle.bfs_nr), enabled: auf, staleTime: Infinity });
  // Hanglage: die Steigung aus dem Geländemodell des Bundes, für den Zuschlag auf die Baukosten.
  const neigung = useQuery({ queryKey: ['neigung', punkt?.[0], punkt?.[1]], queryFn: () => neigungLaden(punkt![0], punkt![1]), enabled: auf && !!punkt, staleTime: Infinity });

  const liste = useMemo(() => zoneAusBestand(parzelle), [parzelle]);
  const wartetAufZone = parzelle.kanton === 'ZH' && !!punkt && amtlich.isLoading;
  const zone = amtlich.data ?? liste?.regeln ?? null;
  // Bestand: das Register, wo es geladen ist; sonst was die eigene Liste zur Parzelle weiss.
  const ausRegister = grundlage.data?.gebaeude ?? [];
  const ausListe = !ausRegister.length && parzelle.gebaeudeflaeche && parzelle.geschosse
    ? [{ grundflaeche: parzelle.gebaeudeflaeche, geschosse: parzelle.geschosse, baujahr: parzelle.baujahr ?? null, wohnungen: parzelle.wohnungen ?? null }] : null;
  const eingabe = useMemo(() => ({
    flaeche: parzelle.area ?? grundlage.data?.flaeche_umriss ?? null,
    bauzoneM2: amtlich.data ? null : liste?.bauzoneM2,
    bebaubarM2: grundlage.data?.umriss_da ? grundlage.data.bebaubar_m2 : null,
    zone, gebaeude: ausListe ?? ausRegister, bestandQuelle: (ausListe ? 'liste' : 'register') as 'liste' | 'register',
    registerVollstaendig: REGISTER_GELADEN.includes(parzelle.kanton ?? ''),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- ausListe und ausRegister folgen aus parzelle und grundlage.data
  }), [parzelle, grundlage.data, amtlich.data, liste, zone]);
  const studie = useMemo(() => studieRechnen({ ...eingabe, annahmen }), [eingabe, annahmen]);
  const b = useMemo(() => bewerten({
    grundlage: eingabe, annahmen, kanton: parzelle.kanton ?? null, hand: {}, erloesQuelle,
    umfeld: { gemeinde: preise.data?.name ?? parzelle.gemeinde, land: preise.data?.land ?? null, stwe: preise.data?.stwe ?? null, efh: preise.data?.efh ?? null,
      neigung: neigung.data ?? null, zuerichKm: punkt ? zuerichKm(punkt[0], punkt[1]) : null },
  }), [eingabe, annahmen, parzelle.kanton, parzelle.gemeinde, erloesQuelle, preise.data, neigung.data, punkt]);
  const bild = useMemo(() => (grundlage.data ? zeichnung(grundlage.data) : null), [grundlage.data]);

  if (!auf) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg">Machbarkeit</h3>
          <p className="text-sm text-muted-foreground">Was hier Platz hat und was es wert ist, mit der Herkunft jeder Zahl.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={KNOPF} onClick={() => setAuf(true)}>Rechnen</button>
          {/* CALC YOU LATER macht aus derselben Rechnung eine Kaufpreisempfehlung mit Freigabe. */}
          {parzelle.address && (
            <button type="button" className={KNOPF}
                    onClick={() => navigate(`/calc?neu=${encodeURIComponent([parzelle.address, parzelle.gemeinde].filter(Boolean).join(', '))}`)}>
              Kaufpreis kalkulieren
            </button>
          )}
        </div>
      </div>
    );
  }

  const laedt = grundlage.isLoading || wartetAufZone;
  const land = preise.data?.land, wohnung = preise.data?.stwe;
  const n = b.neubau;
  const rechenbar = studie.rechenbar || !!n;
  const titel = `Machbarkeit ${parzelle.address ?? parzelle.egrid ?? ''}`.trim();
  const praxis = !!n?.hnfText?.startsWith('Praxisformel');
  const kosten = n?.kosten;

  return (
    <section className="bericht-druck space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg">Machbarkeit</h3>
          <p className="hidden text-sm print:block">{[parzelle.address, parzelle.gemeinde].filter(Boolean).join(', ')} · Stand {new Date().toLocaleDateString('de-CH')}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          {rechenbar && <button type="button" className={KNOPF} onClick={() => drucken(titel)}><Printer className="h-4 w-4" /> Als PDF</button>}
          <button type="button" className={KNOPF} onClick={() => setAuf(false)}>Schliessen</button>
        </div>
      </div>

      {laedt && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Umriss und Zonenplan werden geholt …</p>}
      {grundlage.error && <p className="text-sm text-destructive">Die Grundlage liess sich nicht laden. Später nochmals versuchen.</p>}
      {!laedt && !grundlage.error && !rechenbar && <p className="text-sm text-muted-foreground">Nicht rechenbar: {studie.grund}</p>}

      {!laedt && rechenbar && n && (
        <>
          {/* Ein Satz mit der Zahl, wie im Cockpit. */}
          <p className="text-[22px] leading-snug tracking-tight">
            Möglich sind rund <span className="font-semibold">{m2(n.hnf)}</span> Nutzfläche{praxis ? ' nach der Praxisformel' : ''}
            {studie.gfBestand != null ? <>, heute stehen {m2(studie.gfBestand)} Geschossfläche</> : null}.{' '}
            <span className="text-muted-foreground">
              {/* Nur wenn wirklich die Abstände begrenzen: in Baumassen-Zonen ist die Machbarkeit auch ohne Abstände kleiner (Dach in der Baumasse, kein Attika). */}
              {praxis && studie.rechenbar && studie.begrenzt === 'huelle' && studie.hnfNeu < n.hnf * 0.9
                ? `Zwischen den Grenzabständen haben nur ${m2(studie.hnfNeu)} Platz.`
                : praxis ? 'Die Ziffer der Zone begrenzt.' : 'Die Zone nennt keine Ziffer: gerechnet ist mit Abständen und Geschossen.'}
            </span>
          </p>

          {amtlich.isError && parzelle.kanton === 'ZH' && (
            <p className="text-sm text-muted-foreground">Der Zonenplan des Kantons antwortet gerade nicht; gerechnet ist mit der eigenen Liste.</p>
          )}

          <div className="grid gap-5 sm:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            {bild ? (
              <figure className="space-y-2">
                <svg viewBox="0 0 320 320" role="img" aria-label="Umriss der Parzelle mit der bebaubaren Fläche" className="w-full rounded-[3px] border bg-secondary/40">
                  <path d={bild.umriss} fillRule="evenodd" className="fill-card stroke-foreground" strokeWidth={1.5} strokeLinejoin="round" />
                  {bild.innen && <path d={bild.innen} fillRule="evenodd" className="fill-accent/25 stroke-accent" strokeWidth={1} strokeDasharray="4 3" strokeLinejoin="round" />}
                  {/* Massstab: zehn Meter. */}
                  <line x1={16} y1={304} x2={16 + 10 / bild.meterJePixel} y2={304} className="stroke-foreground" strokeWidth={2} />
                  <text x={16} y={298} className="fill-muted-foreground text-[10px]">10 m</text>
                </svg>
                <figcaption className="text-sm text-muted-foreground">
                  Umriss laut Amtlicher Vermessung, Norden oben. Blau: bebaubar bei {de(annahmen.grenzabstand, 1)} m Grenzabstand
                  {grundlage.data?.bebaubar_m2 != null ? `, ${m2(grundlage.data.bebaubar_m2)}` : ''}.
                </figcaption>
              </figure>
            ) : (
              <p className="rounded-[3px] border border-dashed p-4 text-sm text-muted-foreground">Für diese Parzelle ist kein Umriss eingelesen; gerechnet ist ohne Hülle.</p>
            )}

            <div className="space-y-4 print:hidden">
              <p className="text-sm text-muted-foreground">Annahmen, die Sie ändern können. Die Rechnung folgt sofort.</p>
              <div className="grid grid-cols-2 gap-3">
                <Zahl titel="Grenzabstand" wert={annahmen.grenzabstand} einheit="m" min={0} max={30} schritt={0.5} setWert={x => setze({ grenzabstand: x })} />
                <Zahl titel="Wohnungsgrösse" wert={annahmen.wohnungM2} einheit="m²" min={30} max={250} schritt={5} setWert={x => setze({ wohnungM2: x })} />
                <Zahl titel="Erlös je m² Nutzfläche" wert={annahmen.erloes} einheit="CHF" min={2000} max={60000} schritt={100}
                      setWert={x => { setze({ erloes: x }); setErloesQuelle({ art: 'hand', text: 'von Hand eingegeben' }); }} />
                <Zahl titel="Gewinn vom Erlös" wert={Math.round(annahmen.marge * 1000) / 10} einheit="%" min={0} max={50} schritt={1} setWert={x => setze({ marge: x / 100 })} />
              </div>
              <p className="text-sm text-muted-foreground">Erlös: {erloesQuelle.text}.</p>
              {kosten && (
                <p className="text-sm text-muted-foreground">
                  Baukosten inklusive Nebenkosten: CHF {de(kosten.grund)} je m² Nutzfläche bei diesem Erlös
                  {kosten.hang > 0 && `, +${Math.round(kosten.hang * 100)} % Hanglage`}
                  {kosten.zuerich > 0 && `, +${de(kosten.zuerich * 100, 1)} % Nähe zu Zürich`} = CHF {de(n.baukostenJeM2)}.
                </p>
              )}
              {wohnung && <p className="text-sm text-muted-foreground">Eigentumswohnungen in {preise.data!.name}: {wohnungText(wohnung)} (Statistik {preise.data!.k}).</p>}
            </div>
          </div>

          {b.herkunft.map(a => (
            <div key={a.titel} className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{a.titel}</p>
              <dl className="divide-y rounded-[3px] border">
                {a.zeilen.map(z => (
                  <div key={z.titel} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 px-3 py-2 text-sm">
                    <dt>{z.titel}</dt>
                    <dd className="text-right font-medium tabular-nums">{z.wert}</dd>
                    <dd className="col-span-2 text-xs text-muted-foreground">{ART[z.art]} · {z.quelle}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}

          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Was es wert ist</p>
            <div className="grid gap-3 sm:grid-cols-2"><NeubauTafel n={n} annahmen={annahmen} /></div>
            <p className="text-xs text-muted-foreground">
              Wie in CALC YOU LATER: Erlös CHF {de(annahmen.erloes)} je m² Nutzfläche, Baukosten CHF {de(n.baukostenJeM2)} je m² Nutzfläche
              inklusive Nebenkosten, Abbruch CHF {de(annahmen.abbruch)} je m² Bestand, {de(annahmen.marge * 100)} % des Erlöses als Gewinn.
            </p>
            {/* Der Massstab: was in der Gemeinde für Land wirklich bezahlt wurde. */}
            {land && (
              <p className="text-sm">
                Zum Vergleich, bezahltes Wohnbauland in {preise.data!.name}: {landText(land)} (amtlich, Statistik {preise.data!.k}).{' '}
                {n.jeM2 > (land.q75 ?? land.m) * 1.25 ? 'Die Rechnung liegt deutlich darüber: Erlös und Kosten prüfen, bevor die Zahl hält.'
                  : n.jeM2 < (land.q25 ?? land.m) * 0.75 ? 'Die Rechnung liegt deutlich darunter: zu diesem Landpreis trägt das Projekt nicht.'
                  : 'Die Rechnung liegt im Rahmen dessen, was bezahlt wird.'}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Vor einem Entscheid prüfen</p>
            <ul className="list-disc space-y-1 pl-5 text-sm">{studie.pruefen.map(p => <li key={p}>{p}</li>)}</ul>
            {zone?.dokument && (
              <a href={zone.dokument} target={FENSTER.portal} className="inline-flex min-h-11 items-center gap-1 text-sm text-accent print:hidden">
                <ExternalLink className="h-3.5 w-3.5" /> Bauordnung und Zonenplan der Gemeinde (amtliche Dokumente)
              </a>
            )}
          </div>
          <button type="button" className={`${KNOPF_HAUPT} w-full sm:hidden print:hidden`} onClick={() => setAuf(false)}>Schliessen</button>
        </>
      )}
    </section>
  );
}
