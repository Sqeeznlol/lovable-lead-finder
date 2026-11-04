import { PortfolioBericht } from '@/components/PortfolioBericht';
import { lazy, Suspense, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, HardHat, MessageSquare, Search, Sparkles, Trash2 } from 'lucide-react';
import { Abschnitt, FELD, KNOPF, KNOPF_HAUPT, KNOPF_LEISE, Leer, LISTE, Marke, Reiter, Seite, Strichbalken } from '@/components/rahmen';
import { Auswahl } from '@/components/Auswahl';
import { ImmoKalender, kalenderZahlen } from '@/components/ImmoKalender';
import { Universum } from '@/components/fonds/Universum';
import { useUrlWert } from '@/hooks/use-url-wert';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { BILD } from '@/lib/luftbild';
import { zeitraum } from '@/lib/immo-kalender';
import { lv95NachWgs84 } from '@/lib/koordinaten';
import { FOTO_MOEGLICH } from '@/lib/karte3d';
import { fondsFarbe, POTENZIAL, type PotenzialArt, type Universum as UniversumDaten } from '@/lib/fonds';
import {
  baugesucheLaden, faellig, lagenLesen, notizErledigt, notizenLaden, notizSpeichern, potenzialSchluessel,
  staendeLaden, standSetzen, STAENDE, suchprofileLaden, suchprofilLoeschen, suchprofilSpeichern, suchtrefferLaden,
  type Stand,
} from '@/lib/fonds-werkzeuge';

/**
 * Die Bereiche von Wohntraums ausser der Übersicht. Julian (1. November):
 * dieselben Werkzeuge wie Bauraum -- Gespräche, Suchprofile, Baugesuche,
 * Gelegenheiten, Karte, Kalender --, aber auf eine Fondsleitung
 * abgestimmt: alles bezieht sich auf die eigenen Liegenschaften, nie auf
 * Eigentümer. Jeder Bereich ist eine Seite nach DESIGN.md.
 */

const n = (x: number | null | undefined) => (x == null ? '–' : Math.round(x).toLocaleString('de-CH'));
const chf = (v: number | null | undefined) => (!v ? '–' : v >= 1e9 ? `${(v / 1e9).toFixed(1)} Mrd` : `${(v / 1e6).toFixed(1)} Mio`);
const datum = (d: string | null) => (d ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('de-CH', { day: 'numeric', month: 'short', year: 'numeric' }) : '–');
const heute = () => new Date().toISOString().slice(0, 10);
const vorTagen = (d: string) => {
  const t = Math.round((Date.parse(heute() + 'T12:00:00') - Date.parse(d + 'T12:00:00')) / 864e5);
  return t <= 0 ? 'heute' : t === 1 ? 'gestern' : `vor ${t} Tagen`;
};

export interface BereichProps {
  data: UniversumDaten; als: string | null; team: string | null;
  /** Zu einem anderen Bereich, mit Zusatz in der Adresse (z.B. liegenschaft). */
  gehe: (bereich: string, extra?: Record<string, string>) => void;
}

// =========================================================== Karte
// Cesium ist gross (1,1 MB) -- erst laden, wenn jemand auf "3D" tippt.
const Karte3D = lazy(() => import('@/components/karte3d/Karte3D').then(m => ({ default: m.Karte3D })));
// Nachgemessen (iPhone 13, iPhone SE, Desktop 900 px): Die Karte beginnt
// unter Kopf und Umschalter bei 155 px und soll über der unteren Leiste
// enden. 420 px Mindesthöhe schoben sie auf dem SE 68 px darunter.
const KARTE_HOEHE = 'h-[calc(100dvh-14.5rem)] min-h-[320px] lg:h-[calc(100dvh-11.5rem)]';

/**
 * Das Universum als Karte, oder in 3D um eine Liegenschaft: jedes Haus
 * mit Umriss und Höhe, die Zonen am Boden, die Häuser der Fonds in ihrer
 * Farbe (Julian, 3. November: "genau so die 3D-Map").
 */
