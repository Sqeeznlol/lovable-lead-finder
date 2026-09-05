import { useEffect, useState } from 'react';
import { Loader2, Lock, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';

/**
 * Anmeldung vor dem Zugang zu den Daten.
 *
 * Die Liste enthält Adressen, Eigentümernamen und Telefonnummern von
 * Menschen, die nie um ihre Aufnahme gebeten haben. Sie gehört hinter
 * eine Anmeldung, nicht ins offene Netz.
 *
 * Zur Bremse gegen das Durchprobieren von Passwörtern: nach fünf
 * Fehlversuchen bleibt die Maske für fünfzehn Minuten gesperrt, danach
 * je weiterem Fehlversuch länger. Das geschieht im Browser und ist
 * deshalb kein Schutz gegen jemanden, der die Schnittstelle direkt
 * anspricht -- dagegen hilft nur, dass die Datenbank selbst eine
 * Anmeldung verlangt. Diese Sperre nimmt dem Gelegenheitsversuch die
 * Geduld, mehr soll sie nicht.
 */
const SPEICHER = 'anmeldung.versuche';
const FREI_NACH = 5;

interface Versuche {
  anzahl: number;
  gesperrtBis: number;
}

function lesen(): Versuche {
  try {
    const roh = localStorage.getItem(SPEICHER);
    if (roh) return JSON.parse(roh) as Versuche;
  } catch {
    /* Kein Speicher -- dann eben ohne Bremse. */
  }
  return { anzahl: 0, gesperrtBis: 0 };
}

function schreiben(v: Versuche) {
  try {
    localStorage.setItem(SPEICHER, JSON.stringify(v));
  } catch {
    /* siehe oben */
  }
}

/** Wie lange nach n Fehlversuchen gesperrt wird, in Minuten. */
function sperrdauer(anzahl: number): number {
  if (anzahl < FREI_NACH) return 0;
  // 15, 30, 60, 120 … höchstens vier Stunden.
  return Math.min(15 * 2 ** (anzahl - FREI_NACH), 240);
}

export function Anmeldung() {
  const { signIn } = useAuth();
  const [benutzer, setBenutzer] = useState('');
  const [passwort, setPasswort] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [versuche, setVersuche] = useState<Versuche>(lesen);
  const [jetzt, setJetzt] = useState(Date.now());

  // Damit die verbleibende Zeit herunterzählt, statt still zu stehen.
  useEffect(() => {
    const t = setInterval(() => setJetzt(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const gesperrt = versuche.gesperrtBis > jetzt;
  const restMinuten = Math.ceil((versuche.gesperrtBis - jetzt) / 60000);

  const anmelden = async (e: React.FormEvent) => {
    e.preventDefault();
    if (gesperrt || laeuft) return;
    setLaeuft(true);
    setFehler(null);

    // Der Benutzername darf ohne Domain eingegeben werden; die Anmeldung
    // erwartet eine Adresse.
    const kennung = benutzer.includes('@')
      ? benutzer.trim()
      : `${benutzer.trim().toLowerCase()}@wohntraums.life`;

    const { error } = await signIn(kennung, passwort);
    setLaeuft(false);

    if (!error) {
      schreiben({ anzahl: 0, gesperrtBis: 0 });
      setVersuche({ anzahl: 0, gesperrtBis: 0 });
      return;
    }

    const anzahl = versuche.anzahl + 1;
    const dauer = sperrdauer(anzahl);
    const neu = {
      anzahl,
      gesperrtBis: dauer ? Date.now() + dauer * 60000 : 0,
    };
    schreiben(neu);
    setVersuche(neu);
    // Nicht verraten, ob der Benutzername existiert -- das wäre die
    // halbe Arbeit für jemanden, der es darauf anlegt.
    setFehler('Benutzername oder Passwort stimmt nicht.');
  };

  return (
    <div className="grid min-h-safe-screen place-items-center bg-background p-6">
      <form
        onSubmit={anmelden}
        className="w-full max-w-sm space-y-5 rounded-2xl border bg-card p-8 shadow-ceramic"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <Lock className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">
              Bauraum
            </span>
          </div>
          <h1 className="font-serif text-2xl">Anmeldung</h1>
          <p className="text-sm text-muted-foreground">
            Die Liste enthält Personendaten. Zugang nur mit Konto.
          </p>
        </div>

        {gesperrt ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm">
              Zu viele Fehlversuche. Wieder frei in{' '}
              <span className="font-medium tabular-nums">
                {restMinuten} Minute{restMinuten === 1 ? '' : 'n'}
              </span>
              .
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="benutzer">
                Benutzername
              </label>
              <Input
                id="benutzer"
                value={benutzer}
                onChange={e => setBenutzer(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="passwort">
                Passwort
              </label>
              <Input
                id="passwort"
                type="password"
                value={passwort}
                onChange={e => setPasswort(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {fehler && (
              <p className="text-sm text-destructive">{fehler}</p>
            )}

            {versuche.anzahl > 0 && versuche.anzahl < FREI_NACH && (
              <p className="text-xs text-muted-foreground">
                Noch {FREI_NACH - versuche.anzahl} Versuch
                {FREI_NACH - versuche.anzahl === 1 ? '' : 'e'}, dann wird
                gesperrt.
              </p>
            )}

            <Button type="submit" className="w-full" disabled={laeuft}>
              {laeuft && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Anmelden
            </Button>
          </>
        )}
      </form>
    </div>
  );
}
