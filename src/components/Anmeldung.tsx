import { useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { kennungZuAdresse } from '@/lib/kennung';

/**
 * Anmeldung vor dem Zugang zu den Daten.
 *
 * Die Liste enthält Adressen, Eigentümernamen und Telefonnummern von
 * Menschen, die nie um ihre Aufnahme gebeten haben. Sie gehört hinter
 * eine Anmeldung, nicht ins offene Netz.
 *
 * Nur ein Feld: das Passwort. Es gibt ein Konto für die Arbeit und
 * eines für den Admin-Bereich; welches gemeint ist, weiss die Stelle,
 * die die Maske zeigt, und füllt die Adresse selbst ein. Hinter dem
 * Feld steht trotzdem eine echte Sitzung bei Supabase -- nur die kann
 * die Datenbank später schützen. Das Passwort steht nirgends im Code.
 *
 * Eine Sperre nach Fehlversuchen gab es hier einmal, im Browser. Sie
 * hat am ersten Tag den Einzigen ausgesperrt, der das Passwort kennt,
 * und niemanden sonst gebremst: wer die Schnittstelle direkt
 * anspricht, sieht den Browser nie. Gegen Durchprobieren hilft, was
 * Supabase selbst tut -- es begrenzt Anmeldeversuche am Server -- und
 * dass die Datenbank eine Anmeldung verlangt (Migration
 * 20260905230000_zugang_beschraenken.sql).
 */
interface Props {
  /** Welches Konto: "aui" für die Arbeit, "sqeezn" für den Admin. */
  konto?: string;
  titel?: string;
  text?: string;
  /** In einen Bereich eingebettet statt als ganze Seite. */
  eingebettet?: boolean;
  /** Der Name über der Maske -- "Wohntraums" für die Fondsleitungen. */
  marke?: string;
}

export function Anmeldung({
  konto = 'aui',
  titel = 'Anmeldung',
  text = 'Die Liste enthält Personendaten. Zugang nur mit Konto.',
  eingebettet = false,
  marke = 'Aurora',
}: Props) {
  const { signIn } = useAuth();
  const [passwort, setPasswort] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const anmelden = async (e: React.FormEvent) => {
    e.preventDefault();
    if (laeuft) return;
    setLaeuft(true);
    setFehler(null);
    const { error } = await signIn(kennungZuAdresse(konto), passwort);
    setLaeuft(false);
    if (error) {
      setPasswort('');
      // Nicht verraten, was genau nicht stimmt.
      setFehler('Das Passwort stimmt nicht.');
    }
  };

  const formular = (
    <form onSubmit={anmelden} className="w-full max-w-sm space-y-5 rounded-2xl border bg-card p-8 shadow-ceramic">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-primary">
          <Lock className="h-4 w-4" />
          <span className="text-xs font-medium uppercase tracking-wider">{marke}</span>
        </div>
        <h1 className="font-serif text-2xl">{titel}</h1>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>

      {/* Für den Passwortspeicher des Browsers: er merkt sich ein
          Passwort nur zusammen mit einem Namen. Unsichtbar. */}
      <input type="text" name="username" autoComplete="username" value={konto} readOnly hidden />
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="passwort">Passwort</label>
        <Input id="passwort" type="password" value={passwort} onChange={e => setPasswort(e.target.value)}
               autoComplete="current-password" autoFocus required />
      </div>
      {fehler && <p className="text-sm text-destructive">{fehler}</p>}
      <Button type="submit" className="w-full" disabled={laeuft || !passwort}>
        {laeuft && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Anmelden
      </Button>
    </form>
  );

  if (eingebettet) return <div className="grid place-items-center py-10">{formular}</div>;
  return <div className="grid min-h-safe-screen place-items-center bg-background p-6">{formular}</div>;
}
