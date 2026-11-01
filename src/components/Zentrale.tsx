import { useEffect, useMemo, useState } from 'react';
import { Auswahl } from '@/components/Auswahl';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Flag, Handshake, Loader2, MapPin, Network, Search, Sparkles, Users } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useAnalyse, useInvestoren, useKunden, useVerlauf, useVorhabenListe, useZuordnung } from '@/hooks/use-vorhaben';
import {
  ARTEN, SCHRITTE, eintragen, fristText, kaeuferAbgleich, offeneZuordnen, positionenMitEgrid,
  schrittNr, titelVon, vorhabenAnlegen, weiter, adressenHinzu, type Art, type Analyse, type Vorhaben, type Zustand,
} from '@/lib/vorhaben';
import { arrondierungErkennen } from '@/lib/arrondierung';
import { passendeObjekte, type Treffer } from '@/lib/investor';
import { useQuery } from '@tanstack/react-query';
import { Abschnitt, FELD, KNOPF, KNOPF_HAUPT, Kopf, Leer, LISTE, Marke, Reiter, Seite, Strichbalken } from '@/components/rahmen';
import { BILD, luftbildWgs } from '@/lib/luftbild';
import { geocode } from '@/lib/swisstopo';
import { FENSTER } from '@/lib/fenster';
import { useSchliessen, useUrlSetzen, useUrlWert } from '@/hooks/use-url-wert';

/**
 * Die Zentrale: jedes Vorhaben eines Kunden an einem Ort.
 *
 * Ein Kunde meldet, was er vorhat ("1000 Adressen, entwickeln, in den
 * nächsten sechs Monaten"). Wir ordnen die Adressen zu, prüfen Nachbarn
 * und Netzwerk, liefern die Potenzialanalyse und fragen -- mit seinem
 * Ja -- die Eigentümer in seinem Namen an. Hier sieht man zu jedem
 * Vorhaben, wo es steht und was als Nächstes zu tun ist.
 */
const n = (x: number | null | undefined) => (x == null ? '–' : Math.round(x).toLocaleString('de-CH'));
const chf = (v: number | null | undefined) =>
  !v ? '–' : Math.abs(v) >= 1e9 ? `${(v / 1e9).toFixed(1)} Mrd` : `${(v / 1e6).toFixed(1)} Mio`;
// Ab zehn Hektaren in ha: "1'834'500 m²" passt in keine Kachel und liest sich schlecht.
const flaeche = (m2: number | null | undefined) => (!m2 ? '–' : m2 >= 100_000 ? `${(m2 / 10_000).toLocaleString('de-CH', { maximumFractionDigits: 1 })} ha` : `${n(m2)} m²`);
const zeit = (s: string) => new Date(s).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
const artTitel = (a: Art) => ARTEN.find(x => x[0] === a)?.[1] ?? a;
// "1 Adressen" stand im Fall mit einem Objekt (Darstellungstest).
const adressenText = (k: number) => `${n(k)} ${k === 1 ? 'Adresse' : 'Adressen'}`;

/**
 * Das Luftbild über dem Vorhaben zeigt seinen Ort -- die Parzelle mit
 * dem grössten Potenzial, sonst die erste Gemeinde --, nicht ein
 * allgemeines Bild. Bis der Ort gefunden ist (oder wenn nicht), das
 * Bild der Zentrale.
 */
function useOrtsbild(text: string | null) {
  const [bild, setBild] = useState<string>(BILD.zentrale);
  useEffect(() => {
    if (!text) return;
    const c = new AbortController();
    geocode(text, c.signal).then(g => { if (g) setBild(luftbildWgs(g.lat, g.lon, 800, 1280)); }).catch(() => {});
    return () => c.abort();
  }, [text]);
  return bild;
}

type Filter = 'aktiv' | Zustand;

