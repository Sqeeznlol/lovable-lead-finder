import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { adressVorschlaege, parzelleAmPunkt, type ParzellenAuskunft, type Vorschlag } from '@/lib/ortsabfrage';

/**
 * Die öffentlichen Seiten: Bewertung, Potenzialcheck, Investor.
 *
 * Tim, Step 2, "Landing Pages & Data Collection": Anfragen von aussen,
 * die als Daten zurückfliessen. Sie stehen ohne Anmeldung offen und
 * dürfen darum nur eines: eine Anfrage EINFÜGEN (Migration
 * 20261101240000_anfrage.sql). Lesen können sie nichts -- weder andere
 * Anfragen noch den Bestand. Was sie zeigen, kommt vom Bund.
 */
export type Art = 'bewertung' | 'potenzial' | 'investor';

const TEXT: Record<Art, { ueber: string; titel: string; satz: string; knopf: string }> = {
  bewertung: {
    ueber: 'Liegenschaft bewerten', titel: 'Was ist Ihre Liegenschaft wert?',
    satz: 'Ein paar Angaben genügen. Wir melden uns mit einer Einschätzung -- unverbindlich und kostenlos.',
    knopf: 'Bewertung anfragen',
  },
  potenzial: {
    ueber: 'Potenzialcheck', titel: 'Was lässt sich auf Ihrem Grundstück bauen?',
    satz: 'Adresse eingeben: Sie sehen sofort Parzelle, Fläche und Bauzone aus den amtlichen Daten. Die ausführliche Einschätzung schicken wir Ihnen.',
    knopf: 'Einschätzung anfordern',
  },
  investor: {
    ueber: 'Für Investoren', titel: 'Sie suchen Liegenschaften?',
    satz: 'Sagen Sie uns, was Sie suchen. Passt ein Objekt, melden wir uns -- oft bevor es auf dem Markt ist.',
    knopf: 'Suchprofil senden',
  },
};

const feld = 'h-12 w-full rounded-xl border border-input bg-white px-4 text-base text-foreground outline-none focus:border-primary';
const marke = 'mb-1.5 block text-sm font-medium text-muted-foreground';

