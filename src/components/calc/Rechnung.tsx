import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Loader2, Plus, Search, X } from 'lucide-react';
import { FELD, KNOPF, KNOPF_HAUPT, KNOPF_LEISE, LISTE } from '@/components/rahmen';
import { Zahl } from '@/components/Machbarkeit';
import { Bemerkungen } from '@/components/calc/Bemerkungen';
import { Ergebnis, Objektkopf } from '@/components/calc/Ergebnis';
import { useName } from '@/components/calc/name';
import { Empfaenger } from '@/components/calc/Empfaenger';
import { empfaenger, personenAusEigentuemer, type Parzelle, type Person } from '@/lib/angebot';
import { FENSTER } from '@/lib/fenster';
import { adresseWaehlen, suchtext } from '@/lib/adresswahl';
import type { Projekt } from '@/lib/bauprojekt';
import { ProjektHinweis } from '@/components/ProjektHinweis';
import { aufParzelle, useGesucheParzelle } from '@/components/BaugesucheParzelle';
import { bewerten, CALC_ANNAHMEN, ERLOES_ANNAHME, median, nachbarArt, type CalcAnnahmen, type CalcEingabe, type ErloesQuelle, type Kauf, type NachbarTeil, type Umfeld, type Vergleich, type VonHand } from '@/lib/calc';
import { ERLOES_AMTLICH } from '@/lib/erloes-daten';
import { ERLOES_ANGABEN } from '@/lib/erloes-angaben';
import { angabePruefen, erloesHerleiten, quartierLaden, reihenLaden } from '@/lib/preis-herleitung';
import { entwurfLoeschen, entwurfSpeichern, schritt, type Kalkulation } from '@/lib/calc-ablauf';
import { adressen, gebaeudeFrisch, leadLaden, nachbarnLaden, objektLaden, portalLinks, umfeldLaden, type Adresse } from '@/lib/calc-daten';
import { chf } from '@/lib/machbarkeit';
import { grundlageLaden } from '@/lib/machbarkeit-daten';
import { wohnungText, type Wert } from '@/lib/preise';

/**
 * Eine Kalkulation rechnen: Adresse eingeben, und alles steht da. Was
 * die Register nicht wissen (Mieten, Inserate, die Zone ausserhalb von
 * Zürich), trägt ein Mensch ein; die Rechnung folgt sofort.
 *
 * Gespeichert wird die Rechnung samt ihren Eingaben: wer prüft, sieht
 * dieselben Zahlen, und ein Entwurf geht ohne neue Abfragen wieder auf.
 */

/** Was nach dem Laden feststeht; Annahmen und Eingaben von Hand kommen dazu. */
interface Basis {
  adresse: Adresse; parzelleNr: string | null; eigentuemer: string | null; luecken: string[];
  egrid: string | null; parzelleId: string | null; gemeinde: string | null; kanton: string | null;
  grundlage: CalcEingabe['grundlage']; umfeld: Umfeld;
  projekt: Projekt | null;
}

const de = (n: number, stellen = 0) => n.toLocaleString('de-CH', { maximumFractionDigits: stellen, minimumFractionDigits: stellen });
const ETIKETT = 'text-[11px] uppercase tracking-wide text-muted-foreground';

