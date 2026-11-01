import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Anmeldung } from '@/components/Anmeldung';
import { FondsOberflaeche } from '@/components/fonds/FondsOberflaeche';

/**
 * /fonds -- Wohntraums, die Oberfläche für Fondsleitungen. Eigene
 * Adresse und eigene Anmeldung (Konto "fonds"): wer sich hier anmeldet,
 * sieht nur seine Fonds. Unsere Konten sehen hier die Testmaske.
 */
export default function FondsSeite() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-safe-screen place-items-center bg-background"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!user) return <Anmeldung konto="fonds" marke="Wohntraums" titel="Ihr Portfolio-Universum" text="Anmeldung für Fondsleitungen." />;
  return <FondsOberflaeche />;
}