export function Zentrale() {
  const { data, isLoading, error } = useVorhabenListe();
  // Alles in der Adresse (?vorhaben=, ?neu=1, ?reiter=), damit "Zurück"
  // im Browser vom Vorhaben in die Liste führt und ein Link genau diese
  // Ansicht öffnet. "Neues Vorhaben" oben setzt ?neu=1.
  const [offen, setOffen] = useUrlWert('vorhaben');
  const [neu, setNeu] = useUrlWert('neu');
  const [filterWert, setFilterWert] = useUrlWert('reiter', 'aktiv');
  const filter = filterWert as Filter;
  const setFilter = (f: Filter) => setFilterWert(f);
  const setzen = useUrlSetzen();
  const vorhabenZu = useSchliessen('vorhaben');
  const neuZu = useSchliessen('neu');

  const alle = data ?? [];
  const gewaehlt = alle.find(v => v.id === offen) ?? null;
  if (gewaehlt) return <Detail v={gewaehlt} onZurueck={vorhabenZu} />;
  if (neu) return <Erfassen onFertig={id => setzen({ neu: null, vorhaben: id })} onAbbrechen={neuZu} />;

  const aktiv = (v: Vorhaben) => v.zustand !== 'abgeschlossen' && v.zustand !== 'pausiert';
  const liste = alle.filter(v => (filter === 'aktiv' ? aktiv(v) : v.zustand === filter));
  const zahl = (f: Filter) => alle.filter(v => (f === 'aktiv' ? aktiv(v) : v.zustand === f)).length;
  const filterListe: [Filter, string][] = [['aktiv', 'Aktiv'], ...SCHRITTE.map(s => [s.z, s.titel] as [Filter, string]), ['pausiert', 'Pausiert']];

  const laufend = alle.filter(aktiv);
  const bald = laufend.filter(v => v.zeitraum_bis && new Date(v.zeitraum_bis).getTime() - Date.now() < 30 * 864e5).length;
  const satz = !data ? ' ' : laufend.length
    ? `${laufend.length} ${laufend.length === 1 ? 'Vorhaben läuft' : 'Vorhaben laufen'} für Kunden`
    : 'Noch kein Vorhaben in Arbeit';

  return (
    <Seite bild={BILD.zentrale} ueber="Zentrale · Kundenprojekte" titel={satz}
      unter="Was Kunden entwickeln, kaufen oder verkaufen wollen: Research, Potenzialanalyse und Akquise in ihrem Namen, alles off-market."
      kennzahlen={data ? [
        { titel: 'Laufend', wert: laufend.length.toLocaleString('de-CH'), onClick: () => setFilter('aktiv') },
        { titel: 'Adressen', wert: laufend.reduce((s2, v) => s2 + (v.adressen || 0), 0).toLocaleString('de-CH'), marke: <Marke art="lila">in Arbeit</Marke> },
        { titel: 'In Akquise', wert: zahl('akquise').toLocaleString('de-CH'), onClick: () => setFilter('akquise') },
        { titel: 'Frist bald', wert: bald.toLocaleString('de-CH'), marke: bald ? <Marke art="rosa">unter 30 Tagen</Marke> : <Marke art="minze">keine</Marke> },
      ] : undefined}
      aktionen={<button type="button" className={`${KNOPF_HAUPT} lg:hidden`} onClick={() => setNeu('1')}>Neues Vorhaben</button>}>
      <Reiter<Filter> wahl={filter} setWahl={setFilter}
              optionen={filterListe.filter(([f]) => f === 'aktiv' || zahl(f) > 0 || f === filter).map(([f, t]) => ({ wert: f, titel: t, zahl: zahl(f) }))} />

      {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> wird geladen …</p>}
      {error && <p className="text-sm text-destructive">Vorhaben nicht lesbar.</p>}
      {data && liste.length === 0 && (
        <Leer titel={alle.length ? 'Kein Vorhaben in dieser Auswahl.' : 'Noch kein Vorhaben erfasst.'}>
          {alle.length ? 'Eine andere Auswahl oben wählen.' : 'Ein Kunde meldet ein Projekt? Mit «Neues Vorhaben» beginnt es hier.'}
        </Leer>
      )}

      {/* minmax(0, 1fr) statt der Grundeinstellung: sonst bestimmt der
          längste Kundenname die Spaltenbreite, und auf dem iPhone ragt
          jede Karte über den Rand (gefunden mit tools/szenarien-pruefen.cjs). */}
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
        {liste.map(v => (
          <li key={v.id} className="min-w-0">
            <button type="button" onClick={() => setOffen(v.id)}
                    className="flex h-full w-full flex-col gap-4 rounded border bg-card p-5 text-left transition-colors hover:border-foreground/30">
              <span className="space-y-1">
                <span className="flex items-center justify-between gap-3 text-sm font-semibold text-muted-foreground">
                  <span className="min-w-0 truncate">{v.kunde}</span>
                  <span className="shrink-0">{artTitel(v.art)}</span>
                </span>
                <span className="block text-lg font-semibold leading-snug">{v.titel}</span>
                <span className="block text-sm text-muted-foreground">
                  {[v.adressen ? adressenText(v.adressen) : null, fristText(v.zeitraum_bis)].filter(Boolean).join(' · ') || 'Ohne Adressen und Frist'}
                </span>
              </span>
              <Fortschritt z={v.zustand} />
            </button>
          </li>
        ))}
      </ul>
    </Seite>
  );
}

