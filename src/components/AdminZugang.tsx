import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Anmeldung } from '@/components/Anmeldung';

/**
 * Der Admin-Bereich verlangt das Admin-Konto.
 *
 * Nicht ein zweites Passwort im Browser -- das gab es hier schon einmal,
 * und es hat nichts geschützt. Die Rolle steht in der Datenbank
 * (user_roles, has_role), und nur wer sie trägt, sieht die Anmeldungen
 * und die Einstellungen. Wer mit dem Arbeitskonto hier landet, meldet
 * sich mit dem Admin-Konto an; der Name steht schon da.
 */
export function AdminZugang({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  if (isAdmin) return <>{children}</>;
  return (
    <Anmeldung
      konto="sqeezn"
      titel="Admin"
      text="Hier stehen die Anmeldungen, die Einstellungen und der Import. Nur mit dem Admin-Konto."
      eingebettet
    />
  );
}