export function FondsKarte({ data }: BereichProps) {
  const [gewaehlt, setGewaehlt] = useUrlWert('liegenschaft');
  const [ansicht, setAnsicht] = useUrlWert('ansicht', 'karte');
  const nr = useMemo(() => new Map(data.fonds.map(f => [f.id, f.nr])), [data]);
  const wahl = data.punkte.find(p => p.id === gewaehlt);
  const verortet = useMemo(() => data.punkte.filter(p => p.e != null && p.n != null)
    .sort((a, b) => a.adresse.localeCompare(b.adresse, 'de-CH')), [data]);
  // In 3D zählt ein Ort: die gewählte Liegenschaft, sonst die mit den
  // meisten Fondshäusern in Sichtweite -- die erste nach Alphabet stand
  // im Test allein in Winterthur, und man sah keinen einzigen Fonds.
  const dichteste = useMemo(() => {
    let beste = verortet[0], bestZahl = -1;
    for (const a of verortet) {
      const zahl = verortet.filter(b => Math.hypot(b.e! - a.e!, b.n! - a.n!) < 900).length;
      if (zahl > bestZahl || (zahl === bestZahl && (a.marge ?? 0) > (beste?.marge ?? 0))) { beste = a; bestZahl = zahl; }
    }
    return beste;
  }, [verortet]);
  const ort = wahl?.e != null && wahl.n != null ? wahl : dichteste;
  const ziel = useMemo(() => (ort ? { ...lv95NachWgs84(ort.e!, ort.n!), abstand: 420 } : null), [ort]);
  // Markiert werden die Fondshäuser in Sichtweite; weiter weg sieht man sie nicht.
  const markiert = useMemo(() => (!ort ? [] : verortet
    .filter(p => p.egrid && Math.hypot(p.e! - ort.e!, p.n! - ort.n!) < 900)
    .slice(0, 60)
    .map(p => ({ egrid: p.egrid!, farbe: fondsFarbe(nr.get(p.fonds) ?? 1), titel: p.adresse }))), [ort, verortet, nr]);
  // Nur die Fonds, die in diesem Ausschnitt vorkommen.
  const legende = useMemo(() => {
    const da = new Set(markiert.map(m => m.farbe));
    return data.fonds.filter(f => da.has(fondsFarbe(f.nr))).map(f => ({ titel: `Fonds ${f.nr}`, farbe: fondsFarbe(f.nr) }));
  }, [markiert, data.fonds]);
  const in3d = ansicht === '3d';
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Reiter<string> wahl={in3d ? '3d' : 'karte'} setWahl={w => setAnsicht(w === '3d' ? '3d' : null)}
          optionen={[{ wert: 'karte', titel: 'Karte' }, { wert: '3d', titel: '3D' }]} />
        {in3d && verortet.length > 0 && (
          <Auswahl label="Liegenschaft" wert={ort?.id ?? ''} setWert={setGewaehlt} className="min-w-0 flex-1 sm:max-w-[360px]"
            optionen={verortet.map(p => ({ wert: p.id, titel: `${p.adresse}${p.gemeinde ? `, ${p.gemeinde}` : ''}` }))} />
        )}
      </div>
      {!in3d ? (
        <Universum punkte={data.punkte} kanten={data.kanten} fonds={data.fonds} gewaehlt={gewaehlt} onWahl={setGewaehlt} hoehe={KARTE_HOEHE} />
      ) : !ziel ? (
        <Leer titel="Noch keine Liegenschaft verortet." />
      ) : (
        <div className="overflow-hidden rounded border">
          <Suspense fallback={<div className={`grid place-items-center bg-[#DCE6EF] text-sm text-[#333] ${KARTE_HOEHE}`}>3D-Karte wird geladen …</div>}>
            <Karte3D ziel={ziel} markiert={markiert} legende={legende} intern={false} faerbungen={['foto', 'modell', 'heizung', 'baujahr', 'hoehe']}
              start={FOTO_MOEGLICH ? 'foto' : 'modell'} hoehe={KARTE_HOEHE} />
          </Suspense>
        </div>
      )}
      {(wahl ?? (in3d ? ort : undefined)) && (() => {
        const w = (wahl ?? ort)!;
        return (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded border bg-card px-5 py-4">
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: fondsFarbe(nr.get(w.fonds) ?? 1) }} />Fonds {nr.get(w.fonds)}
              </span>
              <span className="block text-lg font-semibold">{w.adresse}</span>
              <span className="block text-sm text-muted-foreground">{[w.gemeinde, w.zone, w.flaeche ? `${n(w.flaeche)} m²` : null].filter(Boolean).join(' · ')}</span>
            </span>
            <span className="text-right"><span className="block text-xs text-muted-foreground">Marge</span><span className="text-lg font-semibold text-violett">{chf(w.marge)}</span></span>
          </div>
        );
      })()}
    </div>
  );
}

