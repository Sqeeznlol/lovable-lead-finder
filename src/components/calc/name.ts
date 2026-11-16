import { useEffect, useState } from 'react';

/**
 * Der Name, unter dem jemand einen Schritt tut. Es gibt wenige Konten
 * und mehrere Hände (use-auth.tsx): darum steht im Verlauf der Name, den
 * man angibt. Das Gerät merkt ihn sich, damit man ihn einmal tippt.
 */
export function useName(): [string, (n: string) => void] {
  const [name, setName] = useState(() => { try { return localStorage.getItem('calc-name') ?? ''; } catch { return ''; } });
  const setze = (n: string) => {
    setName(n);
    try { localStorage.setItem('calc-name', n); } catch { /* privates Fenster: dann eben ohne Merken */ }
  };
  return [name, setze];
}

/** Die Zeit, alle `ms` neu: damit die Uhr einer offenen Kalkulation weiterläuft. */
export function useJetzt(ms = 60000): number {
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setJetzt(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return jetzt;
}
