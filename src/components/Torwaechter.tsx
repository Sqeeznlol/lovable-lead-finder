import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Anmeldung } from '@/components/Anmeldung';

/**
 * Lässt nur angemeldete Personen zu den Daten.
 *
 * Während die Sitzung geprüft wird, erscheint weder die Anmeldung noch
 * der Inhalt: sonst blitzt bei jedem Laden kurz die Anmeldemaske auf,
 * obwohl man längst angemeldet ist.
 */
export function Torwaechter({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-safe-screen place-items-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return user ? <>{children}</> : <Anmeldung />;
}
