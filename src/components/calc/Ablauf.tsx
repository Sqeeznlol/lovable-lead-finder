import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Download, FileText, Loader2, Mail, MessageCircle, Printer, RotateCcw } from 'lucide-react';
import { FELD, KNOPF, KNOPF_HAUPT, Marke, Strichbalken } from '@/components/rahmen';
import { Bemerkungen } from '@/components/calc/Bemerkungen';
import { Ergebnis, Objektkopf } from '@/components/calc/Ergebnis';
import { useJetzt, useName } from '@/components/calc/name';
import {
  adressbloecke, AM_ZUG, anrede, brief, deckblattBreite, empfaenger, felderVorgabe, FIRMEN, FIRMEN_WAHL, katNummern, lernen, LERNEN_AB, luecken, nachricht, punkteAlsText,
  SCHRIFTEN, URTEIL_TEXT, VORLAGEN, vorlageVorschlag, vorschlag, type AblaufPerson, type AngebotFelder, type FirmaId, type Kontext,
  type Unterschrift, type Urteil, type VorlageId,
} from '@/lib/angebot';
import {
  ablaufPersonenLaden, alleRueckmeldungen, bemerkungenLaden, betrag, kalkulationenLaden, phase, PHASEN, schritt, SCHRITT_TEXT, uhr, ZUSTAND_TEXT,
  type Kalkulation, type Schritt, type SchrittDaten,
} from '@/lib/calc-ablauf';
import { drucken } from '@/lib/drucken';
import { FENSTER } from '@/lib/fenster';
import { luftbildLv95 } from '@/lib/luftbild';
import { istFehlendeFassung, neuLadenEinmal } from '@/lib/neue-fassung';

/**
 * Der Weg einer eingereichten Kalkulation zum verschickten Kaufangebot
 * (Julian, 19. November): David prüft den Preis und begründet sein
 * Urteil, wählt Firma und Vorlage (die Schrift gehört zur Firma); Tim visiert; Julian
 * kontrolliert; Tim bestätigt; David verschickt. Oben läuft die Uhr
 * (24 Stunden), darunter steht, wer am Zug ist, mit einem Knopf für die
 * Nachricht an ihn, und genau eine Tafel für seinen Schritt.
 *
 * Reihenfolge, Rollen und Zeit erzwingt die Datenbank (kalkulation_schritt).
 * Aurora verschickt keine Mails: die Nachricht öffnet das Mailprogramm
 * oder WhatsApp mit Empfänger, Text und Link.
 */