/** Wo das Vorhaben steht: sechs Abschnitte, der aktuelle benannt. */
function Fortschritt({ z }: { z: Zustand }) {
  const nr = schrittNr(z);
  return (
    <span className="mt-auto block space-y-2">
      <span className="flex gap-1" aria-hidden>
        {SCHRITTE.map((s, i) => (
          <span key={s.z} className={`h-1 flex-1 rounded-[1px] ${z === 'pausiert' ? 'bg-border' : i <= nr ? 'bg-foreground' : 'bg-border'}`} />
        ))}
      </span>
      <span className="block text-sm font-medium">
        {titelVon(z)}{z !== 'pausiert' && z !== 'abgeschlossen' && nr >= 0 ? <span className="text-muted-foreground"> · als Nächstes: {SCHRITTE[nr].tun}</span> : null}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------- Erfassen

function Erfassen({ onFertig, onAbbrechen }: { onFertig: (id: string) => void; onAbbrechen: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: kunden } = useKunden();
  const [f, setF] = useState({ kunde: '', kundeArt: 'institution', art: 'entwickeln' as Art, titel: '', beschreibung: '', monate: 6 as number | null, adressen: '', lagen: '', objekttypen: '' });
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const zeilen = f.adressen.split(/\r?\n/).filter(z => z.trim()).length;
  const setze = (x: Partial<typeof f>) => setF(v => ({ ...v, ...x }));

  const speichern = async () => {
    setSpeichert(true); setFehler(null);
    try {
      const id = await vorhabenAnlegen({ ...f, von: user?.email ?? null });
      await qc.invalidateQueries({ queryKey: ['vorhaben'] });
      onFertig(id);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Nicht gespeichert.');
      setSpeichert(false);
    }
  };

  const feld = (label: string, kind: React.ReactNode, hinweis?: string) => (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {kind}
      {hinweis && <span className="block text-sm text-muted-foreground">{hinweis}</span>}
    </label>
  );
  const wahl = (an: boolean) => `h-11 flex-1 rounded-[3px] border px-4 text-sm font-medium transition-colors ${an ? 'border-[#1E2433] bg-[#1E2433] text-white' : 'bg-card hover:bg-secondary'}`;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <button type="button" onClick={onAbbrechen} className="-ml-2 inline-flex h-11 items-center gap-1 px-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Zentrale
      </button>
      <Kopf titel="Neues Vorhaben">Was der Kunde vorhat. Adressen lassen sich auch später ergänzen.</Kopf>

      <div className="space-y-6 rounded border bg-card p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          {feld('Kunde', <input list="kunden" value={f.kunde} onChange={e => setze({ kunde: e.target.value })} className={`${FELD} w-full`} placeholder="z.B. Pensionskasse A" />)}
          {feld('Art', (
            <Auswahl label="Art" wert={f.kundeArt} setWert={w => setze({ kundeArt: w })} className="w-full min-w-[160px]" optionen={[
              { wert: 'institution', titel: 'Institution' }, { wert: 'firma', titel: 'Firma' }, { wert: 'person', titel: 'Person' },
            ]} />
          ))}
          <datalist id="kunden">{(kunden ?? []).map(k => <option key={k.name} value={k.name} />)}</datalist>
        </div>

        <div className="space-y-1.5">
          <span className="text-sm font-medium">Vorhaben</span>
          <div className="flex gap-2">
            {ARTEN.map(([a, t]) => <button key={a} type="button" className={wahl(f.art === a)} onClick={() => setze({ art: a })}>{t}</button>)}
          </div>
        </div>

        {feld('Titel', <input value={f.titel} onChange={e => setze({ titel: e.target.value })} className={`${FELD} w-full`} placeholder="z.B. Entwicklung Bestand Zürich Nord" />)}

        <div className="space-y-1.5">
          <span className="text-sm font-medium">Zeitraum</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([[3, '3 Monate'], [6, '6 Monate'], [12, '12 Monate'], [null, 'Offen']] as [number | null, string][]).map(([m, t]) => (
              <button key={t} type="button" className={wahl(f.monate === m)} onClick={() => setze({ monate: m })}>{t}</button>
            ))}
          </div>
        </div>

        {f.art === 'kaufen' && (
          <div className="grid gap-4 sm:grid-cols-2">
            {feld('Lagen', <input value={f.lagen} onChange={e => setze({ lagen: e.target.value })} className={`${FELD} w-full`} placeholder="Zürich, Kloten" />, 'Gemeinden, mit Komma getrennt')}
            {feld('Objektarten', <input value={f.objekttypen} onChange={e => setze({ objekttypen: e.target.value })} className={`${FELD} w-full`} placeholder="MFH, Gewerbe" />)}
          </div>
        )}

        {feld('Adressen', (
          <textarea value={f.adressen} onChange={e => setze({ adressen: e.target.value })} rows={6}
                    className="w-full rounded border bg-card px-4 py-3 text-sm" placeholder={'Bahnhofstrasse 1, 8001 Zürich\nCH123456789012\n…'} />
        ), `Eine Adresse oder EGRID je Zeile, auch aus Excel kopiert.${zeilen ? ` ${n(zeilen)} Zeilen.` : ''}`)}
        <label className="inline-flex h-11 cursor-pointer items-center text-sm font-medium text-accent">
          Datei wählen (CSV, TXT)
          <input type="file" accept=".csv,.txt,.tsv" className="sr-only" onChange={async e => { const d = e.target.files?.[0]; if (d) setze({ adressen: await d.text() }); }} />
        </label>

        {feld('Notiz', <textarea value={f.beschreibung} onChange={e => setze({ beschreibung: e.target.value })} rows={3}
                                  className="w-full rounded border bg-card px-4 py-3 text-sm" placeholder="Was der Kunde sagt, wer Ansprechperson ist …" />)}

        {fehler && <p className="text-sm text-destructive">{fehler}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={KNOPF} onClick={onAbbrechen}>Abbrechen</button>
          <button type="button" className={KNOPF_HAUPT} onClick={speichern} disabled={!f.kunde.trim() || !f.titel.trim() || speichert}>
            {speichert ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Vorhaben anlegen'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Detail

function Detail({ v, onZurueck }: { v: Vorhaben; onZurueck: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const von = user?.email ?? null;
  const { data: a, isLoading } = useAnalyse(v.id);
  const { data: zu } = useZuordnung(v.portfolio_id);
  const { data: verlauf } = useVerlauf(v.id);
  const [lauf, setLauf] = useState<string | null>(null);
  // Der Bericht ist eine eigene Ansicht (?bericht=1) -- "Zurück" schliesst ihn.
  const [berichtWert, setBerichtWert] = useUrlWert('bericht');
  const bericht = berichtWert === '1';
  const setBericht = (an: boolean) => setBerichtWert(an ? '1' : null);
  const berichtZu = useSchliessen('bericht');
  const [wer, setWer] = useState('');

  const neuLaden = () => Promise.all([
    qc.invalidateQueries({ queryKey: ['vorhaben'] }),
    qc.invalidateQueries({ queryKey: ['gelegenheiten'] }),
  ]);

  const schritt = async (z: Zustand, extra: Record<string, unknown> = {}) => {
    await weiter(v, z, von, extra);
    await neuLaden();
  };

  const zuordnenLos = async () => {
    if (!v.portfolio_id) return;
    setLauf('Adressen werden zugeordnet …');
    try {
      const e = await offeneZuordnen(v.portfolio_id, (f, t) => setLauf(`Adressen zuordnen: ${f} von ${t}`));
      await eintragen(v.id, `Adressen zugeordnet: ${e.zugeordnet} gefunden, ${e.andere} zu prüfen.`, von, 'schritt');
      setLauf(null);
    } catch { setLauf('Zuordnen nicht möglich. Angemeldet?'); }
    await neuLaden();
  };

  const researchLos = async () => {
    if (!v.portfolio_id) return;
    setLauf('Parzellen werden gelesen …');
    try {
      const pos = await positionenMitEgrid(v.portfolio_id);
      const e = await arrondierungErkennen(v.portfolio_id, pos, (f, t) => setLauf(`Nachbarn prüfen: ${f} von ${t}`));
      await eintragen(v.id, `Nachbarn geprüft: ${e.neu} neue Arrondierungen, ${e.schon} schon erfasst${e.fehler ? `, ${e.fehler} Fehler` : ''}.`, von, 'schritt');
      setLauf(null);
    } catch { setLauf('Research nicht möglich. Angemeldet?'); }
    await neuLaden();
  };

  // Vor jedem frühen return: Hooks immer in derselben Reihenfolge.
  const ortText = a?.top?.[0]?.address ? `${a.top[0].address} ${a.top[0].gemeinde ?? ''}` : (a?.gemeinden?.[0]?.gemeinde ?? v.lagen?.[0] ?? null);
  const bild = useOrtsbild(ortText);

  if (bericht && a) return <Bericht v={v} a={a} onZurueck={berichtZu} />;

  const nr = schrittNr(v.zustand);
  const pausiert = v.zustand === 'pausiert';

  // Was im aktuellen Schritt zu tun ist -- genau eine Haupthandlung.
  const handlung = (() => {
    if (pausiert) return { text: 'Das Vorhaben ruht.', knopf: <button type="button" className={KNOPF_HAUPT} onClick={() => schritt('eingegangen')}>Fortsetzen</button> };
    switch (v.zustand) {
      case 'eingegangen': return {
        text: zu?.offen ? `${n(zu.offen)} Adressen warten auf die Zuordnung beim Bund.` : 'Die Adressen sind zugeordnet. Als Nächstes: Nachbarn und Netzwerk prüfen.',
        knopf: zu?.offen
          ? <button type="button" className={KNOPF_HAUPT} onClick={zuordnenLos} disabled={!!lauf}>Adressen zuordnen</button>
          : <button type="button" className={KNOPF_HAUPT} onClick={() => schritt('research')}>Research beginnen</button>,
      };
      case 'research': return {
        text: a?.gepruefte_positionen ? `${n(a.gepruefte_positionen)} von ${n(a.zugeordnet)} Parzellen geprüft. Ist die Analyse beim Kunden, weiter.` : 'Zu jeder Parzelle die Nachbarn beim Bund holen und mit Bestand und Netzwerk verbinden.',
        knopf: <>
          <button type="button" className={KNOPF} onClick={researchLos} disabled={!!lauf}>Nachbarn prüfen</button>
          <button type="button" className={KNOPF_HAUPT} onClick={() => schritt('analyse')}>Analyse geliefert</button>
        </>,
      };
      case 'analyse': return {
        text: 'Darf in seinem Namen angefragt werden? Ohne Ja des Kunden keine Akquise.',
        knopf: <>
          <input value={wer} onChange={e => setWer(e.target.value)} placeholder="Wer hat zugestimmt?"
                 aria-label="Wer beim Kunden zugestimmt hat" className={`${FELD} w-full sm:w-56`} />
          <button type="button" className={KNOPF_HAUPT} disabled={!wer.trim()}
                  onClick={() => schritt('freigabe', { vollmacht_am: new Date().toISOString().slice(0, 10), vollmacht_von: wer.trim() })}>
            Kunde hat zugestimmt
          </button>
        </>,
      };
      case 'freigabe': return {
        text: `Zugestimmt von ${v.vollmacht_von ?? '–'} am ${v.vollmacht_am ? new Date(v.vollmacht_am).toLocaleDateString('de-CH') : '–'}. Die Eigentümer werden in seinem Namen angefragt.`,
        knopf: <button type="button" className={KNOPF_HAUPT} onClick={() => schritt('akquise')}>Akquise starten</button>,
      };
      case 'akquise': return {
        text: 'Die Arrondierungen stehen unter Gelegenheiten, dort wird angerufen und festgehalten.',
        knopf: <button type="button" className={KNOPF_HAUPT} onClick={() => schritt('abgeschlossen')}>Abschliessen</button>,
      };
      default: return { text: 'Abgeschlossen.', knopf: null };
    }
  })();

  // Kennzahlen wie auf jeder Seite (DESIGN.md, Seitenaufbau). Beim
  // Kaufen gibt es keine Adressen des Kunden, nur ein Suchprofil.
  const offen = zu?.offen ?? a?.offen ?? 0;
  // Kalendertage wie in fristText -- sonst stand oben "noch 30 Tage"
  // und in der Kennzahl "noch 29 Tage" (Darstellungstest).
  const heute = new Date();
  const tage = v.zeitraum_bis
    ? Math.round((new Date(v.zeitraum_bis + 'T00:00:00').getTime() - new Date(heute.getFullYear(), heute.getMonth(), heute.getDate()).getTime()) / 864e5)
    : null;
  const frist = {
    titel: 'Frist',
    wert: v.zeitraum_bis ? new Date(v.zeitraum_bis + 'T00:00:00').toLocaleDateString('de-CH', { month: 'short', year: 'numeric' }) : 'offen',
    marke: tage == null ? <Marke>keine</Marke>
      : tage < 0 ? <Marke art="rosa">vorbei</Marke>
      : tage < 45 ? <Marke art={tage < 30 ? 'rosa' : 'minze'}>noch {tage} {tage === 1 ? 'Tag' : 'Tage'}</Marke>
      : <Marke art="minze">noch {Math.round(tage / 30.4)} Monate</Marke>,
  };
  const kennzahlen = v.art === 'kaufen'
    ? [
        { titel: 'Lagen', wert: n(v.lagen?.length ?? 0), marke: <Marke art="lila">{(v.lagen ?? []).slice(0, 2).join(', ') || 'offen'}</Marke> },
        { titel: 'Objekttypen', wert: n(v.objekttypen?.length ?? 0), marke: <Marke>{(v.objekttypen ?? []).slice(0, 2).join(', ') || 'offen'}</Marke> },
        { titel: 'Schritt', wert: `${Math.max(1, nr + 1)} / ${SCHRITTE.length}`, marke: <Marke art="violett">{titelVon(v.zustand)}</Marke> },
        frist,
      ]
    : [
        { titel: 'Adressen', wert: a ? `${n(a.zugeordnet)} / ${n(a.adressen)}` : n(v.adressen),
          marke: offen ? <Marke art="rosa">{n(offen)} offen</Marke> : <Marke art="minze">zugeordnet</Marke> },
        // Ohne Wert keine Marke, die etwas behauptet ("0 Parzellen",
        // "gerechnet" neben einem Strich).
        { titel: 'Reserve', wert: a ? flaeche(a.hnf_reserve) : '–',
          marke: a?.mit_reserve ? <Marke art="lila">{n(a.mit_reserve)} {a.mit_reserve === 1 ? 'Parzelle' : 'Parzellen'}</Marke> : <Marke>noch offen</Marke> },
        { titel: 'Marge', wert: a ? chf(a.marge_chf) : '–',
          marke: a?.marge_chf ? <Marke art="violett">gerechnet</Marke> : <Marke>noch offen</Marke> },
        frist,
      ];

  return (
    <div className="space-y-2">
      <div className="relative z-10 mx-auto max-w-[1400px]">
        <button type="button" onClick={onZurueck} className="-ml-2 inline-flex h-11 items-center gap-1 px-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Zentrale
        </button>
      </div>
      <Seite bild={bild} ueber={`${v.kunde} · ${artTitel(v.art)}`} titel={v.titel}
        unter={[v.adressen ? adressenText(v.adressen) : null, fristText(v.zeitraum_bis), v.zustaendig ? `zuständig ${v.zustaendig}` : null].filter(Boolean).join(' · ')}
        kennzahlen={kennzahlen}
        aktionen={a && v.art !== 'kaufen' ? <button type="button" className={KNOPF} onClick={() => setBericht(true)}>Als PDF für den Kunden</button> : undefined}
        seite={<Verlauf v={v} eintraege={verlauf ?? []} />}>

        {/* Die Schritte, und darunter genau das, was jetzt zu tun ist. */}
        <Abschnitt titel={titelVon(v.zustand)} unter={pausiert ? 'Das Vorhaben ruht' : `Schritt ${Math.max(1, nr + 1)} von ${SCHRITTE.length}`} symbol={Flag} kachel="schwarz">
          <section className="space-y-5 rounded border bg-card p-5 sm:p-6">
            <ol className="grid grid-cols-6 gap-1.5">
              {SCHRITTE.map((s2, i) => (
                <li key={s2.z} className="min-w-0 space-y-2">
                  <span className={`block h-1 rounded-[1px] ${!pausiert && i <= nr ? 'bg-foreground' : 'bg-border'}`} />
                  <span className={`hidden truncate text-xs sm:block ${i === nr ? 'font-semibold' : 'text-muted-foreground'}`}>{s2.titel}</span>
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="min-w-0 text-sm text-muted-foreground">{lauf ?? handlung.text}</p>
              {/* Auf dem Handy untereinander und volle Breite, die Haupthandlung
                  oben -- wie ein Aktionsblatt. Ab Tablet in einer Reihe. */}
              <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                {lauf && <Loader2 className="h-5 w-5 animate-spin self-center text-muted-foreground" />}
                {!pausiert && v.zustand !== 'abgeschlossen' && (
                  <button type="button" onClick={() => schritt('pausiert')} className="inline-flex h-11 items-center justify-center px-3 text-sm text-muted-foreground hover:text-foreground">Pausieren</button>
                )}
                {handlung.knopf}
              </div>
            </div>
          </section>
        </Abschnitt>

        {isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Potenzialanalyse wird gerechnet …</p>}
        {a && <Analyseteil v={v} a={a} />}

        {v.portfolio_id && <Adressen v={v} zu={zu} onNeu={neuLaden} />}
      </Seite>
    </div>
  );
}

function Kachel({ titel, wert, zeile }: { titel: string; wert: string; zeile?: string }) {
  return (
    <div className="rounded border bg-card p-5">
      <p className="text-sm font-semibold text-muted-foreground">{titel}</p>
      <p className="mt-2 whitespace-nowrap text-2xl font-bold tracking-tight sm:text-3xl">{wert}</p>
      {zeile && <p className="mt-1 text-sm text-muted-foreground">{zeile}</p>}
    </div>
  );
}

function Analyseteil({ v, a }: { v: Vorhaben; a: Analyse }) {
  const { data: investoren } = useInvestoren(v.art !== 'kaufen');
  const kaeufer = useMemo(() => kaeuferAbgleich(investoren ?? [], a.lage_art ?? []), [investoren, a.lage_art]);
  const { data: objekte } = useQuery({
    queryKey: ['vorhaben', v.id, 'objekte'],
    enabled: v.art === 'kaufen',
    queryFn: () => passendeObjekte({ lagen: v.lagen, objekttypen: v.objekttypen }),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <>
      {/* Adressen, Reserve und Marge stehen oben in den Kennzahlen; hier
          das, was die Analyse über die Nachbarschaft weiss. */}
      <Abschnitt titel="Nachbarn und Netzwerk" unter={`${n(a.gepruefte_positionen)} von ${n(a.zugeordnet)} Parzellen geprüft`} symbol={Users} kachel="akzent">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kachel titel="Nachbarn" wert={n(a.nachbarn)} zeile="im Bestand" />
          <Kachel titel="Eigentümer bekannt" wert={n(a.nachbarn_mit_eigentuemer)} zeile="direkt anfragbar" />
          <Kachel titel="Im Netzwerk" wert={n(a.netzwerk.length)} zeile="Nachbarn, die wir kennen" />
          <Kachel titel="Ausserhalb" wert={n(a.nachbarn_ausserhalb)} zeile="noch nicht im Bestand" />
        </div>
      </Abschnitt>

      {(a.gemeinden.length > 0 || a.zonen.length > 0) && (
        <Abschnitt titel="Wo es liegt" unter="Parzellen je Gemeinde und Zone" symbol={MapPin} kachel="hell">
          <div className="grid gap-3 lg:grid-cols-2">
            {[{ t: 'Gemeinden', z: a.gemeinden.map(g => ({ k: g.gemeinde, n: g.n })), f: 'akzent' as const },
              { t: 'Zonen', z: a.zonen.map(g => ({ k: g.zone, n: g.n })), f: 'heiss' as const }]
              .filter(x => x.z.length).map(x => {
                const max = Math.max(...x.z.map(y => y.n), 1);
                return (
                  <div key={x.t} className="space-y-3 rounded border bg-card p-5">
                    <p className="text-sm font-semibold text-muted-foreground">{x.t}</p>
                    <ul className="space-y-3">
                      {x.z.map(y => (
                        <li key={y.k} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_3.5rem] items-center gap-3 text-sm">
                          <span className="truncate">{y.k}</span>
                          <Strichbalken anteil={y.n / max} farbe={x.f} />
                          <span className="text-right tabular">{n(y.n)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
          </div>
        </Abschnitt>
      )}

      {a.netzwerk.length > 0 && (
        <Abschnitt titel="Nachbarn im Netzwerk" zahl={a.netzwerk.length} symbol={Network} kachel="heiss"
                   hinweis="Der Eigentümer ist uns bekannt. Hier lässt sich sagen: der Nachbar ist bei uns im Netzwerk, gemeinsam liesse sich mehr entwickeln oder beides zukaufen.">
          <ul className={LISTE}>
            {a.netzwerk.map((x, i) => (
              <li key={i} className="flex items-start justify-between gap-4 px-5 py-4">
                <span className="min-w-0">
                  <span className="block font-semibold">{x.name}</span>
                  <span className="block text-sm text-muted-foreground">{x.address}{x.gemeinde ? `, ${x.gemeinde}` : ''}{x.neben ? ` · neben ${x.neben}` : ''}</span>
                </span>
                <span className="shrink-0 text-right text-sm">
                  <span className="block font-medium">{x.wieso.join(', ')}</span>
                  {x.area ? <span className="block text-muted-foreground">{n(x.area)} m²</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </Abschnitt>
      )}

      {v.art !== 'kaufen' && (
        <Abschnitt titel="Mögliche Käufer" zahl={kaeufer.length || undefined} symbol={Handshake} kachel="akzent"
                   hinweis="Investoren, deren Suchprofil Objekte dieses Vorhabens trifft, nach Gemeinde und Objektart. Den Preis führt der Bestand nicht.">
          {kaeufer.length === 0 ? (
            <Leer titel="Noch kein passendes Suchprofil.">Investorprofile entstehen aus Gesprächen und Anfragen unter Auswertung.</Leer>
          ) : (
            <ul className={LISTE}>
              {kaeufer.slice(0, 12).map(k => (
                <li key={k.investor.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <span className="min-w-0">
                    <span className="block font-semibold">{k.investor.name}</span>
                    <span className="block text-sm text-muted-foreground">{[...(k.investor.lagen ?? []), ...(k.investor.objekttypen ?? [])].join(', ') || '–'}</span>
                  </span>
                  <span className="shrink-0 text-sm font-medium">{n(k.treffer)} Objekte</span>
                </li>
              ))}
            </ul>
          )}
        </Abschnitt>
      )}

      {v.art === 'kaufen' && (
        <Abschnitt titel="Passende Objekte" zahl={objekte?.objekte.length || undefined} symbol={Search} kachel="akzent" hinweis={objekte?.hinweis ?? `Gesucht: ${[...(v.lagen ?? []), ...(v.objekttypen ?? [])].join(', ') || 'kein Suchprofil'}.`}>
          {(objekte?.objekte ?? []).length === 0 ? <Leer titel="Nichts gefunden." /> : (
            <ul className={LISTE}>
              {(objekte?.objekte ?? []).map((o: Treffer) => (
                <li key={o.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <span className="min-w-0">
                    <span className="block font-semibold">{o.address}</span>
                    <span className="block text-sm text-muted-foreground">{[o.gemeinde, o.kategorie, o.area ? `${n(o.area)} m²` : null].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className="shrink-0 font-semibold">{chf(o.marge_chf)}</span>
                </li>
              ))}
            </ul>
          )}
        </Abschnitt>
      )}

      {a.top.length > 0 && (() => {
        const max = Math.max(...a.top.map(t => t.marge_chf ?? 0), 1);
        return (
          <Abschnitt titel="Grösstes Potenzial" zahl={a.top.length} unter="Nach gerechneter Marge" symbol={Sparkles} kachel="schwarz">
            <ul className={LISTE}>
              {a.top.map((t, i) => (
                <li key={i} className="flex items-center justify-between gap-4 px-5 py-4">
                  <span className="min-w-0 flex-1 space-y-2">
                    <span className="block">
                      <span className="block font-semibold">{t.address ?? '–'}</span>
                      <span className="block text-sm text-muted-foreground">
                        {[t.gemeinde, t.zone, t.area ? `${n(t.area)} m²` : null, t.nachbarn ? `${t.nachbarn} ${t.nachbarn === 1 ? 'Nachbar' : 'Nachbarn'}` : null].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="block max-w-xs"><Strichbalken anteil={(t.marge_chf ?? 0) / max} farbe="akzent" /></span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold text-violett">{chf(t.marge_chf)}</span>
                    {t.egrid && <a href={`https://map.geo.admin.ch/?swisssearch=${t.egrid}&lang=de`} target={FENSTER.karte} className="-my-2 inline-flex h-11 items-center text-sm text-accent">Karte</a>}
                  </span>
                </li>
              ))}
            </ul>
          </Abschnitt>
        );
      })()}
    </>
  );
}

function Adressen({ v, zu, onNeu }: { v: Vorhaben; zu?: { offen: number; zugeordnet: number; mehrdeutig: number; nicht: number }; onNeu: () => Promise<unknown> }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [auf, setAuf] = useState(false);
  const hinzu = async () => {
    const k = await adressenHinzu(v.portfolio_id!, text);
    await eintragen(v.id, `${k} Adressen ergänzt.`, user?.email ?? null, 'schritt');
    setText(''); setAuf(false); await onNeu();
  };
  return (
    <Abschnitt titel="Adressen" zahl={zu ? n(zu.offen + zu.zugeordnet + zu.mehrdeutig + zu.nicht) : undefined}
               rechts={<button type="button" className={KNOPF} onClick={() => setAuf(!auf)}>{auf ? 'Schliessen' : 'Adressen ergänzen'}</button>}>
      {zu && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kachel titel="Zugeordnet" wert={n(zu.zugeordnet)} />
          <Kachel titel="Offen" wert={n(zu.offen)} />
          <Kachel titel="Mehrdeutig" wert={n(zu.mehrdeutig)} zeile="PLZ oder Ort ergänzen" />
          <Kachel titel="Nicht gefunden" wert={n(zu.nicht)} />
        </div>
      )}
      {auf && (
        <div className="space-y-3 rounded border bg-card p-5">
          <textarea value={text} onChange={e => setText(e.target.value)} rows={5} className="w-full rounded border bg-card px-4 py-3 text-sm" placeholder="Eine Adresse oder EGRID je Zeile" />
          <div className="flex justify-end"><button type="button" className={KNOPF_HAUPT} disabled={!text.trim()} onClick={hinzu}>Hinzufügen</button></div>
        </div>
      )}
    </Abschnitt>
  );
}

function Verlauf({ v, eintraege }: { v: Vorhaben; eintraege: { id: string; am: string; von: string | null; art: string; text: string }[] }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [text, setText] = useState('');
  const notiz = async () => {
    if (!text.trim()) return;
    await eintragen(v.id, text.trim(), user?.email ?? null);
    setText('');
    await qc.invalidateQueries({ queryKey: ['vorhaben', v.id, 'verlauf'] });
  };
  return (
    <Abschnitt titel="Verlauf" zahl={eintraege.length || undefined}>
      <div className="flex gap-2">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void notiz(); }}
               placeholder="Notiz: Gespräch, Rückmeldung, Abmachung …" className={`${FELD} flex-1`} />
        <button type="button" className={KNOPF_HAUPT} onClick={notiz} disabled={!text.trim()}>Festhalten</button>
      </div>
      {v.beschreibung && <p className="rounded border bg-card px-5 py-4 text-sm">{v.beschreibung}</p>}
      {eintraege.length > 0 && (
        <ul className={LISTE}>
          {eintraege.map(e => (
            <li key={e.id} className="flex items-baseline gap-4 px-5 py-3 text-sm">
              <span className="w-28 shrink-0 text-muted-foreground">{zeit(e.am)}</span>
              <span className={`min-w-0 flex-1 ${e.art === 'schritt' ? 'text-muted-foreground' : ''}`}>{e.text}</span>
              {e.von && <span className="hidden shrink-0 text-muted-foreground sm:block">{e.von.split('@')[0]}</span>}
            </li>
          ))}
        </ul>
      )}
    </Abschnitt>
  );
}

// ---------------------------------------------------------------- Bericht

/**
 * Die Potenzialanalyse für den Kunden, zum Drucken oder als PDF. Was
 * wir nicht wissen, steht als offen da, statt zu fehlen: Zonenplan-
 * änderungen sind noch an keine Quelle angebunden.
 */
function Bericht({ v, a, onZurueck }: { v: Vorhaben; a: Analyse; onZurueck: () => void }) {
  return (
    <div className="bericht-druck mx-auto max-w-3xl space-y-8 bg-white p-6 text-slate-900 print:max-w-none print:p-0">
      <div className="flex justify-between gap-2 print:hidden">
        <button type="button" onClick={onZurueck} className={KNOPF}>Zurück</button>
        <button type="button" onClick={() => window.print()} className={KNOPF_HAUPT}>Drucken oder als PDF sichern</button>
      </div>
      <header className="space-y-1">
        <p className="text-sm font-semibold text-slate-500">Potenzialanalyse · {new Date().toLocaleDateString('de-CH')} · vertraulich</p>
        <h1 className="text-3xl">{v.titel}</h1>
        <p className="text-slate-600">{v.kunde} · {artTitel(v.art)}{v.zeitraum_bis ? ` · ${fristText(v.zeitraum_bis)}` : ''}</p>
      </header>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Adressen', `${n(a.zugeordnet)} / ${n(a.adressen)}`], ['Fläche', flaeche(a.flaeche_m2)], ['Reserve HNF', flaeche(a.hnf_reserve)], ['Marge', chf(a.marge_chf)],
          ['Nachbarn', n(a.nachbarn)], ['Eigentümer bekannt', n(a.nachbarn_mit_eigentuemer)], ['Im Netzwerk', n(a.netzwerk.length)], ['Ausserhalb Bestand', n(a.nachbarn_ausserhalb)]]
          .map(([t, w]) => <div key={t} className="rounded border p-3"><p className="text-xs text-slate-500">{t}</p><p className="text-xl font-semibold">{w}</p></div>)}
      </div>
      <section className="grid gap-6 sm:grid-cols-2">
        <div><h2 className="mb-2 text-lg">Zonen</h2>{a.zonen.map(z => <p key={z.zone} className="flex justify-between border-b py-1 text-sm"><span>{z.zone}</span><span>{z.n}</span></p>)}</div>
        <div><h2 className="mb-2 text-lg">Gemeinden</h2>{a.gemeinden.map(z => <p key={z.gemeinde} className="flex justify-between border-b py-1 text-sm"><span>{z.gemeinde}</span><span>{z.n}</span></p>)}</div>
      </section>
      <section>
        <h2 className="mb-2 text-lg">Grösstes Potenzial</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500"><tr><th className="pb-2 pr-3 font-medium">Adresse</th><th className="pb-2 pr-3 font-medium">Zone</th><th className="pb-2 pr-3 text-right font-medium">Fläche</th><th className="pb-2 pr-3 text-right font-medium">Reserve</th><th className="pb-2 text-right font-medium">Nachbarn</th></tr></thead>
          <tbody className="divide-y">
            {a.top.map((t, i) => (
              <tr key={i}><td className="py-1.5 pr-3">{t.address}{t.gemeinde ? `, ${t.gemeinde}` : ''}</td><td className="py-1.5 pr-3">{t.zone ?? '–'}</td>
                <td className="py-1.5 pr-3 text-right">{t.area ? `${n(t.area)} m²` : '–'}</td><td className="py-1.5 pr-3 text-right">{t.hnf_delta && t.hnf_delta > 0 ? `${n(t.hnf_delta)} m²` : '–'}</td><td className="py-1.5 text-right">{t.nachbarn}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="space-y-1 text-sm text-slate-600">
        <h2 className="text-lg text-slate-900">Grundlagen</h2>
        <p>Parzellen, Umrisse und Nachbarn: Bund (geo.admin.ch). Zonen und Flächen: Bestand, Stand der letzten Auswertung. Reserve und Marge sind gerechnete Richtwerte, keine Bewertung.</p>
        <p>Zonenplanänderungen: noch nicht an eine Quelle angebunden, werden im Gespräch ergänzt.</p>
        <p>Eigentümer werden erst mit Ihrer Zustimmung und in Ihrem Namen angefragt. Namen Dritter stehen in diesem Bericht nicht.</p>
      </section>
    </div>
  );
}