// ====================================================== Potenziale
export function FondsPotenziale({ data, team, gehe }: BereichProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: staende } = useQuery({ queryKey: ['fonds-staende', team], queryFn: () => staendeLaden(team!), enabled: !!team });
  const [sicht, setSicht] = useUrlWert('stand', 'pendent');
  const [art, setArt] = useUrlWert('potenzial', 'alle');
  const nr = useMemo(() => new Map(data.fonds.map(f => [f.id, f.nr])), [data]);
  const punkt = useMemo(() => new Map(data.punkte.map(p => [p.id, p])), [data]);
  const standVon = (p: (typeof data.potenziale)[number]) => staende?.get(potenzialSchluessel(p)) ?? 'pendent';
  const zahl = (s: Stand) => data.potenziale.filter(p => standVon(p) === s).length;
  const liste = data.potenziale.filter(p => standVon(p) === sicht && (art === 'alle' || p.art === art));
  const setzen = async (schluessel: string, s: Stand) => {
    if (!team) return;
    try { await standSetzen(team, schluessel, s); await qc.invalidateQueries({ queryKey: ['fonds-staende', team] }); }
    catch (e) { toast({ title: 'Nicht gespeichert', description: e instanceof Error ? e.message : String(e), variant: 'destructive' }); }
  };
  const pendent = zahl('pendent');
  return (
    <Seite bild={BILD.fondsPotenziale} ueber={`Potenziale · ${data.gesellschaft ?? 'Fondsleitung'}`}
      titel={pendent ? `${n(pendent)} Potenziale warten auf Ihre Prüfung` : 'Alle Potenziale bearbeitet'}
      unter="Was die Rechnung aus Ihren Datensätzen findet. Prüfen, erledigen oder verwerfen -- erst dann ist ein Potenzial nicht mehr pendent."
      kennzahlen={STAENDE.map(([s, t]) => ({ titel: t, wert: n(zahl(s)), onClick: () => setSicht(s),
        marke: s === 'pendent' && zahl(s) ? <Marke art="heiss">offen</Marke> : undefined }))}>
      <div className="flex flex-wrap items-center gap-2">
        <Reiter<string> wahl={sicht ?? 'pendent'} setWahl={setSicht} optionen={STAENDE.map(([s, t]) => ({ wert: s, titel: t, zahl: zahl(s) }))} />
        <Auswahl label="Art" wert={art ?? 'alle'} setWert={setArt} className="min-w-[180px]" optionen={[
          { wert: 'alle', titel: 'Alle Arten' }, ...(Object.keys(POTENZIAL) as PotenzialArt[]).map(a => ({ wert: a, titel: POTENZIAL[a].titel })),
        ]} />
      </div>
      {liste.length === 0 ? <Leer titel="Nichts in dieser Auswahl." /> : (
        <ul className={LISTE}>
          {liste.slice(0, 200).map(p => {
            const s = potenzialSchluessel(p);
            const a = punkt.get(p.parzelle);
            return (
              <li key={s} className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <button type="button" className="min-w-0 space-y-1 text-left" onClick={() => gehe('karte', { liegenschaft: p.parzelle })}>
                  <span className="flex flex-wrap items-center gap-2">
                    <Marke art={p.art === 'arrondierung' ? 'heiss' : p.art === 'nachbar_baut' ? 'lila' : p.art === 'reserve' ? 'violett' : 'grau'}>{POTENZIAL[p.art].kurz}</Marke>
                    {a && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: fondsFarbe(nr.get(a.fonds) ?? 1) }} />Fonds {nr.get(a.fonds)}</span>}
                    {p.marge ? <span className="text-sm font-semibold text-violett">{chf(p.marge)}</span> : null}
                  </span>
                  <span className="block font-semibold">{p.titel}</span>
                  <span className="block text-sm text-muted-foreground">{p.wo}</span>
                </button>
                <span className="flex gap-2">
                  <Auswahl label="Stand" wert={standVon(p)} setWert={w => void setzen(s, w as Stand)} klein className="min-w-[140px]"
                           optionen={STAENDE.map(([w, t]) => ({ wert: w, titel: t }))} />
                  <button type="button" className={`${KNOPF} h-10 px-3`} title="Gespräch erfassen" aria-label="Gespräch erfassen"
                          onClick={() => gehe('gespraeche', { neu: p.parzelle })}><MessageSquare className="h-4 w-4" /></button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Seite>
  );
}

// ====================================================== Baugesuche
export function FondsBaugesuche({ data, als, gehe }: BereichProps) {
  const [tageWert, setTage] = useUrlWert('tage', '30');
  const tage = Number(tageWert) || 30;
  const [lage, setLage] = useUrlWert('lage', 'alle');
  const { data: gesuche, isLoading, error } = useQuery({ queryKey: ['fonds-baugesuche', als, tage], queryFn: () => baugesucheLaden(als, tage) });
  const { data: woche } = useQuery({ queryKey: ['fonds-baugesuche', als, 7], queryFn: () => baugesucheLaden(als, 7) });
  const nr = useMemo(() => new Map(data.fonds.map(f => [f.id, f.nr])), [data]);
  const liste = (gesuche ?? []).filter(g => lage === 'alle' || g.lage === lage);
  const auf = (gesuche ?? []).filter(g => g.lage === 'auf').length;
  const neben = (gesuche ?? []).length - auf;
  const betroffen = new Set((gesuche ?? []).map(g => g.liegenschaft)).size;
  return (
    <Seite bild={BILD.fondsBaugesuche} ueber={`Baugesuche · bei Ihren Liegenschaften`}
      titel={woche ? `${n(new Set(woche.map(g => g.id)).size)} Baugesuche in 7 Tagen an oder neben Ihren Liegenschaften` : ' '}
      unter="Baut der Nachbar, ändert sich der Wert -- und oft entsteht ein Anlass für ein Gespräch. Aus dem Amtsblatt, beim Bund verortet."
      kennzahlen={gesuche ? [
        { titel: 'Gesuche', wert: n(new Set(gesuche.map(g => g.id)).size), marke: <Marke art="minze">{tage} Tage</Marke>, onClick: () => setLage('alle') },
        { titel: 'Auf eigener Liegenschaft', wert: n(auf), marke: <Marke art="lila">eigene</Marke>, onClick: () => setLage('auf') },
        { titel: 'Nebenan', wert: n(neben), marke: neben ? <Marke art="heiss">Nachbar baut</Marke> : undefined, onClick: () => setLage('nebenan') },
        { titel: 'Betroffene Liegenschaften', wert: n(betroffen) },
      ] : undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <Reiter<string> wahl={lage ?? 'alle'} setWahl={setLage} optionen={[{ wert: 'alle', titel: 'Alle' }, { wert: 'nebenan', titel: 'Nebenan' }, { wert: 'auf', titel: 'Auf eigener' }]} />
        <Auswahl label="Zeitraum" wert={String(tage)} setWert={w => setTage(w)} className="min-w-[170px]" optionen={[
          { wert: '7', titel: 'Letzte 7 Tage' }, { wert: '30', titel: 'Letzte 30 Tage' }, { wert: '90', titel: 'Letzte 90 Tage' }, { wert: '365', titel: 'Letztes Jahr' },
        ]} />
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">wird geladen …</p>
        : error ? <p className="text-sm text-destructive">Baugesuche nicht lesbar.</p>
        : liste.length === 0 ? <Leer titel="Keine Baugesuche in diesem Zeitraum.">Einen längeren Zeitraum wählen.</Leer> : (
        <ul className={LISTE}>
          {liste.map(g => (
            <li key={`${g.id}-${g.liegenschaft}`} className="space-y-1.5 px-5 py-4">
              <span className="flex flex-wrap items-center gap-2">
                <Marke art={g.lage === 'auf' ? 'lila' : 'heiss'}>{g.lage === 'auf' ? 'Auf Ihrer Liegenschaft' : 'Nebenan'}</Marke>
                <span className="text-sm text-accent">{vorTagen(g.publiziert_am)}</span>
                <span className="text-sm text-muted-foreground">{g.zustand}</span>
              </span>
              <p className="font-semibold">{g.beschreibung ?? 'Baugesuch'}</p>
              <p className="text-sm text-muted-foreground">{[g.adresse, g.gemeinde, g.kosten_chf ? `${chf(g.kosten_chf)} CHF` : null].filter(Boolean).join(' · ')}</p>
              <button type="button" className="inline-flex min-h-11 items-center gap-2 text-sm hover:underline" onClick={() => gehe('karte', { liegenschaft: g.liegenschaft })}>
                <span className="h-2 w-2 rounded-full" style={{ background: fondsFarbe(nr.get(g.fonds) ?? 1) }} />
                Ihre Liegenschaft: {g.liegenschaft_adresse ?? '–'} · Fonds {nr.get(g.fonds)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Seite>
  );
}

// ======================================================= Gespräche
export function FondsGespraeche({ data, team }: BereichProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [neu, setNeu] = useUrlWert('neu');
  const [sicht, setSicht] = useUrlWert('sicht', 'alle');
  const { data: notizen, isLoading } = useQuery({ queryKey: ['fonds-notizen', team], queryFn: () => notizenLaden(team!), enabled: !!team });
  const leer = { parzelle: neu ?? '', mit: '', text: '', am: heute(), wiedervorlage: '' };
  const [f, setF] = useState(leer);
  const [laeuft, setLaeuft] = useState(false);
  const adresse = useMemo(() => new Map(data.punkte.map(p => [p.id, p.adresse])), [data]);
  const fl = notizen?.filter(x => faellig(x)) ?? [];
  const liste = (notizen ?? []).filter(x => sicht === 'faellig' ? faellig(x) : sicht === 'offen' ? !x.erledigt && !!x.wiedervorlage : true);
  const speichern = async () => {
    if (!team || !f.text.trim()) return;
    setLaeuft(true);
    try {
      await notizSpeichern({ team_id: team, parzelle_id: f.parzelle || null, mit: f.mit.trim() || null, text: f.text.trim(), am: f.am,
        wiedervorlage: f.wiedervorlage || null, von: user?.email ?? null });
      setF({ ...leer, parzelle: '' }); setNeu(null);
      await qc.invalidateQueries({ queryKey: ['fonds-notizen', team] });
      toast({ title: 'Gespräch gespeichert' });
    } catch (e) {
      toast({ title: 'Nicht gespeichert', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally { setLaeuft(false); }
  };
  const umschalten = async (id: string, erledigt: boolean) => {
    try { await notizErledigt(id, erledigt); await qc.invalidateQueries({ queryKey: ['fonds-notizen', team] }); }
    catch (e) { toast({ title: 'Nicht gespeichert', description: e instanceof Error ? e.message : String(e), variant: 'destructive' }); }
  };
  return (
    <Seite bild={BILD.fondsGespraeche} ueber="Gespräche · Nachbarn, Verwaltungen, Gemeinden"
      titel={fl.length ? `${fl.length} ${fl.length === 1 ? 'Wiedervorlage ist' : 'Wiedervorlagen sind'} fällig` : `${n(notizen?.length ?? 0)} Gespräche festgehalten`}
      unter="Wer mit wem worüber gesprochen hat, je Liegenschaft -- damit eine Arrondierung nicht an einem vergessenen Rückruf scheitert."
      kennzahlen={[
        { titel: 'Gespräche', wert: n(notizen?.length ?? 0), onClick: () => setSicht('alle') },
        { titel: 'Fällig', wert: n(fl.length), marke: fl.length ? <Marke art="rosa">heute</Marke> : undefined, onClick: () => setSicht('faellig') },
        { titel: 'Mit Wiedervorlage', wert: n((notizen ?? []).filter(x => !x.erledigt && x.wiedervorlage).length), onClick: () => setSicht('offen') },
        { titel: 'Liegenschaften', wert: n(new Set((notizen ?? []).map(x => x.parzelle_id).filter(Boolean)).size) },
      ]}
      seite={
        <section className="space-y-3">
          <h2 className="text-lg">Gespräch erfassen</h2>
          <Auswahl label="Liegenschaft" wert={f.parzelle} setWert={w => setF({ ...f, parzelle: w })} className="w-full" optionen={[
            { wert: '', titel: 'Allgemein, keine Liegenschaft' },
            ...data.punkte.slice().sort((a, b) => a.adresse.localeCompare(b.adresse)).map(p => ({ wert: p.id, titel: `${p.adresse}${p.gemeinde ? `, ${p.gemeinde}` : ''}` })),
          ]} />
          <input className={`${FELD} w-full`} placeholder="Mit wem (z.B. Verwaltung Nachbarhaus)" value={f.mit} onChange={e => setF({ ...f, mit: e.target.value })} />
          <textarea className="min-h-28 w-full rounded-[3px] border bg-card px-3.5 py-3 text-[15px]" placeholder="Worum ging es, was ist vereinbart?"
                    value={f.text} onChange={e => setF({ ...f, text: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs text-muted-foreground">Am<input type="date" className={`${FELD} w-full`} value={f.am} onChange={e => setF({ ...f, am: e.target.value })} /></label>
            <label className="space-y-1 text-xs text-muted-foreground">Wiedervorlage<input type="date" className={`${FELD} w-full`} value={f.wiedervorlage} onChange={e => setF({ ...f, wiedervorlage: e.target.value })} /></label>
          </div>
          <button type="button" className={`${KNOPF_HAUPT} w-full`} disabled={!f.text.trim() || laeuft || !team} onClick={() => void speichern()}>Speichern</button>
        </section>
      }>
      <Reiter<string> wahl={sicht ?? 'alle'} setWahl={setSicht} optionen={[
        { wert: 'alle', titel: 'Alle', zahl: notizen?.length }, { wert: 'faellig', titel: 'Fällig', zahl: fl.length },
        { wert: 'offen', titel: 'Mit Wiedervorlage', zahl: (notizen ?? []).filter(x => !x.erledigt && x.wiedervorlage).length },
      ]} />
      {isLoading ? <p className="text-sm text-muted-foreground">wird geladen …</p> : liste.length === 0 ? (
        <Leer titel="Noch kein Gespräch.">Rechts erfassen -- oder bei einem Potenzial auf das Sprechblasen-Zeichen tippen.</Leer>
      ) : (
        <ul className={LISTE}>
          {liste.map(x => (
            <li key={x.id} className="flex items-start gap-4 px-5 py-4">
              <button type="button" onClick={() => void umschalten(x.id, !x.erledigt)} aria-pressed={x.erledigt}
                      aria-label={x.erledigt ? 'Als offen markieren' : 'Als erledigt markieren'}
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-[3px] border ${x.erledigt ? 'bg-foreground text-background' : 'bg-card hover:bg-secondary'}`}>
                {x.erledigt && <Check className="h-4 w-4" />}
              </button>
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{datum(x.am)}</span>
                  {x.mit && <span>· {x.mit}</span>}
                  {x.wiedervorlage && !x.erledigt && <Marke art={faellig(x) ? 'rosa' : 'grau'}>wieder am {datum(x.wiedervorlage)}</Marke>}
                </span>
                <span className={`block whitespace-pre-line ${x.erledigt ? 'text-muted-foreground line-through' : ''}`}>{x.text}</span>
                {x.parzelle_id && <span className="block text-sm text-muted-foreground">{adresse.get(x.parzelle_id) ?? 'Liegenschaft'}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Seite>
  );
}

// ===================================================== Suchprofile
export function FondsSuchprofile({ team }: BereichProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: profile } = useQuery({ queryKey: ['fonds-suchprofile', team], queryFn: () => suchprofileLaden(team!), enabled: !!team });
  const [offen, setOffen] = useUrlWert('profil');
  const gewaehlt = offen ?? profile?.[0]?.id ?? null;
  const { data: treffer, isLoading } = useQuery({ queryKey: ['fonds-suchtreffer', gewaehlt], queryFn: () => suchtrefferLaden(gewaehlt!), enabled: !!gewaehlt });
  const leer = { name: '', lagen: '', flaeche: '', reserve: '', marge: '', wohn: true };
  const [f, setF] = useState(leer);
  const zahl = (t: string) => (t.trim() ? Number(t.replace(/['\s]/g, '').replace(',', '.')) || null : null);
  const speichern = async () => {
    if (!team || !f.name.trim()) return;
    try {
      await suchprofilSpeichern({ team_id: team, name: f.name.trim(), lagen: lagenLesen(f.lagen), flaeche_min: zahl(f.flaeche),
        reserve_min: zahl(f.reserve), marge_min: zahl(f.marge) ? zahl(f.marge)! * 1e6 : null, nur_wohnzone: f.wohn, bemerkung: null });
      setF(leer);
      await qc.invalidateQueries({ queryKey: ['fonds-suchprofile', team] });
      toast({ title: 'Suchprofil gespeichert' });
    } catch (e) { toast({ title: 'Nicht gespeichert', description: e instanceof Error ? e.message : String(e), variant: 'destructive' }); }
  };
  const loeschen = async (id: string) => {
    try { await suchprofilLoeschen(id); if (offen === id) setOffen(null); await qc.invalidateQueries({ queryKey: ['fonds-suchprofile', team] }); }
    catch (e) { toast({ title: 'Nicht gelöscht', description: e instanceof Error ? e.message : String(e), variant: 'destructive' }); }
  };
  const p = profile?.find(x => x.id === gewaehlt);
  const maxMarge = Math.max(1, ...(treffer ?? []).map(t => t.marge ?? 0));
  return (
    <Seite bild={BILD.fondsSuche} ueber="Suchprofile · was Ihr Fonds kaufen will"
      titel={p ? `${n(treffer?.length ?? 0)} Parzellen passen zu «${p.name}»` : 'Suchprofil anlegen, Treffer sofort sehen'}
      unter="Lage, Mindestfläche, Reserve und Marge -- gesucht im ganzen Bestand, ohne Eigentümerdaten. Was schon in Ihren Fonds steht, zählt nicht."
      kennzahlen={[
        { titel: 'Suchprofile', wert: n(profile?.length ?? 0) },
        { titel: 'Treffer', wert: n(treffer?.length ?? 0), marke: treffer?.length ? <Marke art="lila">gerechnet</Marke> : undefined },
        { titel: 'Grösste Reserve', wert: treffer?.length ? `${n(Math.max(...treffer.map(t => t.reserve ?? 0)))} m²` : '–' },
        { titel: 'Grösste Marge', wert: treffer?.length ? chf(Math.max(...treffer.map(t => t.marge ?? 0))) : '–' },
      ]}
      seite={
        <section className="space-y-3">
          <h2 className="text-lg">Neues Suchprofil</h2>
          <input className={`${FELD} w-full`} placeholder="Name, z.B. Wohnen Agglomeration" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
          <input className={`${FELD} w-full`} placeholder="Gemeinden, mit Komma: Uster, Dübendorf" value={f.lagen} onChange={e => setF({ ...f, lagen: e.target.value })} />
          <div className="grid grid-cols-3 gap-2">
            <input className={`${FELD} w-full`} inputMode="numeric" placeholder="Fläche ab m²" value={f.flaeche} onChange={e => setF({ ...f, flaeche: e.target.value })} />
            <input className={`${FELD} w-full`} inputMode="numeric" placeholder="Reserve ab m²" value={f.reserve} onChange={e => setF({ ...f, reserve: e.target.value })} />
            <input className={`${FELD} w-full`} inputMode="decimal" placeholder="Marge ab Mio" value={f.marge} onChange={e => setF({ ...f, marge: e.target.value })} />
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-[hsl(var(--foreground))]" checked={f.wohn} onChange={e => setF({ ...f, wohn: e.target.checked })} />
            Nur Wohn-, Kern- und Zentrumszonen
          </label>
          <button type="button" className={`${KNOPF_HAUPT} w-full`} disabled={!f.name.trim() || !team} onClick={() => void speichern()}>Speichern und suchen</button>
          {(profile ?? []).length > 0 && (
            <ul className="space-y-1.5 border-t pt-3">
              {profile!.map(x => (
                <li key={x.id} className="flex items-center gap-2">
                  <button type="button" onClick={() => setOffen(x.id)}
                          className={`min-h-11 flex-1 rounded-[3px] px-3 text-left text-sm ${x.id === gewaehlt ? 'bg-foreground text-background' : 'hover:bg-secondary'}`}>
                    <span className="block font-medium">{x.name}</span>
                    <span className={`block text-xs ${x.id === gewaehlt ? 'text-background/70' : 'text-muted-foreground'}`}>
                      {[x.lagen.join(', ') || 'alle Gemeinden', x.flaeche_min ? `ab ${n(x.flaeche_min)} m²` : null, x.reserve_min ? `Reserve ab ${n(x.reserve_min)} m²` : null].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                  <button type="button" className={`${KNOPF_LEISE} h-11 w-11 px-0`} aria-label={`${x.name} löschen`} onClick={() => void loeschen(x.id)}><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </section>
      }>
      {!gewaehlt ? <Leer titel="Noch kein Suchprofil.">Rechts anlegen -- die Treffer erscheinen sofort.</Leer>
        : isLoading ? <p className="text-sm text-muted-foreground">Bestand wird durchsucht …</p>
        : (treffer ?? []).length === 0 ? <Leer titel="Keine passende Parzelle.">Gemeinden ergänzen oder Mindestwerte senken.</Leer> : (
        <Abschnitt titel="Treffer" zahl={treffer!.length} symbol={Search} kachel="akzent" unter="Nach Marge, die grösste zuerst">
          <ul className={LISTE}>
            {treffer!.map(t => (
              <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_auto]">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{t.adresse ?? 'Parzelle'}</span>
                  <span className="block truncate text-sm text-muted-foreground">{[t.gemeinde, t.zone, t.flaeche ? `${n(t.flaeche)} m²` : null, t.reserve ? `Reserve ${n(t.reserve)} m²` : null].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="order-3 col-span-2 sm:order-none sm:col-span-1"><Strichbalken anteil={(t.marge ?? 0) / maxMarge} farbe="akzent" /></span>
                <span className="font-semibold text-violett">{chf(t.marge)}</span>
              </li>
            ))}
          </ul>
        </Abschnitt>
      )}
    </Seite>
  );
}

// ======================================================== Kalender
export function FondsKalender(_: BereichProps) {
  const z = kalenderZahlen();
  return (
    <Seite bild={BILD.kalender} ueber="Immo-Kalender · Messen und Kongresse"
      titel={`${z.anzahl} Anlässe, an denen Sie Ihre Gegenseite treffen`}
      unter={z.naechster ? <>Als Nächstes: <b className="font-semibold text-foreground">{z.naechster.name}</b>, {zeitraum(z.naechster)}.</> : undefined}
      kennzahlen={[
        { titel: 'Anlässe', wert: String(z.anzahl), marke: <Marke art="lila">mit Datum</Marke> },
        { titel: 'Messen', wert: String(z.messen), marke: <Marke art="heiss">Messe</Marke> },
        { titel: 'Nächster', wert: z.tage == null ? '–' : z.tage <= 0 ? 'heute' : `${z.tage} Tage`, marke: <Marke art="minze">bis Beginn</Marke> },
        { titel: 'Datum offen', wert: String(z.offen) },
      ]}>
      <ImmoKalender />
    </Seite>
  );
}

export const BEREICH_SYMBOL = { potenziale: Sparkles, baugesuche: HardHat, gespraeche: MessageSquare, suchprofile: Search, kalender: CalendarDays };

// =========================================================== Bericht
/**
 * Der Portfolio-Bericht für den Kunden selbst (Tims Abschnitt 15:
 * "show clients detected opportunities, running activities and actual
 * results"). Dieselbe Abfrage und dasselbe Blatt wie in Bauraum; sehen
 * darf es nur, wer zum Team des Kunden gehört (darf_mandant).
 */
export function FondsBericht({ data, gehe }: BereichProps) {
  if (!data.mandant) return <Leer titel="Keine Fondsleitung zugeordnet." />;
  return <PortfolioBericht mandantId={data.mandant} onZurueck={() => gehe('uebersicht')} />;
}