const ETIKETT = 'text-[11px] uppercase tracking-wide text-muted-foreground';
const TEXTFELD = 'w-full rounded-[3px] border border-input bg-card px-3.5 py-2.5 text-base leading-relaxed focus:border-foreground focus:outline-none';
const WAHL = (an: boolean) => `min-h-11 rounded-[3px] border px-3 text-left text-sm transition-colors ${an ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-secondary'}`;
const wann = (iso: string) => new Date(iso).toLocaleString('de-CH', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const betragLesen = (t: string): number | null => {
  const n = Number(t.replace(/['’\s]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

/** Die Felder des Briefs: was gespeichert ist, über den Vorgaben der Vorlage. */
function felderAus(k: Kalkulation, vorlage: VorlageId, personen: AblaufPerson[], firma: FirmaId): AngebotFelder {
  const vorgabe = felderVorgabe(vorlage);
  const unterschreiben = personen.filter(p => p.rollen.includes('unterschrift') && p.firma === firma)
    .map<Unterschrift>(p => ({ name: p.name, titel: p.titel ?? '', telefon: p.telefon, email: p.email }));
  return {
    ...vorgabe,
    ortsteil: k.gemeinde ?? '',
    unterschriften: unterschreiben,
    kontakt: unterschreiben.find(u => u.telefon || u.email) ?? null,
    ...k.angebot,
  };
}

function zoneText(k: Kalkulation): string | null {
  const z = k.eingaben.eingabe.grundlage.zone;
  return z ? [z.bezeichnung, z.abkuerzung && !z.bezeichnung.includes(z.abkuerzung) ? z.abkuerzung : null].filter(Boolean).join(' ') : null;
}

function kontextAus(k: Kalkulation, firma: FirmaId, felder: AngebotFelder, preis: number): Kontext {
  return {
    firma: FIRMEN[firma], felder, preis, adresse: k.adresse, plzOrt: [k.plz, k.gemeinde].filter(Boolean).join(' '),
    gemeinde: k.gemeinde, kanton: k.kanton, zone: zoneText(k), parzellen: k.parzellen ?? [], personen: k.personen ?? [],
  };
}

/** Das Luftbild für das Deckblatt, als data:-Adresse. Fällt der Bund aus, kommt das Angebot ohne Bild. */
async function luftbild(k: Kalkulation): Promise<string | null> {
  const a = k.eingaben.adresse;
  if (!a?.e || !a?.n) return null;
  const halt = new AbortController();
  const t = setTimeout(() => halt.abort(), 8000);
  try {
    // Das Haus soll das Bild füllen, nicht das Quartier (Julian, 20. November: «da sollte das Haus sein»).
    const r = await fetch(luftbildLv95(a.e, a.n, deckblattBreite(k), 1280), { signal: halt.signal });
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise(ok => { const f = new FileReader(); f.onload = () => ok(String(f.result)); f.onerror = () => ok(null); f.readAsDataURL(blob); });
  } catch { return null; } finally { clearTimeout(t); }
}

export function Ablauf({ k, onGeaendert }: { k: Kalkulation; onGeaendert: (k: Kalkulation) => void }) {
  const [name, setName] = useName();
  const jetzt = useJetzt();
  const leute = useQuery({ queryKey: ['angebot-personen'], queryFn: ablaufPersonenLaden, staleTime: 5 * 60 * 1000, retry: 0 });
  const alle = useQuery({ queryKey: ['kalkulationen'], queryFn: kalkulationenLaden, staleTime: 60 * 1000 });
  const personen = leute.data ?? [];

  const gebaeude = k.eingaben.eingabe.grundlage.gebaeude?.length ?? 0;
  const startVorlage = k.vorlage ?? vorlageVorschlag({ gebaeude, massgebend: k.ergebnis.massgebend, empfaenger: empfaenger(k.personen ?? []) });
  const [firma, setFirma] = useState<FirmaId>(k.firma ?? 'stimo');
  const [vorlage, setVorlage] = useState<VorlageId>(startVorlage);
  // Die Schrift gehört zur Firma (22. November, Julian: «die Schriftart bei
  // Studer nur für Studer, die bei stimo nur bei stimo»): keine eigene Wahl.
  const schrift = FIRMEN[firma].schrift;
  const [felder, setFelder] = useState<AngebotFelder>(() => felderAus(k, startVorlage, [], k.firma ?? 'stimo'));
  const [urteil, setUrteil] = useState<Urteil | null>(null);
  const [preis, setPreis] = useState('');
  const [notiz, setNotiz] = useState('');
  const [mailText, setMailText] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [pdfLaeuft, setPdfLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [eben, setEben] = useState(false);
  // Ruhe auf der Seite (22. November, Julian: «die komplette Seite so
  // unübersichtlich»): offen steht nur der nächste Schritt. Angebot,
  // Verlauf, Rechnung und Gespräch klappen auf; gedruckt wird alles.
  const [angebotAuf, setAngebotAuf] = useState(false);
  const [verlaufAuf, setVerlaufAuf] = useState(false);
  const [rechnungAuf, setRechnungAuf] = useState(false);
  const [gespraechAuf, setGespraechAuf] = useState(false);
  const bild = useRef<Promise<string | null> | null>(null);

  // Mit jedem Stand frisch vorbelegen: Preis, Felder, Wahl der Firma.
  useEffect(() => {
    setPreis(String(Math.round(k.preis_chf ?? k.empfehlung_chf ?? 0) || ''));
    setNotiz(''); setUrteil(null); setFehler(null);
    setFirma(k.firma ?? 'stimo');
    setVorlage(k.vorlage ?? startVorlage);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Wechsel des Stands, nicht bei jedem Tastendruck
  }, [k.id, k.zustand]);
  // Die Felder, sobald bekannt ist, wer unterschreibt.
  useEffect(() => {
    setFelder(felderAus(k, k.vorlage ?? startVorlage, personen, k.firma ?? 'stimo'));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- neu nur mit Stand und Personen
  }, [k.id, k.zustand, leute.data]);
  useEffect(() => {
    setMailText(k.angebot_text ?? [
      `${anrede(k.personen ?? [])}`,
      `Im Anhang erhalten Sie unser Kaufangebot für ${k.adresse} in ${k.gemeinde ?? ''}.`.replace(/ in \.$/, '.'),
      'Für Fragen stehen wir Ihnen gerne zur Verfügung.',
      `Freundliche Grüsse\n${name}`,
    ].join('\n\n'));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- der Text gehört danach dem, der verschickt
  }, [k.id, k.zustand]);

  const ort = [k.plz, k.gemeinde].filter(Boolean).join(' ');
  const u = uhr(k, jetzt);
  // Gelernt wird auch aus den Bemerkungen zum Preis (20. November), nicht nur aus Davids Prüfung.
  const bem = useQuery({ queryKey: ['bemerkungen-alle'], queryFn: () => bemerkungenLaden(), staleTime: 60 * 1000, retry: 0 });
  const g = useMemo(() => lernen(alleRueckmeldungen(alle.data ?? [], bem.data ?? [], k.id), k.kanton, k.gemeinde), [alle.data, bem.data, k.id, k.kanton, k.gemeinde]);
  const lernPreis = vorschlag(k.empfehlung_chf, g);
  const preisJetzt = betragLesen(preis) ?? k.preis_chf ?? k.empfehlung_chf ?? 0;
  const ktx = kontextAus(k, firma, felder, preisJetzt);
  const fehlt = luecken({ ...ktx, felder, firma, vorlage });
  const bearbeitbar = k.zustand === 'pruefung';
  const daten = (): SchrittDaten => ({ firma, vorlage, schrift, angebot: felder });

  const amZug = AM_ZUG[k.zustand];
  const zugLeute = amZug ? personen.filter(p => p.rollen.includes(amZug)) : [];
  const ph = phase({ ...k, von: k.eingaben?.name }, personen);
  // Wer entscheidet, aus «Wer was tut»; ohne Eintrag kein erfundener Name.
  const entscheider = zugLeute.map(p => p.name).join(' oder ') || null;
  const link = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?calc=${k.id}` : '';
  const n = nachricht({ zustand: k.zustand, adresse: k.adresse, ort, preis: k.preis_chf ?? k.empfehlung_chf, link, von: name, an: zugLeute });

  const tun = async (was: Schritt, mehr: { chf?: number | null; notiz?: string | null; text?: string | null; daten?: SchrittDaten | null } = {}) => {
    if (!name.trim()) { setFehler('Bitte deinen Namen angeben: er steht im Verlauf.'); return; }
    setLaeuft(true); setFehler(null);
    try {
      onGeaendert(await schritt(k.id, was, name.trim(), mehr));
      if (was !== 'speichern') setEben(true);
    } catch (x) { setFehler((x as Error).message); } finally { setLaeuft(false); }
  };

  const pdf = async (art: 'ansehen' | 'laden') => {
    // Ein neues Fenster gleich beim Tippen öffnen: Safari sperrt Fenster, die erst nach dem Warten aufgehen.
    const fenster = art === 'ansehen' ? window.open('', FENSTER.extern) : null;
    setPdfLaeuft(true); setFehler(null);
    try {
      const { angebotPdf, angebotDateiname } = await import('@/lib/angebot-pdf');
      bild.current ??= luftbild(k);
      const doc = await angebotPdf({
        firma: FIRMEN[firma], schrift, brief: brief(vorlage, ktx), preis: preisJetzt, felder,
        adressbloecke: adressbloecke(k.personen ?? []), anrede: anrede(k.personen ?? []),
        titel: k.adresse, untertitel: [k.plz, felder.ortsteil.trim() || k.gemeinde].filter(Boolean).join(' '),
        kat: [katNummern(k.parzellen ?? []).length ? `Kat.-Nr. ${katNummern(k.parzellen ?? []).join(' / ')}` : '', ort].filter(Boolean).join(' · '),
        luftbild: await bild.current, test: k.test,
      });
      const datei = angebotDateiname(k.adresse, felder.datum);
      if (art === 'laden') doc.save(datei);
      else {
        const url = URL.createObjectURL(doc.output('blob'));
        if (fenster) fenster.location.href = url; else window.open(url, FENSTER.extern);
        setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
      }
    } catch (x) {
      fenster?.close();
      const m = (x as Error).message ?? '';
      if (istFehlendeFassung(m) && neuLadenEinmal()) return;
      setFehler(`Das PDF liess sich nicht erstellen: ${m}`);
    } finally { setPdfLaeuft(false); }
  };

  const namensfeld = (
    <label className="block space-y-1.5">
      <span className={ETIKETT}>Dein Name</span>
      <input value={name} onChange={x => setName(x.target.value)} autoComplete="given-name" className={`${FELD} w-full text-base`} />
    </label>
  );
  const notizfeld = (titel: string) => (
    <label className="block space-y-1.5">
      <span className={ETIKETT}>{titel}</span>
      <textarea value={notiz} onChange={x => setNotiz(x.target.value)} rows={2} className={TEXTFELD} />
    </label>
  );
  const preisfeld = (titel: string) => (
    <label className="block space-y-1.5">
      <span className={ETIKETT}>{titel}</span>
      <span className="flex items-center gap-2">
        <input inputMode="numeric" value={preis} onChange={x => setPreis(x.target.value)} className={`${FELD} w-full text-base`} />
        <span className="shrink-0 text-sm text-muted-foreground">CHF</span>
      </span>
    </label>
  );
  const pdfKnoepfe = (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={KNOPF} disabled={pdfLaeuft} onClick={() => void pdf('ansehen')}>
        {pdfLaeuft ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Angebot ansehen
      </button>
      <button type="button" className={KNOPF} disabled={pdfLaeuft} onClick={() => void pdf('laden')}><Download className="h-4 w-4" /> Als PDF laden</button>
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="bericht-druck space-y-6">
        <Objektkopf adresse={k.eingaben.adresse} parzelleNr={k.eingaben.parzelleNr} flaeche={k.eingaben.eingabe.grundlage.flaeche} eigentuemer={k.eingaben.eigentuemer} gebaeude={k.eingaben.eingabe.grundlage.gebaeude}
          zone={zoneText(k)}
          rechts={<span className="flex flex-wrap items-center gap-2 print:hidden">
            {k.test && <Marke>Test</Marke>}
            {k.quelle === 'mail' && <Marke>per Mail</Marke>}
          </span>} />
        <p className="hidden text-sm print:block">Kalkulation vom {wann(k.erstellt_am)}{k.kontakt ? ` · ${k.kontakt}` : ''}</p>

        {u && (
          <div className="max-w-md print:hidden">
            <Strichbalken anteil={Math.min(1, u.anteil)} farbe={u.ueberfaellig ? 'heiss' : k.zustand === 'gesendet' ? 'gruen' : 'akzent'} />
            <p className={`mt-1 text-sm ${u.ueberfaellig ? 'font-medium text-heiss' : 'text-accent'}`}>{u.text}</p>
          </div>
        )}

        {/* Die drei Phasen mit Nummer (Julian, 22. November: «in welcher
            Phase ... wo ist sie aktuell?»); bei wem sie liegt, sagt der
            Titel der Seite. Verschickt: alle drei erledigt. */}
        <ol className="flex flex-wrap gap-x-1 gap-y-1 text-sm print:hidden" aria-label="Phasen der Kalkulation">
          {PHASEN.map((titel, i) => {
            const hier = ph.nr === i + 1, erledigt = k.zustand === 'gesendet' || (ph.nr != null && i + 1 < ph.nr);
            return (
              <li key={titel} className={`flex items-center gap-1 ${hier ? 'font-medium text-foreground' : erledigt ? 'text-foreground/70' : 'text-muted-foreground'}`} aria-current={hier ? 'step' : undefined}>
                {erledigt && <Check className="h-3.5 w-3.5" />}{i + 1} {titel}{i < PHASEN.length - 1 && <span className="px-1 text-muted-foreground">›</span>}
              </li>
            );
          })}
        </ol>

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded border bg-border sm:max-w-xl">
          <div className="bg-card p-4">
            <dt className={ETIKETT}>Empfehlung der Rechnung</dt>
            <dd className="mt-1 text-[22px] leading-tight tracking-tight">{k.empfehlung_chf != null ? betrag(k.empfehlung_chf) : '–'}</dd>
          </div>
          <div className="bg-card p-4">
            <dt className={ETIKETT}>{k.zustand === 'pruefung' || k.zustand === 'abgelehnt' ? 'Kaufpreis' : 'Kaufpreis im Angebot'}</dt>
            <dd className="mt-1 text-[22px] leading-tight tracking-tight text-violett">{k.preis_chf != null ? betrag(k.preis_chf) : 'noch offen'}</dd>
          </div>
        </dl>
        {k.preis_urteil && (
          <p className="max-w-2xl text-[15px]"><span className="font-medium">{URTEIL_TEXT[k.preis_urteil]}:</span> {k.preis_grund}</p>
        )}

        {/* Wer jetzt am Zug ist, und ein Knopf, ihm Bescheid zu geben. */}
        {n && (
          <div className={`space-y-2 rounded-[3px] border p-4 print:hidden ${eben ? 'border-accent' : ''}`}>
            <p className="text-[15px]">
              <span className="font-medium">{entscheider ? `${entscheider} Bescheid geben` : 'Noch niemand eingetragen, der entscheidet'}</span>
              {eben ? ' · jetzt' : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              <a className={eben ? KNOPF_HAUPT : KNOPF} href={n.mail}><Mail className="h-4 w-4" /> E-Mail</a>
              {n.whatsapp && <a className={KNOPF} href={n.whatsapp} target={FENSTER.extern}><MessageCircle className="h-4 w-4" /> WhatsApp</a>}
            </div>
            {!zugLeute.some(p => p.email) && <p className="text-sm text-muted-foreground">Wer welche Rolle hat, legt ein Admin im Reiter Admin bei «Wer was tut» fest; dann steht die Adresse schon in der Nachricht.</p>}
          </div>
        )}

        <div className="space-y-1.5 print:hidden">
          <Aufklapper titel={`Verlauf · ${k.verlauf.length} ${k.verlauf.length === 1 ? 'Schritt' : 'Schritte'}`} auf={verlaufAuf} setAuf={setVerlaufAuf} />
          {verlaufAuf && (
          <ol className="divide-y rounded-[3px] border bg-card">
            {k.verlauf.map((v, i) => (
              <li key={i} className="px-4 py-2.5 text-sm">
                <span className="font-medium">{v.name}</span> · {SCHRITT_TEXT[v.schritt] ?? v.schritt}{v.chf != null ? ` · ${betrag(v.chf)}` : ''}{v.urteil ? ` · ${URTEIL_TEXT[v.urteil]}` : ''}
                <span className="text-muted-foreground"> · {wann(v.am)}</span>
                {v.notiz && <span className="block text-muted-foreground">{v.notiz}</span>}
              </li>
            ))}
          </ol>
          )}
        </div>

        {/* Genau ein nächster Schritt. */}
        <div className="space-y-4 rounded-[3px] border bg-card p-4 print:hidden">
          {k.zustand === 'pruefung' && (
            <>
              <div>
                <p className={ETIKETT}>Teil 1 von 2</p>
                <p className="text-lg">Ist der Preis richtig?</p>
                <p className="text-sm text-muted-foreground">{entscheider ?? 'Wer entscheidet'} legt ihn fest: dieser Preis gilt und geht so ins Angebot. Urteil und Grund lernt Aurora, auch wo im Ort es liegt.</p>
              </div>
              {/* Was Aurora rechnet und was Menschen geschrieben haben, klar
                  getrennt (22. November, Julian: «ist das vom System oder von
                  Tim?»). Die Urteile zu anderen Adressen klappen auf. */}
              {g && (
                <div className="space-y-2 text-sm">
                  <p className="rounded-[3px] bg-secondary px-3 py-2.5">
                    {lernPreis != null
                      ? <>Vorschlag von Aurora: <span className="font-medium">{betrag(lernPreis)}</span><span className="block text-muted-foreground">Bei {g.n} geprüften Kalkulationen{g.gemeinde ? ` in ${g.gemeinde}` : g.kanton ? ` im Kanton ${g.kanton}` : ''} lag der richtige Preis im Mittel bei {Math.round(g.faktor * 100)} % der Empfehlung.</span></>
                      : <>Erst {g.n} {g.n === 1 ? 'geprüfte Kalkulation' : 'geprüfte Kalkulationen'}; ab {LERNEN_AB} rechnet Aurora einen Vorschlag.</>}
                  </p>
                  {g.gruende.length > 0 && (
                    <details className="group">
                      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-muted-foreground [&::-webkit-details-marker]:hidden">
                        So wurde bei anderen Adressen geurteilt ({g.gruende.length}) <span aria-hidden className="transition-transform group-open:rotate-90">›</span>
                      </summary>
                      <ul className="divide-y border-y">
                        {g.gruende.map((x, i) => (
                          <li key={i} className="py-2">
                            <p className="text-xs text-muted-foreground">{[x.wer, [x.adresse, x.gemeinde].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'Ohne Namen'} · {URTEIL_TEXT[x.urteil]}</p>
                            <p>«{x.grund}»</p>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Urteil über die Empfehlung">
                {(['zu_tief', 'passt', 'zu_hoch'] as const).map(x => (
                  <button key={x} type="button" role="radio" aria-checked={urteil === x} className={WAHL(urteil === x)}
                          onClick={() => { setUrteil(x); if (x === 'passt') setPreis(String(Math.round(k.empfehlung_chf ?? 0))); }}>{URTEIL_TEXT[x]}</button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {preisfeld('Kaufpreis im Angebot')}
                {namensfeld}
              </div>
              <label className="block space-y-1.5">
                <span className={ETIKETT}>Warum (mindestens ein Satz)</span>
                <textarea value={notiz} onChange={x => setNotiz(x.target.value)} rows={3} className={TEXTFELD}
                          placeholder={urteil === 'zu_tief' ? 'Warum, und wo im Ort? z. B. ruhige Hanglage mit Seesicht, Nachbar ist Anlagestiftung' : urteil === 'zu_hoch' ? 'Warum, und wo im Ort? z. B. an der Hauptstrasse, Altlasten, Baurecht' : 'Warum stimmt er? z. B. passt zu Verkäufen im Quartier'} />
              </label>
              <div className="border-t pt-4">
                <p className={ETIKETT}>Teil 2 von 2</p>
                <Aufklapper titel={`Angebot: ${FIRMEN[firma].name} · ${VORLAGEN[vorlage].titel}`} unter={fehlt.length ? `${fehlt.length} ${fehlt.length === 1 ? 'Angabe fehlt' : 'Angaben fehlen'}` : 'Firma und Vorlage'} auf={angebotAuf} setAuf={setAngebotAuf} gross />
              </div>
              {angebotAuf && (
              <AngebotBearbeiten k={k} firma={firma} setFirma={f => { setFirma(f); setFelder(x => ({ ...x, unterschriften: [], kontakt: null, ...unterschriftenFuer(personen, f) })); }}
                vorlage={vorlage} setVorlage={v => { setVorlage(v); setFelder(x => ({ ...felderVorgabe(v), datum: x.datum, ortsteil: x.ortsteil, kontakt: x.kontakt, unterschriften: x.unterschriften })); }}
                felder={felder} setFelder={setFelder} ktx={ktx} personen={personen} />
              )}
              {fehlt.length > 0 && <p className="text-sm text-destructive">{fehlt.join(' ')}</p>}
              {angebotAuf && pdfKnoepfe}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={KNOPF_HAUPT} disabled={laeuft || !urteil || notiz.trim().length < 10 || !betragLesen(preis) || fehlt.length > 0}
                        onClick={() => void tun('pruefen', { chf: betragLesen(preis), notiz, daten: { ...daten(), urteil: urteil! } })}>Preis festlegen, zum Versand</button>
                <button type="button" className={KNOPF} disabled={laeuft} onClick={() => void tun('speichern', { daten: daten() })}>Zwischenspeichern</button>
                <button type="button" className={KNOPF} disabled={laeuft || !notiz.trim()} onClick={() => void tun('ablehnen', { notiz })}>Ablehnen</button>
              </div>
            </>
          )}
          {/* Stände des Wegs bis zum 22. November (visieren, kontrollieren,
              bestätigen) kennt die Datenbank nur noch für «zurück» und
              «ablehnen»: dann entscheidet Tim auf dem neuen Weg. */}
          {(k.zustand === 'visum' || k.zustand === 'kontrolle' || k.zustand === 'bestaetigung') && (
            <>
              <div>
                <p className="font-medium">Noch auf dem alten Weg</p>
                <p className="text-sm text-muted-foreground">Seit dem 22. November legt {entscheider ?? 'wer entscheidet'} den Preis fest und verschickt selbst. Diese Kalkulation stand beim alten Schritt «{ZUSTAND_TEXT[k.zustand]}»: zurück in Phase 2, dann wird entschieden.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{namensfeld}</div>
              {notizfeld('Bei Ablehnung der Grund')}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={KNOPF_HAUPT} disabled={laeuft} onClick={() => void tun('zurueck', { notiz: notiz.trim() || 'Neuer Weg: Tim legt den Preis fest.' })}>Zur Prüfung</button>
                <button type="button" className={KNOPF} disabled={laeuft || !notiz.trim()} onClick={() => void tun('ablehnen', { notiz })}>Ablehnen</button>
              </div>
            </>
          )}
          {k.zustand === 'angebot' && (
            <>
              <div>
                <p className="font-medium">Angebot verschicken</p>
                <p className="text-sm text-muted-foreground">Der Preis steht. PDF laden, mit der Mail an {empfaenger(k.personen ?? []).map(p => [p.vorname, p.name].filter(Boolean).join(' ') || p.firma).join(', ') || 'die Eigentümerschaft'} schicken oder per Post, und den Versand hier eintragen: dann hält die Uhr an.</p>
              </div>
              {pdfKnoepfe}
              <label className="block space-y-1.5">
                <span className={ETIKETT}>Begleittext der Mail</span>
                <textarea value={mailText} onChange={x => setMailText(x.target.value)} rows={7} className={TEXTFELD} />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{namensfeld}</div>
              {notizfeld('Bemerkung, bei Rückgabe der Grund')}
              <div className="flex flex-wrap gap-2">
                <a className={KNOPF} href={`mailto:${empfaenger(k.personen ?? []).map(p => p.email).filter(Boolean).join(',')}?subject=${encodeURIComponent(`${VORLAGEN[k.vorlage ?? 'bauland'].art} ${k.adresse}`)}&body=${encodeURIComponent(mailText)}`}>
                  <Mail className="h-4 w-4" /> Mail öffnen
                </a>
                <button type="button" className={KNOPF_HAUPT} disabled={laeuft} onClick={() => void tun('senden', { text: mailText })}>Als verschickt eintragen</button>
                <button type="button" className={KNOPF} disabled={laeuft || !notiz.trim()} onClick={() => void tun('zurueck', { notiz })}>Zurück zur Prüfung</button>
              </div>
            </>
          )}
          {k.zustand === 'gesendet' && (
            <>
              <p className="font-medium">Verschickt</p>
              {pdfKnoepfe}
              {k.angebot_text && <p className="whitespace-pre-wrap text-sm leading-relaxed">{k.angebot_text}</p>}
            </>
          )}
          {k.zustand === 'abgelehnt' && (
            <>
              <p className="font-medium">Abgelehnt</p>
              <p className="text-sm text-muted-foreground">Der Grund steht im Verlauf. Wieder geöffnet wird die Kalkulation zum Entwurf: neu rechnen und noch einmal einreichen.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{namensfeld}</div>
              <button type="button" className={KNOPF} disabled={laeuft} onClick={() => void tun('oeffnen')}>Wieder öffnen</button>
            </>
          )}
          {fehler && <p className="text-sm text-destructive">{fehler}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Aufklapper titel="Die eingereichte Rechnung" unter="Flächen, Kosten, Erlös, Chancen und Risiken" auf={rechnungAuf} setAuf={setRechnungAuf} gross />
          <button type="button" className={KNOPF} onClick={() => drucken(`Kalkulation ${k.adresse}`)}><Printer className="h-4 w-4" /> Als PDF</button>
        </div>
        {/* Zugeklappt bleibt die Rechnung im Druck: das PDF ist vollständig. */}
        <div className={rechnungAuf ? '' : 'hidden print:block'}>
          <Ergebnis b={k.ergebnis} annahmen={k.eingaben.eingabe.annahmen} />
        </div>
      </section>
      <div className="print:hidden">
        <Aufklapper titel="Gespräch zum Preis" unter="Bemerkungen von allen, aus denen Aurora lernt" auf={gespraechAuf} setAuf={setGespraechAuf} gross />
        {gespraechAuf && <div className="pt-2"><Bemerkungen kalkulationId={k.id} empfehlung={k.empfehlung_chf} kanton={k.kanton} gemeinde={k.gemeinde} /></div>}
      </div>
    </div>
  );
}

function unterschriftenFuer(personen: AblaufPerson[], firma: FirmaId): Pick<AngebotFelder, 'unterschriften' | 'kontakt'> {
  const u = personen.filter(p => p.rollen.includes('unterschrift') && p.firma === firma).map<Unterschrift>(p => ({ name: p.name, titel: p.titel ?? '', telefon: p.telefon, email: p.email }));
  return { unterschriften: u, kontakt: u.find(x => x.telefon || x.email) ?? null };
}

/**
 * Was David beim Prüfen und Julian bei der Kontrolle am Brief ändern:
 * Firma, Vorlage, Schrift, die Felder, die je Angebot ändern, wer
 * unterschreibt, und auf Wunsch der Wortlaut selbst.
 */
function AngebotBearbeiten({ k, firma, setFirma, vorlage, setVorlage, felder, setFelder, ktx, personen }: {
  k: Kalkulation; firma: FirmaId; setFirma: (f: FirmaId) => void; vorlage: VorlageId; setVorlage: (v: VorlageId) => void;
  felder: AngebotFelder; setFelder: (f: AngebotFelder | ((f: AngebotFelder) => AngebotFelder)) => void;
  ktx: Kontext; personen: AblaufPerson[];
}) {
  const [weiter, setWeiter] = useState(false);
  const setze = (teil: Partial<AngebotFelder>) => setFelder(f => ({ ...f, ...teil }));
  // Der Wortlaut der Vorlage, ohne Eigenes: das steht im Feld, bis jemand es ändert.
  const vorlageText = brief(vorlage, { ...ktx, felder: { ...felder, einleitung: undefined, punkte: undefined, schluss: undefined } });
  const kandidaten = personen.filter(p => p.rollen.includes('unterschrift') && (!p.firma || p.firma === firma));
  const unterschreibt = (name: string) => felder.unterschriften.some(u => u.name === name);
  const an = empfaenger(k.personen ?? []);
  const textfeld = (titel: string, feld: 'einleitung' | 'punkte' | 'schluss', vorgabe: string, zeilen: number) => (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between gap-2">
        <span className={ETIKETT}>{titel}{felder[feld]?.trim() ? ' · eigener Wortlaut' : ''}</span>
        {felder[feld]?.trim() && <button type="button" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground" onClick={() => setze({ [feld]: undefined })}><RotateCcw className="h-3.5 w-3.5" /> Vorlage</button>}
      </span>
      <textarea value={felder[feld]?.trim() ? felder[feld] : vorgabe} rows={zeilen} className={TEXTFELD}
                onChange={e => setze({ [feld]: e.target.value === vorgabe ? undefined : e.target.value })} />
    </label>
  );

  return (
    <div className="space-y-5 border-t pt-4">
      <p className="text-[15px]">
        An: <span className="font-medium">{adressbloecke(k.personen ?? []).map(b => b.join(', ')).join(' · ')}</span>
        {!an.length && <span className="text-destructive"> (kein Empfänger: zurück an den Agenten)</span>}
        <span className="block text-muted-foreground">{anrede(k.personen ?? [])} · {(k.parzellen ?? []).length ? `Kat.-Nr. ${katNummern(k.parzellen ?? []).join(', ')}` : 'keine Kataster-Nummer'}</span>
      </p>

      <div className="space-y-1.5">
        <p className={ETIKETT}>Firma</p>
        <div className="flex flex-wrap gap-2">
          {[...FIRMEN_WAHL, ...(FIRMEN_WAHL.includes(k.firma ?? 'stimo') ? [] : [k.firma!])].map(f => <button key={f} type="button" aria-pressed={firma === f} className={WAHL(firma === f)} onClick={() => setFirma(f)}>{FIRMEN[f].name}</button>)}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className={ETIKETT}>Vorlage</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(VORLAGEN) as VorlageId[]).map(v => (
            <button key={v} type="button" aria-pressed={vorlage === v} className={`${WAHL(vorlage === v)} py-2`} onClick={() => setVorlage(v)}>
              <span className="block font-medium">{VORLAGEN[v].titel}</span>
              <span className={`block text-[13px] ${vorlage === v ? 'text-background/75' : 'text-muted-foreground'}`}>{VORLAGEN[v].wann}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Alles Weitere steht vorbelegt aus Vorlage und Firma (22. November,
          Julian: «dass man nur noch Firma wählen kann und was es ist»);
          ändern lässt es sich hinter «Weitere Angaben». */}
      <button type="button" aria-expanded={weiter} onClick={() => setWeiter(!weiter)}
              className="flex min-h-11 w-full items-center justify-between gap-3 border-t pt-3 text-left">
        <span>
          <span className="block text-[15px] font-medium">Weitere Angaben</span>
          <span className="block text-sm text-muted-foreground">Datum, Besitzantritt, Bindung, Anzahlung, Unterschrift, Wortlaut · Schrift {SCHRIFTEN[FIRMEN[firma].schrift].titel}</span>
        </span>
        <span aria-hidden className={`shrink-0 text-xl text-muted-foreground transition-transform ${weiter ? 'rotate-90' : ''}`}>›</span>
      </button>
      {weiter && <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className={ETIKETT}>Datum des Briefs</span>
          <input type="date" value={felder.datum} onChange={e => setze({ datum: e.target.value })} className={`${FELD} w-full text-base`} />
        </label>
        <label className="block space-y-1.5">
          <span className={ETIKETT}>Ortsteil auf dem Deckblatt</span>
          <input value={felder.ortsteil} placeholder={k.gemeinde ?? ''} onChange={e => setze({ ortsteil: e.target.value })} className={`${FELD} w-full text-base`} />
        </label>
        <label className="block space-y-1.5 sm:col-span-2">
          <span className={ETIKETT}>Anlass, mit dem der Brief beginnt</span>
          <input value={felder.anlass} onChange={e => setze({ anlass: e.target.value })} className={`${FELD} w-full text-base`} />
        </label>
        <label className="block space-y-1.5 sm:col-span-2">
          <span className={ETIKETT}>Was entstehen soll</span>
          <input value={felder.nutzung} onChange={e => setze({ nutzung: e.target.value })} className={`${FELD} w-full text-base`} />
        </label>
        <label className="block space-y-1.5">
          <span className={ETIKETT}>Besitzantritt spätestens</span>
          <input type="date" value={felder.besitzantritt} onChange={e => setze({ besitzantritt: e.target.value })} className={`${FELD} w-full text-base`} />
        </label>
        <label className="block space-y-1.5">
          <span className={ETIKETT}>Gebunden (Tage, 0 = ohne)</span>
          <input inputMode="numeric" value={String(felder.bindungTage)} onChange={e => setze({ bindungTage: Math.max(0, Math.min(365, Number(e.target.value.replace(/\D/g, '')) || 0)) })} className={`${FELD} w-full text-base`} />
        </label>
        <label className="block space-y-1.5">
          <span className={ETIKETT}>Anzahlung oder Reservation, CHF</span>
          <input inputMode="numeric" value={felder.anzahlung != null ? String(felder.anzahlung) : ''} placeholder="keine"
                 onChange={e => setze({ anzahlung: betragLesen(e.target.value) })} className={`${FELD} w-full text-base`} />
        </label>
      </div>
      <div className="flex flex-col gap-1">
        <label className="flex min-h-11 items-center gap-3 text-[15px]"><input type="checkbox" checked={felder.finanzierungBeilage} onChange={e => setze({ finanzierungBeilage: e.target.checked })} className="h-5 w-5 accent-foreground" /> Finanzierungsbestätigung der Bank liegt bei</label>
        <label className="flex min-h-11 items-center gap-3 text-[15px]"><input type="checkbox" checked={felder.ersatz} onChange={e => setze({ ersatz: e.target.checked })} className="h-5 w-5 accent-foreground" /> Ersatzliegenschaft anbieten</label>
      </div>

      <div className="space-y-1.5">
        <p className={ETIKETT}>Unterschrift</p>
        {kandidaten.length ? (
          <div className="flex flex-col gap-1">
            {kandidaten.map(p => (
              <label key={p.id} className="flex min-h-11 items-center gap-3 text-[15px]">
                <input type="checkbox" checked={unterschreibt(p.name)} className="h-5 w-5 accent-foreground"
                       onChange={e => setze({ unterschriften: e.target.checked
                         ? [...felder.unterschriften, { name: p.name, titel: p.titel ?? '', telefon: p.telefon, email: p.email }]
                         : felder.unterschriften.filter(u => u.name !== p.name) })} />
                {p.name}{p.titel ? <span className="text-muted-foreground"> · {p.titel}</span> : null}
              </label>
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">Für {FIRMEN[firma].name} ist niemand eingetragen. Ein Admin trägt im Reiter Admin bei «Wer was tut» ein, wer unterschreibt.</p>}
        {felder.unterschriften.length > 0 && (
          <label className="block space-y-1.5 pt-1">
            <span className={ETIKETT}>Oben rechts als Kontakt</span>
            <select value={felder.kontakt?.name ?? ''} className={`${FELD} w-full text-base sm:w-auto`}
                    onChange={e => setze({ kontakt: felder.unterschriften.find(u => u.name === e.target.value) ?? null })}>
              <option value="">nur die Firma</option>
              {felder.unterschriften.map(u => <option key={u.name} value={u.name}>{u.name}</option>)}
            </select>
          </label>
        )}
      </div>

      <details className="group space-y-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-[15px] font-medium">Wortlaut ändern</summary>
        <div className="space-y-3 pt-2">
          {textfeld('Einleitung', 'einleitung', vorlageText.einleitung.join('\n\n'), 6)}
          {textfeld(vorlageText.nummeriert ? 'Bedingungen (Titel: Text, ein Absatz je Punkt)' : 'Punkte (ein Absatz je Punkt)', 'punkte', punkteAlsText(vorlageText), 12)}
          {textfeld('Schluss', 'schluss', vorlageText.schluss.join('\n\n'), 3)}
        </div>
      </details>
      </>}
    </div>
  );
}

/** Eine Zeile, die einen Teil der Seite auf- und zuklappt, 44 px hoch. */
function Aufklapper({ titel, unter, auf, setAuf, gross }: { titel: string; unter?: string; auf: boolean; setAuf: (a: boolean) => void; gross?: boolean }) {
  return (
    <button type="button" aria-expanded={auf} onClick={() => setAuf(!auf)}
            className="flex min-h-11 w-full items-center justify-between gap-3 text-left">
      <span className="min-w-0">
        <span className={`block ${gross ? 'text-lg' : 'text-sm font-medium'}`}>{titel}</span>
        {unter && <span className="block text-sm text-muted-foreground">{unter}</span>}
      </span>
      <span aria-hidden className={`shrink-0 text-xl text-muted-foreground transition-transform ${auf ? 'rotate-90' : ''}`}>›</span>
    </button>
  );
}
