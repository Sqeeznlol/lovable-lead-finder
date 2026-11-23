import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Users, X } from 'lucide-react';
import { Abschnitt, FELD, KNOPF, KNOPF_HAUPT, Leer, LISTE } from '@/components/rahmen';
import { useAuth } from '@/hooks/use-auth';
import { FIRMEN, type AblaufPerson, type AblaufRolle, type FirmaId } from '@/lib/angebot';
import { ablaufPersonenLaden, ablaufPersonLoeschen, ablaufPersonSpeichern } from '@/lib/calc-ablauf';

/**
 * Wer im Angebot was tut (angebot_person): David prüft und versendet,
 * Tim visiert und bestätigt, Julian kontrolliert, und wer für welche
 * Firma unterschreibt. Namen, Telefon und E-Mail stehen nur in der
 * Datenbank. Ein hinterlegtes Konto macht die Rolle verbindlich: dann
 * tut nur dieses Konto den Schritt. Ändern darf nur ein Admin; das
 * prüft die Datenbank, nicht diese Seite.
 */
// Seit dem 22. November entscheidet und verschickt Tim (Rolle «visum»);
// die Rollen des alten Wegs bleiben in der Datenbank, wählbar sind sie nicht mehr.
const ROLLEN: { id: AblaufRolle; titel: string }[] = [
  { id: 'visum', titel: 'Entscheidet und verschickt' }, { id: 'unterschrift', titel: 'Unterschrift' },
];
const ETIKETT = 'text-[11px] uppercase tracking-wide text-muted-foreground';
const WAHL = (an: boolean) => `min-h-11 rounded-[3px] border px-3 text-sm transition-colors ${an ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-secondary'}`;
type Entwurf = Omit<AblaufPerson, 'id'> & { id?: string | null };
const LEER: Entwurf = { name: '', titel: '', email: '', telefon: '', firma: null, rollen: [], user_id: null, reihe: 0 };

export function AblaufPersonen() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const liste = useQuery({ queryKey: ['angebot-personen'], queryFn: ablaufPersonenLaden, staleTime: 5 * 60 * 1000, retry: 0 });
  const [offen, setOffen] = useState<Entwurf | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const speichern = async () => {
    if (!offen) return;
    setLaeuft(true); setFehler(null);
    try {
      await ablaufPersonSpeichern({ ...offen, titel: offen.titel?.trim() || null, email: offen.email?.trim() || null, telefon: offen.telefon?.trim() || null });
      setOffen(null);
      void qc.invalidateQueries({ queryKey: ['angebot-personen'] });
    } catch (x) { setFehler((x as Error).message); } finally { setLaeuft(false); }
  };
  const loeschen = async (id: string) => {
    setLaeuft(true);
    try { await ablaufPersonLoeschen(id); setOffen(null); void qc.invalidateQueries({ queryKey: ['angebot-personen'] }); }
    catch (x) { setFehler((x as Error).message); } finally { setLaeuft(false); }
  };

  return (
    <Abschnitt titel="Wer was tut" symbol={Users} unter="Prüfen, visieren, kontrollieren, versenden, unterschreiben"
      rechts={isAdmin && !offen ? <button type="button" className={KNOPF} onClick={() => setOffen({ ...LEER })}><Plus className="h-4 w-4" /> Person</button> : undefined}>
      {liste.isLoading ? <Leer titel="Lädt …" />
        : liste.error ? <Leer titel="Die Rollen liessen sich nicht laden.">Ist die Migration vom 19. November eingespielt?</Leer>
        : !liste.data?.length && !offen ? <Leer titel="Noch niemand eingetragen.">{isAdmin ? 'Mit «Person» eintragen, wer den Preis festlegt und verschickt und für welche Firma unterschreibt.' : 'Das trägt ein Admin ein.'}</Leer>
        : (
          <ul className={LISTE}>
            {(liste.data ?? []).map(p => (
              <li key={p.id}>
                <button type="button" disabled={!isAdmin} onClick={() => setOffen({ ...p })} className="flex w-full flex-col gap-0.5 p-4 text-left enabled:hover:bg-secondary/60">
                  <span className="text-[15px] font-medium">{p.name}{p.titel ? <span className="font-normal text-muted-foreground"> · {p.titel}</span> : null}</span>
                  <span className="text-sm text-muted-foreground">
                    {[ROLLEN.filter(r => p.rollen.includes(r.id)).map(r => r.titel).join(', '), p.firma ? FIRMEN[p.firma].name : null, p.user_id ? 'mit Konto' : null].filter(Boolean).join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

      {offen && (
        <div className="mt-4 space-y-4 rounded-[3px] border bg-card p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {([['name', 'Name'], ['titel', 'Titel, z. B. CEO'], ['email', 'E-Mail'], ['telefon', 'Mobil']] as const).map(([f, t]) => (
              <label key={f} className="block space-y-1.5">
                <span className={ETIKETT}>{t}</span>
                <input value={offen[f] ?? ''} type={f === 'email' ? 'email' : f === 'telefon' ? 'tel' : 'text'} onChange={e => setOffen({ ...offen, [f]: e.target.value })} className={`${FELD} w-full text-base`} />
              </label>
            ))}
          </div>
          <div className="space-y-1.5">
            <p className={ETIKETT}>Rollen</p>
            <div className="flex flex-wrap gap-2">
              {ROLLEN.map(r => (
                <button key={r.id} type="button" aria-pressed={offen.rollen.includes(r.id)} className={WAHL(offen.rollen.includes(r.id))}
                        onClick={() => setOffen({ ...offen, rollen: offen.rollen.includes(r.id) ? offen.rollen.filter(x => x !== r.id) : [...offen.rollen, r.id] })}>{r.titel}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className={ETIKETT}>Unterschreibt für</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={!offen.firma} className={WAHL(!offen.firma)} onClick={() => setOffen({ ...offen, firma: null })}>keine Firma</button>
              {(Object.keys(FIRMEN) as FirmaId[]).map(f => <button key={f} type="button" aria-pressed={offen.firma === f} className={WAHL(offen.firma === f)} onClick={() => setOffen({ ...offen, firma: f })}>{FIRMEN[f].name}</button>)}
            </div>
          </div>
          <label className="flex min-h-11 items-center gap-3 text-[15px]">
            <input type="checkbox" checked={!!offen.user_id} disabled={!user} className="h-5 w-5 accent-foreground"
                   onChange={e => setOffen({ ...offen, user_id: e.target.checked ? offen.user_id ?? user?.id ?? null : null })} />
            Nur mit {offen.user_id && offen.user_id !== user?.id ? 'dem hinterlegten Konto' : 'meinem Konto'} (dann tut niemand sonst diese Schritte)
          </label>
          {fehler && <p className="text-sm text-destructive">{fehler}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={KNOPF_HAUPT} disabled={laeuft || offen.name.trim().length < 2} onClick={() => void speichern()}>Speichern</button>
            <button type="button" className={KNOPF} onClick={() => { setOffen(null); setFehler(null); }}>Abbrechen</button>
            {offen.id && <button type="button" className={KNOPF} disabled={laeuft} onClick={() => void loeschen(offen.id!)}><X className="h-4 w-4" /> Entfernen</button>}
          </div>
        </div>
      )}
    </Abschnitt>
  );
}