function Adresse({ wert, setWert, onWahl }: { wert: string; setWert: (s: string) => void; onWahl: (v: Vorschlag) => void }) {
  const [liste, setListe] = useState<Vorschlag[]>([]);
  const [zu, setZu] = useState(false);
  useEffect(() => {
    if (zu) return;
    const t = setTimeout(() => { adressVorschlaege(wert).then(setListe).catch(() => setListe([])); }, 300);
    return () => clearTimeout(t);
  }, [wert, zu]);
  return (
    <div className="relative">
      <input className={feld} value={wert} autoComplete="street-address" placeholder="Strasse Nr., PLZ Ort"
             onChange={e => { setZu(false); setWert(e.target.value); }} />
      {liste.length > 0 && !zu && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-input bg-white">
          {liste.map(v => (
            <li key={v.label}>
              <button type="button" className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-background"
                      onClick={() => { setWert(v.label); setZu(true); setListe([]); onWahl(v); }}>{v.label}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Anfrage({ art }: { art: Art }) {
  const t = TEXT[art];
  const [f, setF] = useState({
    name: '', email: '', telefon: '', adresse: '', nachricht: '', website: '',
    objektart: '', baujahr: '', wohnflaeche: '', lagen: '', typen: '', budgetVon: '', budgetBis: '',
  });
  const [ort, setOrt] = useState<Vorschlag | null>(null);
  const [auskunft, setAuskunft] = useState<ParzellenAuskunft | null>(null);
  const [sucht, setSucht] = useState(false);
  const [ja, setJa] = useState(false);
  const [zustand, setZustand] = useState<'offen' | 'sendet' | 'fertig' | 'fehler'>('offen');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(v => ({ ...v, [k]: e.target.value }));

  useEffect(() => { document.title = `${t.ueber} · Bauraum`; }, [t.ueber]);
  // Dieselbe Schrift wie die Karte, einmal geladen.
  useEffect(() => {
    if (document.getElementById('gisk-fonts')) return;
    const l = document.createElement('link');
    l.id = 'gisk-fonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    document.head.appendChild(l);
  }, []);

  const ortWaehlen = async (v: Vorschlag) => {
    setOrt(v);
    if (art !== 'potenzial') return;
    setSucht(true); setAuskunft(null);
    try { setAuskunft(await parzelleAmPunkt(v.e, v.n)); } catch { setAuskunft(null); } finally { setSucht(false); }
  };

  const senden = async (e: React.FormEvent) => {
    e.preventDefault();
    // Ein Feld, das Menschen nicht sehen: füllt es jemand, ist es ein Programm.
    if (f.website) { setZustand('fertig'); return; }
    setZustand('sendet');
    const angaben: Record<string, unknown> =
      art === 'bewertung' ? { objektart: f.objektart || null, baujahr: f.baujahr || null, wohnflaeche: f.wohnflaeche || null }
      : art === 'potenzial' ? { parzelle: auskunft?.nummer ?? null, flaeche: auskunft?.flaeche ?? null, zone: auskunft?.zone ?? null, gemeinde: auskunft?.gemeinde ?? null }
      : { lagen: f.lagen || null, objekttypen: f.typen || null, budget_von: f.budgetVon || null, budget_bis: f.budgetBis || null };
    if (ort) angaben.lv95 = [Math.round(ort.e), Math.round(ort.n)];
    // Ohne Rückgabe der Zeile: der öffentliche Schlüssel darf einfügen, nicht lesen.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('anfrage').insert({
      art, name: f.name.trim(), email: f.email.trim() || null, telefon: f.telefon.trim() || null,
      adresse: f.adresse.trim() || null, egrid: auskunft?.egrid ?? null, nachricht: f.nachricht.trim() || null,
      angaben, einwilligung: ja,
    });
    setZustand(error ? 'fehler' : 'fertig');
  };

  const erreichbar = !!(f.email.trim() || f.telefon.trim());
  const bereit = f.name.trim().length >= 2 && erreichbar && ja && (art === 'investor' || f.adresse.trim().length > 3);

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:py-16" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif" }}>
      <div className="mx-auto max-w-lg">
        <p className="text-sm font-semibold text-muted-foreground">{t.ueber}</p>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl" style={{ fontFamily: 'inherit' }}>{t.titel}</h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">{t.satz}</p>

        {zustand === 'fertig' ? (
          <div className="mt-10 rounded-2xl border border-input bg-white p-6">
            <p className="text-lg font-semibold">Danke, Ihre Anfrage ist bei uns.</p>
            <p className="mt-2 text-muted-foreground">Wir melden uns bei Ihnen.</p>
          </div>
        ) : (
          <form onSubmit={senden} className="mt-10 space-y-5 rounded-2xl border border-input bg-white p-6">
            {art !== 'investor' && (
              <div>
                <label className={marke}>Adresse der Liegenschaft</label>
                <Adresse wert={f.adresse} setWert={v => setF(x => ({ ...x, adresse: v }))} onWahl={v => void ortWaehlen(v)} />
              </div>
            )}

            {art === 'potenzial' && (sucht || auskunft) && (
              <div className="rounded-xl bg-background p-4" aria-live="polite">
                {sucht && <p className="text-sm text-muted-foreground">Amtliche Daten werden abgefragt …</p>}
                {auskunft && (
                  <dl className="grid grid-cols-3 gap-3 text-center">
                    <div><dt className="text-xs text-muted-foreground">Parzelle</dt><dd className="mt-1 font-semibold">{auskunft.nummer ?? '–'}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Fläche</dt><dd className="mt-1 font-semibold">{auskunft.flaeche ? `${auskunft.flaeche.toLocaleString('de-CH')} m²` : '–'}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Bauzone</dt><dd className="mt-1 font-semibold">{auskunft.zone ?? 'keine'}</dd></div>
                  </dl>
                )}
                {auskunft && <p className="mt-3 text-xs text-muted-foreground">Quelle: amtliche Vermessung und Bauzonen Schweiz (geo.admin.ch). Fläche aus dem Umriss gerechnet.</p>}
              </div>
            )}

            {art === 'bewertung' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div><label className={marke}>Objektart</label>
                  <select className={feld} value={f.objektart} onChange={set('objektart')}>
                    <option value="">Bitte wählen</option>
                    {['Einfamilienhaus', 'Mehrfamilienhaus', 'Eigentumswohnung', 'Bauland', 'Gewerbe'].map(o => <option key={o}>{o}</option>)}
                  </select></div>
                <div><label className={marke}>Baujahr</label><input className={feld} inputMode="numeric" value={f.baujahr} onChange={set('baujahr')} placeholder="1985" /></div>
                <div><label className={marke}>Wohnfläche m²</label><input className={feld} inputMode="numeric" value={f.wohnflaeche} onChange={set('wohnflaeche')} placeholder="140" /></div>
              </div>
            )}

            {art === 'investor' && (
              <>
                <div><label className={marke}>Lagen</label><input className={feld} value={f.lagen} onChange={set('lagen')} placeholder="z. B. Zürich, Winterthur, Zug" /></div>
                <div><label className={marke}>Objekttypen</label><input className={feld} value={f.typen} onChange={set('typen')} placeholder="z. B. Mehrfamilienhaus, Bauland" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={marke}>Budget ab (CHF)</label><input className={feld} inputMode="numeric" value={f.budgetVon} onChange={set('budgetVon')} placeholder="2 Mio." /></div>
                  <div><label className={marke}>Budget bis (CHF)</label><input className={feld} inputMode="numeric" value={f.budgetBis} onChange={set('budgetBis')} placeholder="10 Mio." /></div>
                </div>
              </>
            )}

            <div><label className={marke}>{art === 'investor' ? 'Name oder Firma' : 'Name'}</label>
              <input className={feld} value={f.name} onChange={set('name')} autoComplete="name" required /></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className={marke}>E-Mail</label><input className={feld} type="email" value={f.email} onChange={set('email')} autoComplete="email" /></div>
              <div><label className={marke}>Telefon</label><input className={feld} type="tel" value={f.telefon} onChange={set('telefon')} autoComplete="tel" /></div>
            </div>
            <div><label className={marke}>Nachricht (freiwillig)</label>
              <textarea className="w-full rounded-xl border border-input bg-white px-4 py-3 text-base text-foreground outline-none focus:border-primary" rows={3} value={f.nachricht} onChange={set('nachricht')} /></div>

            {/* Für Programme sichtbar, für Menschen nicht. */}
            <input type="text" name="website" value={f.website} onChange={set('website')} tabIndex={-1} autoComplete="off"
                   aria-hidden="true" className="absolute left-[-10000px] h-px w-px opacity-0" />

            <label className="flex items-start gap-3 text-sm text-muted-foreground">
              <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={ja} onChange={e => setJa(e.target.checked)} />
              <span>Ich bin einverstanden, dass meine Angaben gespeichert und zur Bearbeitung dieser Anfrage verwendet werden. Sie werden nicht weitergegeben.</span>
            </label>

            {!erreichbar && (f.name || f.adresse) && <p className="text-sm text-muted-foreground">Bitte E-Mail oder Telefon angeben, damit wir Sie erreichen.</p>}
            {zustand === 'fehler' && <p className="text-sm text-red-600">Das hat nicht geklappt. Bitte versuchen Sie es noch einmal.</p>}
            <button type="submit" disabled={!bereit || zustand === 'sendet'}
                    className="h-12 w-full rounded-full bg-primary text-[17px] text-primary-foreground transition-transform active:scale-95 disabled:opacity-40">
              {zustand === 'sendet' ? 'Wird gesendet …' : t.knopf}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