/** Ein Zahlenfeld, das leer sein darf: leer heisst «nicht bekannt». */
function Offen({ titel, wert, einheit, setWert, platz }: { titel: string; wert: number | null | undefined; einheit: string; setWert: (n: number | null) => void; platz?: string }) {
  const [text, setText] = useState(wert != null ? String(wert) : '');
  useEffect(() => { setText(wert != null ? String(wert) : ''); }, [wert]);
  const uebernehmen = () => {
    const n = Number(text.replace(/['’\s]/g, '').replace(',', '.'));
    if (!text.trim()) { if (wert != null) setWert(null); } else if (Number.isFinite(n) && n > 0) { if (n !== wert) setWert(n); } else setText(wert != null ? String(wert) : '');
  };
  return (
    <label className="block space-y-1.5">
      <span className={ETIKETT}>{titel}</span>
      <span className="flex items-center gap-2">
        <input inputMode="decimal" value={text} placeholder={platz} onChange={e => setText(e.target.value)} onBlur={uebernehmen}
               onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} className={`${FELD} w-full text-base`} />
        <span className="shrink-0 text-sm text-muted-foreground">{einheit}</span>
      </span>
    </label>
  );
}

export function Rechnung({ start, anfrageId, entwurf, onGespeichert, onVerworfen }: {
  /** Eine Adresse zum Vorbelegen (Aufruf aus Lead oder Objekt). */
  start?: string | null; anfrageId?: string | null;
  /** Ein gespeicherter Entwurf: geht mit seinen Zahlen wieder auf. */
  entwurf?: Kalkulation | null;
  onGespeichert: (k: Kalkulation) => void; onVerworfen?: () => void;
}) {
  const alt = entwurf?.eingaben;
  const [text, setText] = useState(start ?? '');
  const [gesucht, setGesucht] = useState(start ?? '');
  /** «Rechnen» getippt, aber nicht eindeutig: die Seite bittet, einen Vorschlag anzutippen. */
  const [waehlen, setWaehlen] = useState(false);
  const [gewaehlt, setGewaehlt] = useState<Adresse | null>(alt?.adresse ?? null);
  const [annahmen, setAnnahmen] = useState<CalcAnnahmen>(alt?.eingabe.annahmen ?? CALC_ANNAHMEN);
  const [hand, setHand] = useState<VonHand>(alt?.eingabe.hand ?? {});
  const [erloesQuelle, setErloesQuelle] = useState<ErloesQuelle>(alt?.eingabe.erloesQuelle ?? ERLOES_ANNAHME);
  const erloesQuelleRef = useRef(erloesQuelle);
  erloesQuelleRef.current = erloesQuelle;
  const [nachbarn, setNachbarn] = useState<NachbarTeil[]>(alt?.eingabe.nachbarn ?? []);
  const [nachbarnAuf, setNachbarnAuf] = useState((alt?.eingabe.nachbarn?.length ?? 0) > 0);
  const [kontakt, setKontakt] = useState(entwurf?.kontakt ?? '');
  const [test, setTest] = useState(entwurf?.test ?? false);
  const [quelle, setQuelle] = useState<'aurora' | 'mail'>(entwurf?.quelle ?? 'aurora');
  // Leer heisst: noch nichts von Hand, dann gelten Parzellen und Eigentümer der Rechnung.
  const [parzellenHand, setParzellen] = useState<Parzelle[] | null>(entwurf?.parzellen?.length ? entwurf.parzellen : null);
  const [personenHand, setPersonen] = useState<Person[] | null>(entwurf?.personen?.length ? entwurf.personen : null);
  const [name, setName] = useName();
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const setze = (teil: Partial<CalcAnnahmen>) => setAnnahmen(a => ({ ...a, ...teil }));
  const vonHand = (teil: Partial<VonHand>) => setHand(h => ({ ...h, ...teil }));

  // Erst tippen lassen, dann fragen -- sonst eine Abfrage je Zeichen.
  useEffect(() => { setWaehlen(false); const t = setTimeout(() => setGesucht(text), 300); return () => clearTimeout(t); }, [text]);
  const vorschlaege = useQuery({ queryKey: ['calc-adressen', gesucht.trim()], queryFn: () => adressen(gesucht), enabled: !gewaehlt && gesucht.trim().length >= 4, staleTime: 5 * 60 * 1000 });

  // Aus einem Lead geöffnet: Name und Adresse stehen schon da.
  const lead = useQuery({ queryKey: ['calc-lead', anfrageId], queryFn: () => leadLaden(anfrageId!), enabled: !!anfrageId && !entwurf, staleTime: Infinity });
  useEffect(() => {
    if (!lead.data) return;
    if (lead.data.adresse && !start) { setText(lead.data.adresse); setGesucht(lead.data.adresse); }
    if (lead.data.name) setKontakt(k => k || lead.data!.name!);
  }, [lead.data, start]);
  // Kam die Adresse von aussen und ist sie eindeutig, wird gleich gerechnet.
  const [vonAussen, setVonAussen] = useState(!!start || !!anfrageId);
  useEffect(() => {
    const liste = vorschlaege.data?.treffer ?? [];
    if (!vonAussen || gewaehlt || !vorschlaege.data) return;
    const wahl = adresseWaehlen(suchtext(gesucht), liste.map(v => v.label));
    // Fehlt die Hausnummer, steht die Liste der Nachbarn da: keine davon still nehmen.
    if ('index' in wahl && !vorschlaege.data.fehlt) setGewaehlt(liste[wahl.index]);
    setVonAussen(false);
  }, [vonAussen, gewaehlt, vorschlaege.data, gesucht]);

  const objekt = useQuery({
    queryKey: ['calc-objekt', gewaehlt?.e, gewaehlt?.n],
    queryFn: () => objektLaden(gewaehlt!, CALC_ANNAHMEN.grenzabstand),
    enabled: !!gewaehlt && !alt, staleTime: 10 * 60 * 1000, retry: 1,
  });
  // Der Verkaufspreis je m² aus den Preisen der letzten Jahre, begründet
  // (lib/preis-herleitung). In der Stadt Zürich je Quartier.
  const reihen = useQuery({ queryKey: ['preise-reihen'], queryFn: reihenLaden, staleTime: Infinity, enabled: !alt });
  const bfsObjekt = objekt.data?.bfs ? String(Number(objekt.data.bfs)) : null;
  const quartier = useQuery({
    queryKey: ['quartier', objekt.data?.punkt[0], objekt.data?.punkt[1]],
    queryFn: () => quartierLaden(objekt.data!.punkt[0], objekt.data!.punkt[1]),
    enabled: bfsObjekt === '261', staleTime: Infinity, retry: 0,
  });
  useEffect(() => {
    if (!objekt.data || reihen.isLoading || (bfsObjekt === '261' && quartier.isLoading)) return;
    // Wer den Preis selbst gesetzt hat (von Hand, aus Inseraten, aus dem Landpreis), behält ihn.
    if (['hand', 'inserate', 'land'].includes(erloesQuelleRef.current.art)) return;
    const h = erloesHerleiten(reihen.data, bfsObjekt, quartier.data ?? null);
    const angabe = bfsObjekt ? ERLOES_ANGABEN[bfsObjekt] : null;
    const amtlich = bfsObjekt ? ERLOES_AMTLICH[bfsObjekt] : null;
    if (h) {
      setAnnahmen(a => ({ ...a, erloes: h.m2 }));
      setErloesQuelle({ art: h.art, text: h.kurz, begruendung: angabe ? [...h.saetze, angabePruefen(h, angabe)] : h.saetze, verlauf: h.verlauf, spanne: h.spanne, spalten: h.spalten });
    } else if (amtlich) {
      // Ohne die Datei der Reihen: wie bisher die Neubauten der ganzen Stadt.
      setAnnahmen(a => ({ ...a, erloes: amtlich.m2 }));
      setErloesQuelle({ art: 'amtlich', text: amtlich.text });
    } else if (angabe) {
      setAnnahmen(a => ({ ...a, erloes: Math.round((angabe.von + angabe.bis) / 2) }));
      setErloesQuelle({ art: 'angabe', text: `Angabe Julian vom ${angabe.am}: ${angabe.gemeinde} ${de(angabe.von)} bis ${de(angabe.bis)} je m², gerechnet mit der Mitte` });
    }
  }, [objekt.data, reihen.data, reihen.isLoading, quartier.data, quartier.isLoading, bfsObjekt]);
  const umfeld = useQuery({
    queryKey: ['calc-umfeld', objekt.data?.egrid, objekt.data?.punkt[0], objekt.data?.punkt[1]],
    queryFn: () => umfeldLaden(objekt.data!), enabled: !!objekt.data, staleTime: 10 * 60 * 1000, retry: 0,
  });

  // Ein Entwurf von vor dem Mieterspiegel kennt die Wohnungen nicht: sie kommen beim Öffnen frisch aus dem Register.
  // Seit dem 20. November liest CALC auch die Gebäudekategorie (Wohnungen allein unterschätzen ein Haus mit Gewerbe).
  const altOhneWohnungen = !!alt && !!entwurf?.egrid && (alt.eingabe.grundlage.gebaeude ?? []).length > 0
    && (!(alt.eingabe.grundlage.gebaeude ?? []).some(g => g.wohnungsliste?.length) || (alt.eingabe.grundlage.gebaeude ?? []).some(g => g.kategorie === undefined));
  const frisch = useQuery({
    queryKey: ['calc-gebaeude-frisch', entwurf?.egrid], queryFn: () => gebaeudeFrisch(entwurf!.egrid!),
    enabled: altOhneWohnungen, staleTime: 30 * 60 * 1000, retry: 1,
  });
  const basis: Basis | null = useMemo(() => {
    if (alt) {
      const gebaeude = frisch.data?.length ? frisch.data : alt.eingabe.grundlage.gebaeude;
      return { adresse: alt.adresse, parzelleNr: alt.parzelleNr, eigentuemer: alt.eigentuemer, luecken: alt.luecken, egrid: entwurf!.egrid,
        parzelleId: entwurf!.parzelle_id, gemeinde: entwurf!.gemeinde, kanton: alt.eingabe.kanton, grundlage: { ...alt.eingabe.grundlage, gebaeude }, umfeld: alt.eingabe.umfeld,
        projekt: alt.eingabe.projekt ?? null };
    }
    const o = objekt.data;
    if (!o) return null;
    return {
      adresse: o.adresse, parzelleNr: o.parzelleNr, eigentuemer: o.eigentuemer, luecken: [...o.luecken, ...(o.zonenplanAus ? ['Der Zonenplan des Kantons hat nicht geantwortet.'] : [])],
      egrid: o.egrid, parzelleId: o.parzelleId, gemeinde: o.gemeinde, kanton: o.kanton,
      grundlage: { flaeche: o.flaeche, bauzoneM2: o.bauzoneM2, bebaubarM2: o.grundlage?.umriss_da ? o.grundlage.bebaubar_m2 : null,
        zone: o.zone, gebaeude: o.gebaeude, bestandQuelle: o.bestandQuelle, registerVollstaendig: o.registerDa },
      umfeld: { gemeinde: o.preise?.name ?? o.gemeinde, land: o.preise?.land ?? null, stwe: o.preise?.stwe ?? null, efh: o.preise?.efh ?? null,
        denkmal: o.denkmal, isos: o.isos, ...(umfeld.data ?? {}) },
      projekt: o.projekt,
    };
  }, [alt, entwurf, objekt.data, umfeld.data, frisch.data]);

  // Ein anderer Grenzabstand: die bebaubare Fläche rechnet die Datenbank am Umriss neu.
  const huelle = useQuery({
    queryKey: ['machbarkeit-grundlage', basis?.parzelleId, annahmen.grenzabstand],
    queryFn: () => grundlageLaden(basis!.parzelleId!, annahmen.grenzabstand),
    enabled: !!basis?.parzelleId && basis.grundlage.bebaubarM2 != null && annahmen.grenzabstand !== (alt?.eingabe.annahmen.grenzabstand ?? CALC_ANNAHMEN.grenzabstand),
    staleTime: 5 * 60 * 1000, placeholderData: vorher => vorher,
  });

  const eingabe: CalcEingabe | null = useMemo(() => basis && {
    grundlage: { ...basis.grundlage, bebaubarM2: huelle.data?.umriss_da ? huelle.data.bebaubar_m2 : basis.grundlage.bebaubarM2 },
    annahmen, kanton: basis.kanton, hand, umfeld: basis.umfeld, erloesQuelle, nachbarn, projekt: basis.projekt,
  }, [basis, huelle.data, annahmen, hand, erloesQuelle, nachbarn]);
  // Die Nachbarparzellen erst auf Wunsch: das sind bis zu zwölf Abfragen beim Bund.
  const nachbarListe = useQuery({
    queryKey: ['calc-nachbarn', basis?.egrid], queryFn: () => nachbarnLaden(basis!.egrid!),
    enabled: nachbarnAuf && !!basis?.egrid, staleTime: 30 * 60 * 1000, retry: 1,
  });
  const b = useMemo(() => (eingabe ? bewerten(eingabe) : null), [eingabe]);
  // Das letzte Baugesuch auf der Parzelle, für den Knopf aufs Projekt.
  const gesuche = useGesucheParzelle(basis?.parzelleId ?? null, basis?.egrid ?? null);
  const gesuch = basis ? (gesuche.data ?? []).find(g => aufParzelle(g, basis.parzelleId, basis.egrid)) ?? null : null;

  // Die Hauptparzelle und die Nachbarn, mit denen die Empfehlung rechnet.
  const parzellen: Parzelle[] = parzellenHand ?? (basis ? [
    { nummer: basis.parzelleNr ?? '', flaeche: basis.grundlage.flaeche ? Math.round(basis.grundlage.flaeche) : null, egrid: basis.egrid, adresse: basis.adresse.strasse },
    ...(b?.zusammen?.lohnt && b.empfehlung === b.zusammen.empfehlung ? b.zusammen.teile.map(t => ({ nummer: t.nummer ?? '', flaeche: Math.round(t.flaeche), egrid: t.egrid })) : []),
  ] : []);
  const personen: Person[] = personenHand ?? personenAusEigentuemer(basis?.eigentuemer);

  const andere = () => { setGewaehlt(null); setText(''); setGesucht(''); setHand({}); setAnnahmen(CALC_ANNAHMEN); setErloesQuelle(ERLOES_ANNAHME); setNachbarn([]); setNachbarnAuf(false); setFehler(null); };
  const erloesSetzen = (erloes: number, quelle: ErloesQuelle) => { setAnnahmen(a => ({ ...a, erloes })); setErloesQuelle(quelle); };

  const speichern = async (einreichen: boolean) => {
    if (!basis || !eingabe || !b) return;
    if (einreichen && !name.trim()) { setFehler('Bitte deinen Namen angeben: er steht im Verlauf.'); return; }
    if (einreichen && !empfaenger(personen).length) { setFehler('Bitte wählen, an wen das Angebot geht: bei einer Person «Bekommt das Angebot» ankreuzen.'); return; }
    setLaeuft(true); setFehler(null);
    try {
      let k = await entwurfSpeichern({
        adresse: basis.adresse.strasse, plz: basis.adresse.plz, gemeinde: basis.gemeinde ?? basis.adresse.ort,
        kanton: basis.kanton && /^[A-Z]{2}$/.test(basis.kanton) ? basis.kanton : null,
        egrid: basis.egrid, parzelle_id: basis.parzelleId, anfrage_id: entwurf?.anfrage_id ?? anfrageId ?? null,
        kontakt: kontakt.trim() || null, test: test || /\bTEST\b/.test(kontakt),
        eingaben: { eingabe, adresse: basis.adresse, parzelleNr: basis.parzelleNr, eigentuemer: basis.eigentuemer, luecken: basis.luecken, name: name.trim() || null },
        ergebnis: b, empfehlung_chf: b.empfehlung,
        quelle, parzellen: parzellen.filter(p => p.nummer.trim() || p.flaeche), personen,
      }, entwurf?.id);
      if (einreichen) k = await schritt(k.id, 'einreichen', name.trim());
      onGespeichert(k);
    } catch (x) {
      setFehler((x as Error).message || 'Speichern hat nicht geklappt.');
    } finally {
      setLaeuft(false);
    }
  };
  const verwerfen = async () => {
    if (!entwurf) return;
    setLaeuft(true);
    try { await entwurfLoeschen(entwurf.id); onVerworfen?.(); } catch (x) { setFehler((x as Error).message); } finally { setLaeuft(false); }
  };

  const vergleiche = hand.vergleiche ?? [];
  const setVergleich = (i: number, teil: Partial<Vergleich>) => vonHand({ vergleiche: vergleiche.map((v, j) => (j === i ? { ...v, ...teil } : v)) });
  const marktmiete = median(vergleiche.filter(v => v.flaeche > 0 && v.miete > 0).map(v => v.miete / v.flaeche));
  const kaeufe = hand.kaeufe ?? [];
  const setKauf = (i: number, teil: Partial<Kauf>) => vonHand({ kaeufe: kaeufe.map((k, j) => (j === i ? { ...k, ...teil } : k)) });
  const kaufMedian = median(kaeufe.filter(k => k.flaeche > 0 && k.preis > 0).map(k => k.preis / k.flaeche));
  const zonenplanAus = !alt && !!objekt.data?.zonenplanAus;
  const zone = basis?.grundlage.zone;
  const zoneText = zone ? [zone.bezeichnung, zone.abkuerzung && `(${zone.abkuerzung})`, zone.quelle === 'kanton' ? '· Zonenplan des Kantons' : '· eigene Liste'].filter(Boolean).join(' ') : null;

  // ---- noch keine Adresse gewählt
  if (!gewaehlt) {
    const liste = vorschlaege.data?.treffer ?? [];
    const fehlt = vorschlaege.data?.fehlt ?? null;
    return (
      <div className="space-y-3">
        <form role="search" className="flex gap-2" onSubmit={e => {
          e.preventDefault();
          if (!liste.length) return;
          const wahl = adresseWaehlen(suchtext(text), liste.map(v => v.label));
          // Nie still den ersten Vorschlag: bei «Dietlikerstrasse 55 in Kloten» wäre das die Lindenstrasse 55 gewesen.
          if ('index' in wahl && !fehlt) setGewaehlt(liste[wahl.index]); else setWaehlen(true);
        }}>
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Adresse</span>
            <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            {/* 17 px: unter 16 px vergrössert Safari auf dem iPhone die Seite beim Tippen. */}
            <input value={text} onChange={e => setText(e.target.value)} type="search" enterKeyHint="search" autoComplete="off"
                   placeholder="Adresse, Parzelle oder EGRID" aria-label="Adresse"
                   className="h-14 w-full min-w-0 rounded-[3px] border border-input bg-card pl-12 pr-4 text-[17px] placeholder:text-muted-foreground focus:border-foreground focus:outline-none" />
          </label>
          <button type="submit" className={`${KNOPF_HAUPT} h-14 px-5 sm:px-7`} disabled={!liste.length}>Rechnen</button>
        </form>
        {vorschlaege.isFetching && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Adressen werden gesucht …</p>}
        {vorschlaege.error && <p className="text-sm text-destructive">Der Suchdienst des Bundes antwortet gerade nicht. Bitte später noch einmal.</p>}
        {fehlt && !vorschlaege.isFetching && (
          <p className="text-[15px]">
            <span className="font-medium">{fehlt.strasse} {fehlt.nummer}</span> gibt es im Gebäude- und Wohnungsregister des Bundes nicht.
            {liste.length ? ' Die nächsten Nummern an dieser Strasse:' : ''}
          </p>
        )}
        {!fehlt && waehlen && liste.length > 1 && !vorschlaege.isFetching && <p className="text-[15px]">Welche ist gemeint? Bitte antippen.</p>}
        {liste.length > 0 && (
          <ul className={LISTE}>
            {liste.map(v => (
              <li key={`${v.label}-${v.e}`}>
                <button type="button" onClick={() => setGewaehlt(v)} className="flex min-h-12 w-full items-center px-4 py-2 text-left text-[15px] hover:bg-secondary/60">{v.label}</button>
              </li>
            ))}
          </ul>
        )}
        {gesucht.trim().length >= 4 && !vorschlaege.isFetching && !vorschlaege.error && liste.length === 0 && (
          <p className="text-sm text-muted-foreground">Keine Adresse gefunden. Strasse, Hausnummer und Ort ausschreiben.</p>
        )}
        {(fehlt || (gesucht.trim().length >= 4 && !vorschlaege.isFetching && liste.length === 0)) && (
          <p className="text-sm text-muted-foreground">Ohne Adresse geht es über die Parzelle: Gemeinde und Parzellennummer, zum Beispiel «Kloten 2061», oder die EGRID.</p>
        )}
      </div>
    );
  }

  // ---- Adresse gewählt: laden, dann rechnen
  if (!basis || !b || !eingabe) {
    return (
      <div className="space-y-3">
        <p className="text-lg">{gewaehlt.label}</p>
        {objekt.error
          ? <p className="text-sm text-destructive">Die Angaben zur Adresse liessen sich nicht holen. Bitte noch einmal versuchen.</p>
          : <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Parzelle, Zone und Gebäude werden geholt …</p>}
        <button type="button" className={KNOPF} onClick={andere}>Andere Adresse</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Objektkopf adresse={basis.adresse} parzelleNr={basis.parzelleNr} flaeche={basis.grundlage.flaeche} zone={zoneText} eigentuemer={basis.eigentuemer} gebaeude={basis.grundlage.gebaeude}
        rechts={!entwurf && <button type="button" className={KNOPF} onClick={andere}><X className="h-4 w-4" /> Andere Adresse</button>} />
      {basis.luecken.length > 0 && <p className="text-sm text-destructive">{basis.luecken.join(' ')}</p>}
      <ProjektHinweis projekt={basis.projekt} gesuch={gesuch} wo="Die Kalkulation" />
      {zonenplanAus && (
        <button type="button" className={KNOPF} disabled={objekt.isFetching} onClick={() => void objekt.refetch()}>
          {objekt.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Zonenplan noch einmal fragen
        </button>
      )}

      <Ergebnis b={b} annahmen={annahmen} onErloes={erloesSetzen} />

      <section className="space-y-3">
        <div>
          <h3 className="text-lg">Nachbar dazukaufen</h3>
          <p className="text-sm text-muted-foreground">
            Lässt sich eine Nachbarparzelle dazukaufen, rechnen beide zusammen. Der Nachbar bekommt, was seine Parzelle allein wert ist;
            was die gemeinsame Rechnung mehr hergibt, geht in dieses Angebot.
          </p>
        </div>
        {!nachbarnAuf && (
          <button type="button" className={KNOPF} disabled={!basis.egrid} onClick={() => setNachbarnAuf(true)}>Nachbarparzellen laden</button>
        )}
        {nachbarnAuf && nachbarListe.isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Nachbarn werden beim Bund geholt …</p>}
        {nachbarnAuf && nachbarListe.error && <p className="text-sm text-destructive">Die Nachbarparzellen liessen sich nicht holen. Bitte später noch einmal.</p>}
        {nachbarnAuf && (nachbarListe.data || nachbarn.length > 0) && (
          <ul className={LISTE}>
            {(nachbarListe.data ?? nachbarn.map(n => ({ ...n, kanton: null }))).map(n => {
              const an = nachbarn.some(x => x.egrid === n.egrid);
              // Eine Bauzone ohne Ziffer (Quartiererhaltung, Kernzone) rechnet mit der Dichte dieser Parzelle:
              // das geht erst, wenn diese selbst gerechnet ist.
              const art = nachbarArt(n.flaeche, n.zone, annahmen);
              const dichte = b.neubau && b.studie.flaeche > 0 ? b.neubau.hnf / b.studie.flaeche : null;
              const waehlbar = art === 'ziffer' || (art === 'dichte' && dichte != null);
              const allein = waehlbar ? bewerten({ ...eingabe, grundlage: { flaeche: n.flaeche, bebaubarM2: null, zone: n.zone, gebaeude: n.gebaeude, registerVollstaendig: true }, hand: {}, nachbarn: [], dichte, projekt: null }).wert : null;
              const hinweis = art === 'ziffer' ? null
                : art === 'keine' ? 'keine Wohn-, Misch- oder Arbeitszone'
                  : waehlbar ? 'ohne Ziffer, gerechnet wie diese Parzelle'
                    : 'ohne Ziffer: zuerst unten bei «Zone von Hand» die Ausnützung eintragen';
              const haus = n.gebaeude[0];
              const zeile = [
                `${de(n.flaeche)} m²`, n.zone ? n.zone.abkuerzung ?? n.zone.bezeichnung : null,
                n.gebaeude.length ? `${n.gebaeude.length} ${n.gebaeude.length === 1 ? 'Gebäude' : 'Gebäude'}${haus?.baujahr ? `, Baujahr ${haus.baujahr}` : ''}` : 'unbebaut',
              ].filter(Boolean).join(' · ');
              return (
                <li key={n.egrid}>
                  <label className={`flex min-h-12 items-center gap-3 px-4 py-2.5 ${waehlbar ? 'cursor-pointer hover:bg-secondary/60' : 'opacity-50'}`}>
                    <input type="checkbox" className="h-5 w-5 shrink-0 accent-foreground" checked={an && waehlbar} disabled={!waehlbar}
                           onChange={x => setNachbarn(v => (x.target.checked ? [...v, { egrid: n.egrid, nummer: n.nummer, flaeche: n.flaeche, zone: n.zone, gebaeude: n.gebaeude }] : v.filter(y => y.egrid !== n.egrid)))} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px]">{n.nummer ? `Parzelle ${n.nummer}` : 'Parzelle'}</span>
                      <span className="block text-sm text-muted-foreground">{hinweis ? `${zeile} · ${hinweis}` : zeile}</span>
                    </span>
                    {allein != null && <span className="shrink-0 text-sm tabular-nums text-muted-foreground">allein {chf(allein)}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {nachbarnAuf && nachbarListe.data?.length === 0 && <p className="text-sm text-muted-foreground">Der Kataster nennt keine Nachbarparzellen.</p>}
        {nachbarnAuf && (
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <Zahl titel="Arealüberbauung ab" wert={annahmen.arealMin} einheit="m²" min={0} max={50000} schritt={500} setWert={n => setze({ arealMin: n })} />
            <Zahl titel="Bonus Arealüberbauung" wert={Math.round(annahmen.arealBonus * 1000) / 10} einheit="%" min={0} max={50} schritt={1} setWert={n => setze({ arealBonus: n / 100 })} />
          </div>
        )}
        {b.zusammen && (
          <dl className="space-y-1.5 rounded-[3px] border bg-card p-4 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Zusammen</dt><dd className="tabular-nums">{de(b.zusammen.flaeche)} m², {de(Math.round(b.zusammen.hnf))} m² Nutzfläche{b.zusammen.bonus > 0 ? ` (+${Math.round(b.zusammen.bonus * 100)} % Arealüberbauung)` : ''}</dd></div>
            {b.zusammen.dichte ? (
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Nachbarn ohne Ziffer</dt><dd className="tabular-nums">Annahme: {de(b.zusammen.dichte, 2)} m² Nutzfläche je m² Land, wie diese Parzelle</dd></div>
            ) : null}
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Landwert zusammen</dt><dd className="whitespace-nowrap tabular-nums">{chf(b.zusammen.landwert)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{b.zusammen.teile.length === 1 ? 'Der Nachbar zu seinem eigenen Wert' : 'Die Nachbarn je zu ihrem eigenen Wert'}</dt><dd className="whitespace-nowrap tabular-nums">− {chf(b.zusammen.nachbarWert)}</dd></div>
            <div className="flex justify-between gap-3 border-t pt-1.5 font-medium"><dt>Bleibt für diese Parzelle</dt><dd className="whitespace-nowrap tabular-nums">{chf(b.zusammen.fuerUns)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Allein</dt><dd className="tabular-nums">{b.wert != null ? chf(b.wert) : '–'}</dd></div>
          </dl>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg">Annahmen</h3>
          <p className="text-sm text-muted-foreground">Erfahrungswerte, die du ändern kannst. Die Rechnung folgt sofort.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Zahl titel="Erlös je m² Nutzfläche" wert={annahmen.erloes} einheit="CHF" min={2000} max={60000} schritt={100} setWert={n => erloesSetzen(n, { art: 'hand', text: 'von Hand eingegeben' })} />
          <Offen titel="Baukosten je m² Nutzfläche" wert={annahmen.baukostenHnf} einheit="CHF" platz={b.neubau ? de(b.neubau.baukostenJeM2) : undefined} setWert={n => setze({ baukostenHnf: n })} />
          {/* Sind Pläne oder Zahlen des Bauherrn bekannt, gehen sie der Formel vor (YOMORI, 18. November). */}
          <Offen titel="Nutzfläche laut Projekt" wert={hand.projektHnf} einheit="m²" platz={b.neubau && !b.neubau.projektHand ? de(Math.round(b.neubau.hnf)) : undefined} setWert={n => vonHand({ projektHnf: n })} />
          <Offen titel="Baukosten laut Projekt" wert={hand.projektBaukosten} einheit="CHF" platz={b.neubau && !hand.projektBaukosten ? de(Math.round(b.neubau.baukosten / 10000) * 10000) : undefined} setWert={n => vonHand({ projektBaukosten: n })} />
          <Zahl titel="Baukosten Mietwohnungen je m²" wert={annahmen.baukostenMiete} einheit="CHF" min={2000} max={15000} schritt={100} setWert={n => setze({ baukostenMiete: n })} />
          <Zahl titel="Gewinn vom Erlös" wert={Math.round(annahmen.marge * 1000) / 10} einheit="%" min={0} max={50} schritt={1} setWert={n => setze({ marge: n / 100 })} />
          <Zahl titel="Zuschlag kleines Projekt" wert={Math.round((annahmen.klein ?? CALC_ANNAHMEN.klein) * 1000) / 10} einheit="%" min={0} max={60} schritt={5} setWert={n => setze({ klein: n / 100 })} />
          <Zahl titel="Abschlag auf den Wert" wert={Math.round(annahmen.abschlag * 1000) / 10} einheit="%" min={0} max={50} schritt={1} setWert={n => setze({ abschlag: n / 100 })} />
          <Zahl titel="Grenzabstand" wert={annahmen.grenzabstand} einheit="m" min={0} max={30} schritt={0.5} setWert={n => setze({ grenzabstand: n })} />
          <Zahl titel="Wohnungsgrösse" wert={annahmen.wohnungM2} einheit="m²" min={30} max={250} schritt={5} setWert={n => setze({ wohnungM2: n })} />
          <Zahl titel="Abbruch je m² Bestand" wert={annahmen.abbruch} einheit="CHF" min={0} max={2000} schritt={10} setWert={n => setze({ abbruch: n })} />
          <Zahl titel="Rendite des Käufers" wert={Math.round(annahmen.rendite * 1000) / 10} einheit="%" min={1} max={12} schritt={0.1} setWert={n => setze({ rendite: n / 100 })} />
          <Zahl titel="Bestand je m², Anteil am Erlös" wert={Math.round((annahmen.bestandAnteil ?? CALC_ANNAHMEN.bestandAnteil!) * 1000) / 10} einheit="%" min={0} max={100} schritt={0.1} setWert={n => setze({ bestandAnteil: n / 100 })} />
        </div>
        {/* Woraus die Baukosten bestehen: die Stufe nach Verkaufspreis und die Zuschläge. */}
        {b.neubau && (
          <p className="text-sm text-muted-foreground">
            {hand.projektBaukosten
              ? <>Baukosten laut Projekt: {chf(b.neubau.baukosten)}, CHF {de(b.neubau.baukostenJeM2)} je m² Nutzfläche. Leer lassen, dann gelten Preisstufe und Zuschläge.</>
              : b.neubau.kosten.vonHand
              ? <>Baukosten von Hand: CHF {de(b.neubau.baukostenJeM2)} je m² Nutzfläche. Leer lassen, dann gelten Preisstufe und Zuschläge.</>
              : <>Baukosten inklusive Nebenkosten: CHF {de(b.neubau.kosten.grund)} je m² bei einem Verkaufspreis von CHF {de(annahmen.erloes)}
                {b.neubau.kosten.hang > 0 && `, +${Math.round(b.neubau.kosten.hang * 100)} % Hanglage (${de(basis.umfeld.neigung ?? 0, 1)} % Steigung)`}
                {b.neubau.kosten.zuerich > 0 && `, +${de(b.neubau.kosten.zuerich * 100, 1)} % Nähe zu Zürich (${de(basis.umfeld.zuerichKm ?? 0, 1)} km)`}
                {b.neubau.kosten.klein > 0 && `, +${Math.round(b.neubau.kosten.klein * 100)} % kleines Projekt (unter ${chf(annahmen.kleinGrenze ?? CALC_ANNAHMEN.kleinGrenze)} Baukosten)`}
                {' '}= CHF {de(b.neubau.baukostenJeM2)}.{basis.umfeld.neigung != null && b.neubau.kosten.hang === 0 && ` Gelände eben (${de(basis.umfeld.neigung, 1)} % Steigung).`} Abbruch kommt dazu.</>}
          </p>
        )}
        {/* Woran sich der Erlös messen lässt: was Eigentumswohnungen in der Gemeinde wirklich kosten. */}
        {basis.umfeld.stwe && (
          <p className="text-sm text-muted-foreground">
            Eigentumswohnungen in {basis.umfeld.gemeinde}: {wohnungText(basis.umfeld.stwe as Wert)} (amtlich). Die Rechnung verkauft {de(annahmen.wohnungM2)} m² für CHF {de(annahmen.erloes * annahmen.wohnungM2)}.
          </p>
        )}
      </section>

      <div className="space-y-2 rounded-[3px] border bg-card p-4">
        <p className="font-medium">Was Wohnungen hier kosten</p>
        <p className="text-sm text-muted-foreground">
          Erlös heute: CHF {de(annahmen.erloes)} je m², {erloesQuelle.text}. Am besten zeigen ihn zwei, drei neue Eigentumswohnungen in der Nähe: Fläche und Kaufpreis eintragen.
        </p>
        <div className="flex flex-wrap gap-2">
          {portalLinks(basis.adresse, 'kaufen').map(l => (
            <a key={l.titel} href={l.adresse} target={FENSTER.extern} className={KNOPF_LEISE}><ExternalLink className="h-4 w-4" /> {l.titel}</a>
          ))}
        </div>
        {kaeufe.map((k, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] items-end gap-2">
            <Offen titel="Fläche" wert={k.flaeche || null} einheit="m²" setWert={n => setKauf(i, { flaeche: n ?? 0 })} />
            <Offen titel="Kaufpreis" wert={k.preis || null} einheit="CHF" setWert={n => setKauf(i, { preis: n ?? 0 })} />
            <button type="button" aria-label="Wohnung entfernen" className="grid h-11 w-11 place-items-center rounded-[3px] text-muted-foreground hover:bg-secondary"
                    onClick={() => vonHand({ kaeufe: kaeufe.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={KNOPF} onClick={() => vonHand({ kaeufe: [...kaeufe, { flaeche: 0, preis: 0 }] })}><Plus className="h-4 w-4" /> Wohnung eintragen</button>
          {kaufMedian != null && (
            <button type="button" className={KNOPF_HAUPT} onClick={() => erloesSetzen(Math.round(kaufMedian / 100) * 100, { art: 'inserate', text: `Median aus ${kaeufe.filter(k => k.flaeche > 0 && k.preis > 0).length} Kaufinseraten` })}>
              Median CHF {de(Math.round(kaufMedian / 100) * 100)} als Erlös übernehmen
            </button>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg">Bestand und Mieten</h3>
          <p className="text-sm text-muted-foreground">Was der Eigentümer sagt, geht jeder Annahme vor. Leer heisst: nicht bekannt.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Offen titel="Mietertrag im Jahr, netto" wert={hand.mietertragJahr} einheit="CHF" setWert={n => vonHand({ mietertragJahr: n })} />
          <Offen titel="Miete heute je m² und Monat" wert={hand.mieteHeute} einheit="CHF" platz={b.bestand?.mieteArt === 'statistik' && b.bestand.mieteHeute ? de(b.bestand.mieteHeute, 2) : undefined} setWert={n => vonHand({ mieteHeute: n })} />
          <Offen titel="Vermietbare Fläche" wert={hand.wohnflaeche} einheit="m²" platz={(b.bestand?.flaecheArt === 'fussabdruck' || b.bestand?.flaecheArt === 'register') && b.bestand.flaeche ? de(Math.round(b.bestand.flaeche)) : undefined} setWert={n => vonHand({ wohnflaeche: n })} />
        </div>

        {/* Der Mieterspiegel aus dem Gebäuderegister (Tim, 20. November: «Anzahl Wohnungen,
            deren Grösse und die inserierten Preise»): jede Wohnung mit Geschoss, Zimmern und
            Fläche; die Miete je Wohnung trägt ein Mensch ein, aus dem Mieterspiegel des
            Eigentümers oder einem Inserat dieser Adresse. Leer heisst: gerechnet. */}
        {b.bestand && b.bestand.spiegel.length > 0 && (
          <div className="space-y-2 rounded-[3px] border bg-card p-4">
            <p className="font-medium">Mieterspiegel: {b.bestand.spiegel.length} {b.bestand.spiegel.length === 1 ? 'Wohnung' : 'Wohnungen'} laut Gebäuderegister</p>
            <p className="text-sm text-muted-foreground">
              Wohnung, Geschoss, Zimmer und Fläche stehen im Gebäuderegister. Trag die Netto-Miete ein, wo sie bekannt ist; ohne Eingabe rechnet die Zeile mit {b.bestand.mieteArt === 'hand' ? 'der eingegebenen Miete je m²' : 'der Miete je m² des Kantons'}.
            </p>
            <ul className={LISTE}>
              {b.bestand.spiegel.map(z => (
                <li key={z.id} className="grid grid-cols-1 items-end gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)]">
                  <span className="min-w-0">
                    <span className="block font-medium">Wohnung {z.nr ?? '–'}{z.geschoss ? ` · ${z.geschoss}` : ''}</span>
                    <span className="block text-sm text-muted-foreground">
                      {z.zimmer != null ? `${de(z.zimmer, z.zimmer % 1 ? 1 : 0)} Zimmer` : 'Zimmer offen'} · {z.flaeche != null ? `${de(z.flaeche)} m²` : 'Fläche offen'}
                      {z.quelle === 'gerechnet' && z.miete != null ? ` · gerechnet CHF ${de(Math.round(z.miete))}` : ''}
                    </span>
                  </span>
                  <Offen titel="Netto-Miete im Monat" wert={hand.wohnungMiete?.[z.id] ?? null} einheit="CHF" platz={z.miete != null ? de(Math.round(z.miete)) : undefined}
                         setWert={n => {
                           const neu = { ...(hand.wohnungMiete ?? {}) };
                           if (n == null) delete neu[z.id]; else neu[z.id] = n;
                           vonHand({ wohnungMiete: neu });
                         }} />
                </li>
              ))}
            </ul>
            <p className="text-sm">
              Zusammen {de(Math.round(b.bestand.spiegel.reduce((s, z) => s + (z.flaeche ?? 0), 0)))} m² · Mietertrag im Jahr {chf(b.bestand.ertragHeute)} · Ertragswert {chf(b.bestand.wert)}
            </p>
            <p className="text-xs text-muted-foreground">Ob von dieser Adresse Wohnungen inseriert sind, zeigen die Portale unten: Comparis und Homegate lassen sich nicht automatisch auslesen.</p>
          </div>
        )}

        <div className="space-y-2 rounded-[3px] border bg-card p-4">
          <p className="font-medium">Was die Nachbarschaft zahlt</p>
          <p className="text-sm text-muted-foreground">
            Comparis und Homegate lassen sich nicht automatisch auslesen. Öffne die Suche, und trag zwei, drei vergleichbare Wohnungen ein: Fläche und Netto-Miete im Monat.
          </p>
          <div className="flex flex-wrap gap-2">
            {portalLinks(basis.adresse).map(l => (
              <a key={l.titel} href={l.adresse} target={FENSTER.extern} className={KNOPF_LEISE}><ExternalLink className="h-4 w-4" /> {l.titel}</a>
            ))}
          </div>
          {vergleiche.map((v, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] items-end gap-2">
              <Offen titel="Fläche" wert={v.flaeche || null} einheit="m²" setWert={n => setVergleich(i, { flaeche: n ?? 0 })} />
              <Offen titel="Miete im Monat" wert={v.miete || null} einheit="CHF" setWert={n => setVergleich(i, { miete: n ?? 0 })} />
              <button type="button" aria-label="Wohnung entfernen" className="grid h-11 w-11 place-items-center rounded-[3px] text-muted-foreground hover:bg-secondary"
                      onClick={() => vonHand({ vergleiche: vergleiche.filter((_, j) => j !== i) })}><X className="h-4 w-4" /></button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={KNOPF} onClick={() => vonHand({ vergleiche: [...vergleiche, { flaeche: 0, miete: 0 }] })}><Plus className="h-4 w-4" /> Wohnung eintragen</button>
            {marktmiete != null && <p className="text-sm">Median CHF {de(marktmiete, 2)} je m² und Monat</p>}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg">Zone von Hand</h3>
          <p className="text-sm text-muted-foreground">
            {zone?.quelle === 'kanton' && !zone.az && !zone.bmz ? 'Der Zonenplan des Kantons nennt für diese Zone keine Ziffer (Quartiererhaltung, Kernzone). Was die Bauordnung erlaubt, hier eintragen.'
              : zone?.quelle === 'kanton' ? 'Der Zonenplan des Kantons ist gelesen. Nur ausfüllen, wenn die Bauordnung etwas anderes sagt.'
              : basis.kanton === 'ZH' ? 'Der Zonenplan des Kantons hat nicht geantwortet: gerechnet ist mit der eigenen Liste. Oben noch einmal fragen, oder Ziffer und Geschosse aus der Bauordnung eintragen.'
              : 'Für diesen Ort ist kein amtlicher Zonenplan angebunden. Ziffer und Geschosse stehen in der Bauordnung der Gemeinde.'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          <Offen titel="Ausnützungsziffer" wert={hand.az} einheit="" platz={zone?.az ? de(zone.az, 2) : 'z.B. 0.6'} setWert={n => vonHand({ az: n })} />
          <Offen titel="Vollgeschosse" wert={hand.vollgeschosse} einheit="" platz={zone?.vollgeschosse ? de(zone.vollgeschosse) : 'z.B. 3'} setWert={n => vonHand({ vollgeschosse: n })} />
        </div>
      </section>

      <Empfaenger quelle={quelle} setQuelle={setQuelle} parzellen={parzellen} setParzellen={setParzellen} personen={personen} setPersonen={setPersonen} />

      <section className="space-y-3 rounded-[3px] border bg-card p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className={ETIKETT}>Eigentümer oder Lead</span>
            <input value={kontakt} onChange={e => setKontakt(e.target.value)} placeholder="Frau Muster" className={`${FELD} w-full text-base`} />
          </label>
          <label className="block space-y-1.5">
            <span className={ETIKETT}>Dein Name</span>
            <input value={name} onChange={e => setName(e.target.value)} autoComplete="given-name" className={`${FELD} w-full text-base`} />
          </label>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" checked={test} onChange={e => setTest(e.target.checked)} className="h-5 w-5 accent-foreground" /> Testdaten
        </label>
        {fehler && <p className="text-sm text-destructive">{fehler}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={KNOPF_HAUPT} disabled={laeuft || b.empfehlung == null} onClick={() => void speichern(true)}>Zur Prüfung einreichen</button>
          <button type="button" className={KNOPF} disabled={laeuft} onClick={() => void speichern(false)}>Als Entwurf speichern</button>
          {entwurf && <button type="button" className={KNOPF} disabled={laeuft} onClick={() => void verwerfen()}>Entwurf löschen</button>}
        </div>
        <p className="text-sm text-muted-foreground">Mit dem Einreichen läuft die Uhr: David prüft den Preis, Tim visiert, Julian kontrolliert, Tim bestätigt, David verschickt, alles in 24 Stunden.</p>
      </section>

      {/* Schon zum Entwurf lässt sich sagen, ob der Preis stimmt; die Datenbank misst gegen die gespeicherte Empfehlung. */}
      {entwurf && <Bemerkungen kalkulationId={entwurf.id} empfehlung={entwurf.empfehlung_chf} kanton={entwurf.kanton} />}
    </div>
  );
}
