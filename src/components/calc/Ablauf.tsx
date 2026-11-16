import { useEffect, useState } from 'react';
import { Check, Copy, Mail, Printer } from 'lucide-react';
import { FELD, KNOPF, KNOPF_HAUPT, Marke, Strichbalken } from '@/components/rahmen';
import { Ergebnis, Objektkopf } from '@/components/calc/Ergebnis';
import { useJetzt, useName } from '@/components/calc/name';
import { angebotEntwurf, betrag, schritt, SCHRITT_TEXT, uhr, ZUSTAND_TEXT, type Kalkulation, type Schritt } from '@/lib/calc-ablauf';
import { drucken } from '@/lib/drucken';

/**
 * Der Weg einer eingereichten Kalkulation: Kaufpreis prüfen, freigeben,
 * Angebot schreiben, senden -- in 24 Stunden. Oben läuft die Uhr, darunter
 * steht genau ein nächster Schritt; wer ihn getan hat, steht im Verlauf.
 *
 * Reihenfolge und Zeit erzwingt die Datenbank (kalkulation_schritt). Hier
 * wird nur gezeigt, was als Nächstes möglich ist.
 */
const ETIKETT = 'text-[11px] uppercase tracking-wide text-muted-foreground';
const wann = (iso: string) => new Date(iso).toLocaleString('de-CH', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export function Ablauf({ k, onGeaendert }: { k: Kalkulation; onGeaendert: (k: Kalkulation) => void }) {
  const [name, setName] = useName();
  const jetzt = useJetzt();
  const [preis, setPreis] = useState('');
  const [notiz, setNotiz] = useState('');
  const [text, setText] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);
  const e = k.eingaben;
  const ort = [k.plz, k.gemeinde].filter(Boolean).join(' ');
  const zone = e.eingabe.grundlage.zone;
  const u = uhr(k, jetzt);

  // Mit jedem Stand das Formular des nächsten Schritts frisch vorbelegen.
  useEffect(() => {
    setPreis(String(Math.round(k.preis_chf ?? k.empfehlung_chf ?? 0) || ''));
    setNotiz(''); setFehler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Wechsel des Stands, nicht bei jedem Tastendruck im Namen
  }, [k.id, k.zustand]);
  useEffect(() => {
    if (k.zustand !== 'angebot' && k.zustand !== 'gesendet') return;
    setText(k.angebot_text ?? angebotEntwurf({ kontakt: k.kontakt, adresse: k.adresse, ort, preis: k.preis_chf ?? 0, absender: name }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- der Entwurf entsteht einmal; danach gehört der Text dem, der schreibt
  }, [k.id, k.zustand, k.angebot_text]);

  const tun = async (was: Schritt, mehr: { chf?: number | null; notiz?: string | null; text?: string | null } = {}) => {
    if (!name.trim()) { setFehler('Bitte deinen Namen angeben: er steht im Verlauf.'); return; }
    setLaeuft(true); setFehler(null);
    try { onGeaendert(await schritt(k.id, was, name.trim(), mehr)); } catch (x) { setFehler((x as Error).message); } finally { setLaeuft(false); }
  };
  const betragLesen = (): number | null => {
    const n = Number(preis.replace(/['’\s]/g, '').replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };
  const kopieren = async () => {
    try { await navigator.clipboard.writeText(text); setKopiert(true); setTimeout(() => setKopiert(false), 2000); } catch { setFehler('Kopieren hat nicht geklappt: den Text von Hand markieren.'); }
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
      <textarea value={notiz} onChange={x => setNotiz(x.target.value)} rows={2} className="w-full rounded-[3px] border border-input bg-card px-3.5 py-2.5 text-base focus:border-foreground focus:outline-none" />
    </label>
  );

  return (
    <div className="space-y-6">
      <section className="bericht-druck space-y-6">
        <Objektkopf adresse={e.adresse} parzelleNr={e.parzelleNr} flaeche={e.eingabe.grundlage.flaeche} eigentuemer={e.eigentuemer} gebaeude={e.eingabe.grundlage.gebaeude}
          zone={zone ? [zone.bezeichnung, zone.abkuerzung && `(${zone.abkuerzung})`].filter(Boolean).join(' ') : null}
          rechts={<span className="flex flex-wrap items-center gap-2 print:hidden">
            {k.test && <Marke>Test</Marke>}
            <Marke art={k.zustand === 'gesendet' ? 'minze' : k.zustand === 'abgelehnt' ? 'rosa' : 'lila'}>{ZUSTAND_TEXT[k.zustand]}</Marke>
          </span>} />
        <p className="hidden text-sm print:block">Kalkulation vom {wann(k.erstellt_am)}{k.kontakt ? ` · ${k.kontakt}` : ''}</p>

        {/* Die Uhr: ein Tag vom Einreichen bis zum Versand. */}
        {u && (
          <div className="max-w-md print:hidden">
            <Strichbalken anteil={Math.min(1, u.anteil)} farbe={u.ueberfaellig ? 'heiss' : k.zustand === 'gesendet' ? 'gruen' : 'akzent'} />
            <p className={`mt-1 text-sm ${u.ueberfaellig ? 'font-medium text-heiss' : 'text-accent'}`}>{u.text}</p>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded border bg-border sm:max-w-xl">
          <div className="bg-card p-4">
            <dt className={ETIKETT}>Empfehlung der Rechnung</dt>
            <dd className="mt-1 text-[22px] leading-tight tracking-tight">{k.empfehlung_chf != null ? betrag(k.empfehlung_chf) : '–'}</dd>
          </div>
          <div className="bg-card p-4">
            <dt className={ETIKETT}>{k.zustand === 'pruefung' || k.zustand === 'abgelehnt' ? 'Kaufpreis' : k.zustand === 'freigabe' ? 'Geprüfter Kaufpreis' : 'Freigegebener Kaufpreis'}</dt>
            <dd className="mt-1 text-[22px] leading-tight tracking-tight text-violett">{k.preis_chf != null ? betrag(k.preis_chf) : 'noch offen'}</dd>
          </div>
        </dl>

        <div className="space-y-1.5">
          <p className={ETIKETT}>Verlauf</p>
          <ol className="divide-y rounded-[3px] border bg-card">
            {k.verlauf.map((v, i) => (
              <li key={i} className="px-4 py-2.5 text-sm">
                <span className="font-medium">{v.name}</span> · {SCHRITT_TEXT[v.schritt] ?? v.schritt}{v.chf != null ? ` · ${betrag(v.chf)}` : ''}
                <span className="text-muted-foreground"> · {wann(v.am)}</span>
                {v.notiz && <span className="block text-muted-foreground">{v.notiz}</span>}
              </li>
            ))}
          </ol>
        </div>

        {/* Genau ein nächster Schritt. */}
        <div className="space-y-3 rounded-[3px] border bg-card p-4 print:hidden">
          {k.zustand === 'pruefung' && (
            <>
              <p className="font-medium">Kaufpreis bestätigen oder ändern</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className={ETIKETT}>Kaufpreis</span>
                  <span className="flex items-center gap-2">
                    <input inputMode="numeric" value={preis} onChange={x => setPreis(x.target.value)} className={`${FELD} w-full text-base`} />
                    <span className="shrink-0 text-sm text-muted-foreground">CHF</span>
                  </span>
                </label>
                {namensfeld}
              </div>
              {notizfeld('Bemerkung, bei einer Ablehnung der Grund')}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={KNOPF_HAUPT} disabled={laeuft || !betragLesen()} onClick={() => void tun('pruefen', { chf: betragLesen(), notiz })}>
                  {betragLesen() === Math.round(k.empfehlung_chf ?? 0) ? 'Kaufpreis bestätigen' : 'Geänderten Kaufpreis weitergeben'}
                </button>
                <button type="button" className={KNOPF} disabled={laeuft || !notiz.trim()} onClick={() => void tun('ablehnen', { notiz })}>Ablehnen</button>
              </div>
            </>
          )}
          {k.zustand === 'freigabe' && (
            <>
              <p className="font-medium">Final freigeben</p>
              <p className="text-sm text-muted-foreground">Geprüft ist ein Kaufpreis von {betrag(k.preis_chf ?? 0)}. Mit der Freigabe geht die Kalkulation an den, der das Angebot schreibt.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{namensfeld}</div>
              {notizfeld('Bemerkung, bei Rückgabe oder Ablehnung der Grund')}
              <div className="flex flex-wrap gap-2">
                <button type="button" className={KNOPF_HAUPT} disabled={laeuft} onClick={() => void tun('freigeben', { notiz })}>Freigeben</button>
                <button type="button" className={KNOPF} disabled={laeuft || !notiz.trim()} onClick={() => void tun('zurueck', { notiz })}>Zurück zur Prüfung</button>
                <button type="button" className={KNOPF} disabled={laeuft || !notiz.trim()} onClick={() => void tun('ablehnen', { notiz })}>Ablehnen</button>
              </div>
            </>
          )}
          {k.zustand === 'angebot' && (
            <>
              <p className="font-medium">Angebot formulieren und senden</p>
              <p className="text-sm text-muted-foreground">Der Entwurf nennt Adresse, Betrag und Frist. Formuliere ihn fertig, schick ihn ab und trag den Versand hier ein: dann hält die Uhr an.</p>
              <textarea value={text} onChange={x => setText(x.target.value)} rows={14} aria-label="Angebot"
                        className="w-full rounded-[3px] border border-input bg-card px-3.5 py-3 text-base leading-relaxed focus:border-foreground focus:outline-none" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{namensfeld}</div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={KNOPF} onClick={() => void kopieren()}>{kopiert ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {kopiert ? 'Kopiert' : 'Kopieren'}</button>
                <a className={KNOPF} href={`mailto:?subject=${encodeURIComponent(`Angebot ${k.adresse}`)}&body=${encodeURIComponent(text)}`}><Mail className="h-4 w-4" /> In E-Mail öffnen</a>
                <button type="button" className={KNOPF} disabled={laeuft || text === (k.angebot_text ?? '')} onClick={() => void tun('angebot', { text })}>Speichern</button>
                <button type="button" className={KNOPF_HAUPT} disabled={laeuft || !text.trim()} onClick={() => void tun('senden', { text })}>Als gesendet eintragen</button>
              </div>
            </>
          )}
          {k.zustand === 'gesendet' && (
            <>
              <p className="font-medium">Gesendetes Angebot</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{k.angebot_text}</p>
              <button type="button" className={KNOPF} onClick={() => void kopieren()}>{kopiert ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {kopiert ? 'Kopiert' : 'Kopieren'}</button>
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
          <h3 className="text-lg">Die eingereichte Rechnung</h3>
          <button type="button" className={KNOPF} onClick={() => drucken(`Kalkulation ${k.adresse}`)}><Printer className="h-4 w-4" /> Als PDF</button>
        </div>
        <Ergebnis b={k.ergebnis} annahmen={e.eingabe.annahmen} />
      </section>
    </div>
  );
}
