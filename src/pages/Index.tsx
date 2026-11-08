import { lazy, Suspense, useEffect, useState } from 'react';
import { LogOut, Plus, Share, Shield, Target, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ThemeToggle } from '@/components/ThemeToggle';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminZugang } from '@/components/AdminZugang';
import { Auffang } from '@/components/Auffang';
import { useAuth } from '@/hooks/use-auth';
import { usePlatform } from '@/hooks/use-platform';
const Leads = lazy(() => import('@/components/Leads').then(m => ({ default: m.Leads })));
const AdminSettings = lazy(() => import('@/components/AdminSettings').then(m => ({ default: m.AdminSettings })));
const Protokoll = lazy(() => import('@/components/Protokoll').then(m => ({ default: m.Protokoll })));

/**
 * Das neue Werkzeug ist das Leads-Dashboard der Check-Seiten (Julian,
 * 8. November: "das ist ja neues Tool ... die alten Funktionen einfach
 * weg"). Die frühere Eigentümerabfrage mit Nummern, Pipedrive und
 * Erweiterung ist aus der Oberfläche genommen; der Code dazu steht im
 * Verlauf des Zweigs, falls er je wieder gebraucht wird.
 */
const TABS = ['leads', 'admin'] as const;
type Tab = typeof TABS[number];
const istTab = (x: string | undefined): x is Tab => !!x && (TABS as readonly string[]).includes(x);

type Eintrag = { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> };
const EINTRAEGE: Eintrag[] = [
  { id: 'leads', label: 'Leads', icon: Target },
  { id: 'admin', label: 'Admin', icon: Shield },
];

/** Ein Punkt der Icon-Leiste: Symbol, aktiv als schwarzes Quadrat, Name beim Überfahren. */
function LeistenPunkt({ label, icon: Icon, an, onClick }: { label: string; icon: Eintrag['icon']; an: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} aria-current={an ? 'page' : undefined}
            className={`group relative grid h-11 w-11 place-items-center rounded-[3px] transition-colors ${an ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
      <Icon className="h-5 w-5" />
      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-[3px] bg-foreground px-2.5 py-1.5 text-xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        {label}
      </span>
    </button>
  );
}

export default function Index() {
  const { bereich } = useParams();
  const navigate = useNavigate();
  // Alte Adressen (/master, /nummern ...) landen beim Dashboard statt im Nichts.
  const active: Tab = istTab(bereich) ? bereich : 'leads';
  // Ein Fondsmanager-Konto ist ein Kunde: Namen und Nummern von
  // Eigentümern gehen ihn nichts an. Er sieht hier nur einen Hinweis.
  const { data: fondsmanager } = useQuery({
    queryKey: ['ist-fondsmanager'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await (supabase as any).rpc('ist_fondsmanager');
      return r.error ? false : Boolean(r.data);
    },
    staleTime: 10 * 60 * 1000,
  });
  const { signOut } = useAuth();
  const platform = usePlatform();
  const [showInstallHint, setShowInstallHint] = useState(false);

  useEffect(() => {
    if (platform.shouldPromptInstall && !sessionStorage.getItem('bauraum-install-hint-dismissed')) {
      const t = setTimeout(() => setShowInstallHint(true), 1200);
      return () => clearTimeout(t);
    }
  }, [platform.shouldPromptInstall]);

  const dismissInstallHint = () => {
    sessionStorage.setItem('bauraum-install-hint-dismissed', '1');
    setShowInstallHint(false);
  };

  const gehe = (t: Tab) => { navigate(t === 'leads' ? '/' : `/${t}`); window.scrollTo({ top: 0 }); };
  const titel = EINTRAEGE.find(t => t.id === active)?.label ?? '';

  if (fondsmanager) {
    return (
      <div className="grid min-h-safe-screen place-items-center bg-background p-6 text-center">
        <div className="max-w-sm space-y-3">
          <p className="text-lg font-semibold">Kein Zugang zur Akquise</p>
          <p className="text-sm text-muted-foreground">Dieses Konto gehört einer Fondsleitung. Die Akquise ist nur für das Bauraum-Team.</p>
          <button type="button" onClick={() => void signOut()} className="text-sm font-semibold underline underline-offset-4">Abmelden</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-safe-screen bg-background">
      {/* Schmale Leiste nur mit Symbolen (DESIGN.md): der aktive Punkt als schwarzes Quadrat. */}
      <aside className="sticky top-0 hidden h-screen w-[76px] shrink-0 flex-col items-center border-r bg-card py-5 lg:flex">
        <nav className="flex flex-1 flex-col items-center gap-1" aria-label="Hauptnavigation">
          {EINTRAEGE.map(t => <LeistenPunkt key={t.id} label={t.label} icon={t.icon} an={active === t.id} onClick={() => gehe(t.id)} />)}
        </nav>
        <LeistenPunkt label="Abmelden" icon={LogOut} an={false} onClick={() => void signOut()} />
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {/* Deckend, ohne Weichzeichner: Text bleibt scharf (DESIGN.md). */}
        <header className="sticky top-0 z-30 border-b bg-background pt-[env(safe-area-inset-top)] lg:border-b-0">
          <div className="flex h-16 items-center gap-3 px-4 lg:h-[76px] lg:px-10">
            <span className="min-w-0 shrink truncate text-lg font-semibold lg:hidden">{titel}</span>
            <div className="ml-auto flex items-center gap-3"><ThemeToggle /></div>
          </div>
        </header>

        <div className="w-full flex-1 overflow-x-clip px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 lg:px-10 lg:pb-12 lg:pt-4 animate-fade-in" key={active}>
          <Auffang key={active} bereich={titel}>
            <Suspense fallback={
              <div className="space-y-4">
                <Skeleton className="h-10 w-1/3" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            }>
              {active === 'leads' && <Leads />}
              {active === 'admin' && (
                <AdminZugang>
                  <div className="space-y-6">
                    <AdminSettings />
                    <Protokoll />
                  </div>
                </AdminZugang>
              )}
            </Suspense>
          </Auffang>
        </div>

        {/* iPhone: die Ziele unten, gleich gross. */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-safe lg:hidden" aria-label="Hauptnavigation">
          <div className="grid grid-cols-3 px-1 pt-1.5">
            {[...EINTRAEGE, { id: 'abmelden' as const, label: 'Abmelden', icon: LogOut }].map(t => {
              const an = active === t.id;
              return (
                <button key={t.id} type="button"
                        onClick={() => (t.id === 'abmelden' ? void signOut() : gehe(t.id))}
                        className={`flex flex-col items-center gap-1 py-1.5 text-[11px] font-medium transition-colors ${an ? 'text-foreground' : 'text-muted-foreground'}`}>
                  <span className={`grid h-8 w-11 place-items-center rounded-[3px] transition-colors ${an ? 'bg-foreground text-background' : ''}`}>
                    <t.icon className="h-5 w-5" />
                  </span>
                  {t.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* iOS Safari: "Zum Home-Bildschirm". */}
        {showInstallHint && (
          <div className="fixed inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 animate-fade-in lg:hidden">
            <div className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-ceramic-hover">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Leads als App installieren</p>
                <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                  Tippe auf <Share className="inline h-3.5 w-3.5" /> «Teilen» und dann <Plus className="inline h-3.5 w-3.5" /> «Zum Home-Bildschirm»
                </p>
              </div>
              <button type="button" onClick={dismissInstallHint} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Schliessen">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
