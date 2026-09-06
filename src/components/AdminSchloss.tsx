import { useState, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Ein Riegel vor dem Admin-Bereich.
 *
 * Was er ist: eine Hürde gegen den falschen Klick. Wer im Akquise-Modus
 * arbeitet, soll nicht aus Versehen im Import oder in den Einstellungen
 * landen.
 *
 * Was er nicht ist: Schutz. Diese Prüfung läuft im Browser, und alles,
 * was im Browser läuft, kann gelesen werden -- auch dieser Vergleich.
 * Der Bereich dahinter ist damit nicht sicherer, er ist nur nicht mehr
 * versehentlich erreichbar. Wirklich schützen liesse er sich nur über
 * eine Rolle in der Datenbank, die serverseitig entscheidet, wer
 * ändern darf.
 *
 * Deshalb steht hier auch nicht das Wort selbst, sondern seine
 * Prüfsumme: wer den ausgelieferten Stand durchsucht, findet dann
 * wenigstens kein lesbares Passwort.
 */
const PRUEFSUMME =
  'eebaa3310cd2feae48028a4fdf99510b5feab971d6950af94a2789c9ccf34d68';

/** Einmal am Tag reicht -- der Riegel soll nicht zur Plage werden. */
const SCHLUESSEL = 'bauraum.admin.offen';

async function pruefsumme(text: string): Promise<string> {
  const daten = new TextEncoder().encode(text);
  const summe = await crypto.subtle.digest('SHA-256', daten);
  return [...new Uint8Array(summe)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function schonOffen(): boolean {
  try {
    return sessionStorage.getItem(SCHLUESSEL) === 'ja';
  } catch {
    return false;
  }
}

export function AdminSchloss({ children }: { children: ReactNode }) {
  const [offen, setOffen] = useState(schonOffen);
  const [wort, setWort] = useState('');
  const [falsch, setFalsch] = useState(false);

  if (offen) return <>{children}</>;

  const pruefen = async () => {
    if (await pruefsumme(wort) === PRUEFSUMME) {
      try { sessionStorage.setItem(SCHLUESSEL, 'ja'); } catch { /* egal */ }
      setOffen(true);
      return;
    }
    setFalsch(true);
    setWort('');
  };

  return (
    <div className="mx-auto max-w-sm rounded-2xl border p-6 text-center">
      <Lock className="mx-auto h-5 w-5 text-muted-foreground" />
      <h2 className="mt-3 font-serif text-lg">Admin</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Hier stehen Einstellungen und der Import. Passwort eingeben.
      </p>
      <Input
        type="password"
        autoFocus
        value={wort}
        onChange={e => { setWort(e.target.value); setFalsch(false); }}
        onKeyDown={e => { if (e.key === 'Enter') pruefen(); }}
        placeholder="Passwort"
        className="mt-4"
      />
      {falsch && (
        <p className="mt-2 text-sm text-destructive">Passwort stimmt nicht.</p>
      )}
      <Button className="mt-3 w-full" onClick={pruefen} disabled={!wort}>
        Öffnen
      </Button>
    </div>
  );
}
