import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { FELD, KNOPF, KNOPF_HAUPT, Leer, LISTE } from '@/components/rahmen';
import { luftbildWgs } from '@/lib/luftbild';
import { FENSTER } from '@/lib/fenster';
import { geoAdminLink, STAND, ZONE_KURZ, type FavoritAngaben, type WunschFavorit } from '@/lib/parzellen-nach-wunsch';

/**
 * Die Favoriten von «Parzellen nach Wunsch»: je Parzelle ein Blatt, auf dem
 * man einträgt, wer Eigentümer ist, wie man ihn erreicht und wie es steht.
 * Eine Frage nach der anderen, gespeichert wird mit einem Tipp.
 */
const ch = (n: number) => n.toLocaleString('de-CH');
const ETIKETT = 'text-[11px] uppercase tracking-wide text-muted-foreground';
const leer = (s: string) => (s.trim() ? s.trim() : null);

export function WunschFavoriten({ liste, laedt, speichern, entfernen }: {
  liste: WunschFavorit[]; laedt: boolean;
  speichern: (egrid: string, a: FavoritAngaben) => Promise<void>;
  entfernen: (egrid: string) => Promise<void>;
}) {
  if (laedt) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> wird geladen …</p>;
  if (!liste.length) return <Leer titel="Noch keine Favoriten.">In der Liste bei einer Parzelle «Ausfindig machen» tippen: dann steht sie hier, mit Feldern für Eigentümer und Kontakt.</Leer>;
  return <ul className={LISTE}>{liste.map(f => <Blatt key={f.egrid} f={f} speichern={speichern} entfernen={entfernen} />)}</ul>;
}

function Blatt({ f, speichern, entfernen }: { f: WunschFavorit; speichern: (egrid: string, a: FavoritAngaben) => Promise<void>; entfernen: (egrid: string) => Promise<void> }) {
  const [a, setA] = useState({ eigentuemer: f.eigentuemer ?? '', adresse: f.adresse ?? '', telefon: f.telefon ?? '', email: f.email ?? '', notiz: f.notiz ?? '' });
  const [stand, setStand] = useState(f.stand);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  // Ein anderer hat gespeichert: das Blatt zeigt den neuen Stand.
  useEffect(() => {
    setA({ eigentuemer: f.eigentuemer ?? '', adresse: f.adresse ?? '', telefon: f.telefon ?? '', email: f.email ?? '', notiz: f.notiz ?? '' });
    setStand(f.stand);
  }, [f.geaendert_am]); // eslint-disable-line react-hooks/exhaustive-deps -- nur bei neuem Stand aus der Datenbank
  const geaendert = stand !== f.stand || (Object.keys(a) as (keyof typeof a)[]).some(k => (leer(a[k]) ?? null) !== (f[k] ?? null));

  const sichern = async () => {
    setLaeuft(true); setMeldung(null);
    try {
      await speichern(f.egrid, { stand, eigentuemer: leer(a.eigentuemer), adresse: leer(a.adresse), telefon: leer(a.telefon), email: leer(a.email), notiz: leer(a.notiz) });
      setMeldung('Gespeichert.');
    } catch (e) { setMeldung(e instanceof Error ? e.message : 'Nicht gespeichert. Bitte noch einmal.'); } finally { setLaeuft(false); }
  };
  const feld = (k: keyof typeof a, titel: string, art: 'text' | 'tel' | 'email' = 'text') => (
    <label className="block space-y-1.5">
      <span className={ETIKETT}>{titel}</span>
      <input type={art} value={a[k]} onChange={e => setA({ ...a, [k]: e.target.value })} className={`${FELD} w-full text-base`} />
    </label>
  );

  return (
    <li className="space-y-4 p-3 sm:p-4">
      <div className="flex items-center gap-4">
        <img src={luftbildWgs(f.lat, f.lon, Math.max(120, Math.sqrt(f.flaeche) * 2.2), 320)} alt="" loading="lazy"
             className="h-14 w-24 shrink-0 rounded-[3px] bg-secondary object-cover sm:h-[72px] sm:w-32" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Parzelle {f.nummer} · {f.gemeinde}</span>
          <span className="block text-sm text-muted-foreground">{ch(f.flaeche)}{' '}m² · {ZONE_KURZ[f.zone] ?? f.zone}</span>
          <span className="block truncate text-xs text-muted-foreground">{f.egrid}{f.von ? ` · von ${f.von}` : ''}</span>
        </span>
        <a className="inline-flex h-11 shrink-0 items-center text-sm underline underline-offset-2" target={FENSTER.karte} href={geoAdminLink(f)}>Karte</a>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Stand">
        {STAND.map(([w, t]) => (
          <button key={w} type="button" role="radio" aria-checked={stand === w} onClick={() => setStand(w)}
                  className={`min-h-11 rounded-[3px] border px-3 text-sm transition-colors ${stand === w ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-secondary'}`}>{t}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {feld('eigentuemer', 'Eigentümer')}
        {feld('adresse', 'Adresse des Eigentümers')}
        {feld('telefon', 'Telefon', 'tel')}
        {feld('email', 'E-Mail', 'email')}
      </div>
      <label className="block space-y-1.5">
        <span className={ETIKETT}>Notiz</span>
        <textarea value={a.notiz} onChange={e => setA({ ...a, notiz: e.target.value })} rows={2}
                  className="w-full rounded-[3px] border border-input bg-card px-3.5 py-2.5 text-base leading-relaxed focus:border-foreground focus:outline-none" />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={KNOPF_HAUPT} disabled={!geaendert || laeuft} onClick={() => void sichern()}>
          {laeuft && <Loader2 className="h-4 w-4 animate-spin" />} Speichern
        </button>
        <button type="button" className={KNOPF} disabled={laeuft}
                onClick={() => { if (window.confirm('Zurück in die Liste? Die Angaben gehen verloren.')) void entfernen(f.egrid); }}>Zurück in die Liste</button>
        {meldung && <span className="text-sm text-muted-foreground">{meldung}</span>}
      </div>
    </li>
  );
}
