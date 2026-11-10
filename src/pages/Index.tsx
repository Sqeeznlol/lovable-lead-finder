import { lazy, Suspense, useEffect, useState } from 'react';
import { Building2, X, Shield, Share, Plus, Map, Target, BarChart3, Gauge, HardHat, MoreHorizontal, Briefcase, LogOut, Orbit, CalendarDays, Inbox, Combine } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { KontoMenu } from '@/components/KontoMenu';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PropertyDetailDialog } from '@/components/PropertyDetailDialog';
import { useSchliessen, useUrlWert } from '@/hooks/use-url-wert';
import { Skeleton } from '@/components/ui/skeleton';
const Auswertung = lazy(() => import('@/components/Auswertung').then(m => ({ default: m.Auswertung })));
const Arrondierung = lazy(() => import('@/components/Arrondierung').then(m => ({ default: m.Arrondierung })));
const Leads = lazy(() => import('@/components/Leads').then(m => ({ default: m.Leads })));
const Cockpit = lazy(() => import('@/components/Cockpit').then(m => ({ default: m.Cockpit })));
const Baugesuche = lazy(() => import('@/components/Baugesuche').then(m => ({ default: m.Baugesuche })));
const Gelegenheiten = lazy(() => import('@/components/Gelegenheiten').then(m => ({ default: m.Gelegenheiten })));
const Karte3DSeite = lazy(() => import('@/components/karte3d/Karte3DSeite').then(m => ({ default: m.Karte3DSeite })));
const Kalender = lazy(() => import('@/components/Kalender').then(m => ({ default: m.Kalender })));
const Nachbarschaft = lazy(() => import('@/components/Nachbarschaft').then(m => ({ default: m.Nachbarschaft })));
// Die Karte zieht Leaflet nach -- das gehoert nicht ins erste
// Buendel, sondern wird geholt, wenn jemand den Reiter oeffnet.
const Karte = lazy(() => import('@/components/Karte').then(m => ({ default: m.Karte })));
// Was nur ein Reiter braucht, kommt erst mit dem Reiter: das erste
// Bündel trägt nur den Rahmen und das Cockpit.
const Zentrale = lazy(() => import('@/components/Zentrale').then(m => ({ default: m.Zentrale })));
const Protokoll = lazy(() => import('@/components/Protokoll').then(m => ({ default: m.Protokoll })));
const Anmeldungen = lazy(() => import('@/components/Anmeldungen').then(m => ({ default: m.Anmeldungen })));
const Teams = lazy(() => import('@/components/Teams').then(m => ({ default: m.Teams })));
const AdminSettings = lazy(() => import('@/components/AdminSettings').then(m => ({ default: m.AdminSettings })));
import { Parzellensuche } from '@/components/Parzellensuche';
import { useCanton } from '@/hooks/use-canton';
import { KeyboardShortcutsOverlay } from '@/components/KeyboardShortcutsOverlay';
import { AdminZugang } from '@/components/AdminZugang';
import { Auffang } from '@/components/Auffang';
import { useAuth } from '@/hooks/use-auth';
import { usePlatform } from '@/hooks/use-platform';

// Jeder Bereich ist eine Adresse: /zentrale, /baugesuche ... ("/" ist
// das Cockpit). So führt "Zurück" im Browser in den vorigen Bereich.
const TABS = ['cockpit', 'leads', 'zentrale', 'baugesuche', 'karte', 'nachbarschaft', 'arrondierung', 'gelegenheiten', 'auswertung', 'kalender', 'karte3d', 'admin'] as const;
type Tab = typeof TABS[number];
const istTab = (x: string | undefined): x is Tab => !!x && (TABS as readonly string[]).includes(x);

// Die Akquise mit ihren Reitern (Übersicht, Abfrage, Gebäudesuche,
// Nummern, Pipedrive und die stillgelegten) ist seit dem 7. November ein
// eigenes Programm, getrennt von dieser Webseite (src/App.tsx).
type Eintrag = { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> };

// Zwei Gruppen statt einer langen Liste: was heute zu tun ist und die
// Plattform (Karte, Gelegenheiten, Baugesuche, Auswertung). Das Cockpit steht zuerst: dort steht alles, was zu
// prüfen ist (Julians Frage "wo steht das zur Überprüfung alles?").
const gruppen: { titel: string; eintraege: Eintrag[] }[] = [
  { titel: 'Heute', eintraege: [
    { id: 'cockpit', label: 'Cockpit', icon: Gauge },
    // Die Leads der Check-Seiten (20 Webseiten, eine Liste), mit Zahlen je Webseite.
    { id: 'leads', label: 'Leads', icon: Inbox },
    // Jedes Kundenvorhaben an einem Ort: von der Adressliste bis zur
    // Akquise in seinem Namen.
    { id: 'zentrale', label: 'Zentrale', icon: Briefcase },
  ] },
  { titel: 'Plattform', eintraege: [
    { id: 'karte', label: 'Karte', icon: Map },
    { id: 'gelegenheiten', label: 'Gelegenheiten', icon: Target },
    { id: 'baugesuche', label: 'Baugesuche', icon: HardHat },
    { id: 'auswertung', label: 'Auswertung', icon: BarChart3 },
    { id: 'nachbarschaft', label: 'Nachbarschaft', icon: Share },
    // Nachbarparzellen der Kundenliegenschaften (Helvetica) nach Potenzial.
    { id: 'arrondierung', label: 'Arrondieren', icon: Combine },
    // Messen und Kongresse der Branche: wann, wo, mit Adresse.
    { id: 'kalender', label: 'Immo-Kalender', icon: CalendarDays },
  ] },
  { titel: 'Verwaltung', eintraege: [
    { id: 'admin', label: 'Admin', icon: Shield },
  ] },
];
const tabs: Eintrag[] = gruppen.flatMap(g => g.eintraege);

// Primary tabs visible in the iPhone bottom bar
// Auf dem iPhone vier feste Ziele und "Mehr" für den Rest.
const mobileBottomTabs: Tab[] = ['cockpit', 'leads', 'zentrale', 'karte'];

/** Ein Punkt der Icon-Leiste: Symbol, aktiv als schwarzes Quadrat, Name beim Überfahren. */
function LeistenPunkt({ t, an, onClick }: { t: Eintrag; an: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={t.label} aria-current={an ? 'page' : undefined}
            className={`group relative grid h-11 w-11 place-items-center rounded-[3px] transition-colors ${an ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
      <t.icon className="h-5 w-5" />
      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-[3px] bg-foreground px-2.5 py-1.5 text-xs font-medium text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        {t.label}
      </span>
    </button>
  );
}

export default function Index() {
  const { bereich } = useParams();
  const navigate = useNavigate();
  const active: Tab = istTab(bereich) ? bereich : 'cockpit';
  // Ein Fondsmanager-Konto gehört nach Wohntraums (/fonds) und sieht
  // die interne Oberfläche nie.
  const { data: fondsmanager } = useQuery({
    queryKey: ['ist-fondsmanager'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await (supabase as any).rpc('ist_fondsmanager');
      return r.error ? false : Boolean(r.data);
    },
    staleTime: 10 * 60 * 1000,
  });
  useEffect(() => { if (fondsmanager) navigate('/fonds', { replace: true }); }, [fondsmanager, navigate]);
  // Die Objektansicht einer Parzelle -- eine für alle Bereiche, offen
  // über ?parzelle=..., damit auch sie "Zurück" kennt.
  const [parzelle] = useUrlWert('parzelle');
  const parzelleZu = useSchliessen('parzelle');
  const [mehrAuf, setMehrAuf] = useState(false);
  const { current: kantonJetzt } = useCanton();
  const [wisch, setWisch] = useState<{ x: number; y: number } | null>(null);
  const { user, signOut } = useAuth();
  const konto = user?.email?.split('@')[0] ?? '';
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

  const gehe = (t: Tab, suche = '') => { navigate((t === 'cockpit' ? '/' : `/${t}`) + suche); setMehrAuf(false); window.scrollTo({ top: 0 }); };
  const neuesVorhaben = () => gehe('zentrale', '?neu=1');
  // Wischen auf dem iPhone: links/rechts wechselt zwischen den vier
  // Zielen der unteren Leiste. Nur waagrecht und deutlich -- sonst
  // stört es das Scrollen. Auf der Karte nicht: dort wischt man die Karte.
  const wischEnde = (e: React.TouchEvent) => {
    if (!wisch || active === 'karte') return;
    const t = e.changedTouches[0];
    const dx = t.clientX - wisch.x, dy = t.clientY - wisch.y;
    setWisch(null);
    if (Math.abs(dx) < 80 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    const i = mobileBottomTabs.indexOf(active);
    if (i < 0) return;
    const j = i + (dx < 0 ? 1 : -1);
    if (j >= 0 && j < mobileBottomTabs.length) gehe(mobileBottomTabs[j]);
  };
  // Die Karten füllen den Bildschirm: ohne Kopfzeile und Ränder.
  const karteAktiv = active === 'karte' || active === 'karte3d';
  const titel = tabs.find(t => t.id === active)?.label ?? '';

  return (
    <div className="flex min-h-safe-screen bg-background">
      <KeyboardShortcutsOverlay />
      <PropertyDetailDialog id={parzelle} onClose={parzelleZu} />

      {/* Schmale Leiste nur mit Symbolen, wie in der Vorlage (DESIGN.md):
          der aktive Punkt als schwarzes Quadrat. Der Name steht beim
          Überfahren daneben und für Screenreader im Knopf. */}
      <aside className="sticky top-0 hidden h-screen w-[76px] shrink-0 flex-col items-center border-r bg-card py-5 lg:flex">
        <button type="button" onClick={() => gehe('cockpit')} aria-label="Cockpit"
                className="mb-6 grid h-11 w-11 place-items-center rounded-[3px] text-foreground">
          <Building2 className="h-7 w-7" strokeWidth={2.2} />
        </button>
        <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto no-scrollbar" aria-label="Hauptnavigation">
          {gruppen.filter(g => g.titel !== 'Verwaltung').map((g, gi) => (
            <div key={g.titel} className={`flex flex-col items-center gap-1 ${gi > 0 ? 'mt-3 border-t pt-3' : ''}`}>
              {g.eintraege.map(t => (
                <LeistenPunkt key={t.id} t={t} an={active === t.id} onClick={() => gehe(t.id)} />
              ))}
            </div>
          ))}
        </nav>
        <div className="flex flex-col items-center gap-1 pt-3">
          {/* Wohntraums ist ein eigenes Programm für Fondsleitungen --
              darum abgesetzt, unten, und es öffnet eine eigene Adresse. */}
          <LeistenPunkt t={{ id: 'admin', label: 'Wohntraums · Fonds', icon: Orbit }} an={false} onClick={() => navigate('/fonds')} />
          <span className="my-1 h-px w-6 bg-border" aria-hidden />
          {gruppen.find(g => g.titel === 'Verwaltung')!.eintraege.map(t => (
            <LeistenPunkt key={t.id} t={t} an={active === t.id} onClick={() => gehe(t.id)} />
          ))}
          <LeistenPunkt t={{ id: 'admin', label: 'Abmelden', icon: LogOut }} an={false} onClick={() => void signOut()} />
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col" onTouchStart={e => setWisch({ x: e.touches[0].clientX, y: e.touches[0].clientY })} onTouchEnd={wischEnde}>
        {/* Kopfzeile wie in der Vorlage: links die Suche (Parzelle,
            EGRID, Adresse), rechts die Hauptaktion und das Konto. Auf
            dem Handy Zeichen und Titel. Deckend, ohne Weichzeichner:
            Text bleibt scharf (DESIGN.md). */}
        {!karteAktiv && (
          <header className="sticky top-0 z-30 border-b bg-background pt-[env(safe-area-inset-top)] lg:border-b-0">
            <div className="flex h-16 items-center gap-3 px-4 lg:h-[76px] lg:px-10">
              <span className="grid h-9 w-9 place-items-center rounded-[3px] bg-foreground text-background lg:hidden">
                <Building2 className="h-5 w-5" />
              </span>
              <span className="min-w-0 shrink truncate text-lg font-semibold lg:hidden">{titel}</span>
              <div className="relative hidden h-11 w-[380px] lg:block">
                <div className="absolute inset-x-0 top-0 z-40"><Parzellensuche kanton={kantonJetzt} /></div>
              </div>
              {/* min-w-0: ohne darf der Kasten nicht schmaler werden als die
                  Kantone, das Wischen greift nie, und auf dem iPhone lag die
                  Kopfzeile 190 px über dem Rand (gemessen 3. November). */}
              <div className="ml-auto flex min-w-0 items-center gap-3">
                <button type="button" onClick={neuesVorhaben}
                        className="hidden h-11 items-center gap-2 rounded-[3px] bg-accent px-4 text-[15px] font-medium text-accent-foreground transition-transform active:scale-[0.97] lg:inline-flex">
                  <Plus className="h-4 w-4" /> Neues Vorhaben
                </button>
                <ThemeToggle />
                <KontoMenu />
              </div>
            </div>
          </header>
        )}

        <div className={karteAktiv ? 'flex-1' : `w-full flex-1 overflow-x-clip px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 lg:px-10 lg:pb-12 lg:pt-4 animate-fade-in`} key={active}>
          <Auffang key={active} bereich={titel}>
          <Suspense fallback={
            <div className="space-y-4">
              <Skeleton className="h-10 w-1/3" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          }>
            {active === 'cockpit' && <Cockpit onGehe={z => gehe(z)} onNeu={neuesVorhaben} />}
            {active === 'leads' && <Leads />}
            {active === 'zentrale' && <Zentrale />}
            {active === 'baugesuche' && <Baugesuche />}
            {active === 'karte' && <Karte onSchliessen={() => gehe('cockpit')} />}
            {active === 'nachbarschaft' && <Nachbarschaft />}
            {active === 'arrondierung' && <Arrondierung />}
            {active === 'gelegenheiten' && <Gelegenheiten />}
            {active === 'kalender' && <Kalender />}
            {active === 'karte3d' && <Karte3DSeite />}
            {active === 'auswertung' && <Auswertung />}
            {active === 'admin' && (
              <AdminZugang>
              <div className="space-y-6">
                {/* Wer war von wo da -- das Erste, was der Admin sieht. */}
                <Anmeldungen />
                {/* Wer welchen Kunden sieht -- die Grenze zieht die Datenbank. */}
                <Teams />

                <div className="space-y-6">
                <AdminSettings />
                <Protokoll />
              </div>
              </div>
              </AdminZugang>
            )}
          </Suspense>
          </Auffang>
        </div>

        {/* iPhone: vier feste Ziele und "Mehr". Gleich gross, ein Feld. */}
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-safe lg:hidden" aria-label="Hauptnavigation">
          <div className="grid grid-cols-5 px-1 pt-1.5">
            {[...mobileBottomTabs.map(id => tabs.find(x => x.id === id)!), { id: 'mehr' as const, label: 'Mehr', icon: MoreHorizontal }].map(t => {
              const an = t.id === 'mehr' ? mehrAuf : active === t.id && !mehrAuf;
              return (
                <button key={t.id} type="button"
                        onClick={() => (t.id === 'mehr' ? setMehrAuf(v => !v) : gehe(t.id as Tab))}
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

        {/* "Mehr": alle Bereiche als Liste, von unten -- wie auf dem iPhone gewohnt. */}
        {mehrAuf && (
          <div className="fixed inset-0 z-30 lg:hidden" onClick={() => setMehrAuf(false)}>
            <div className="absolute inset-0 bg-foreground/30" />
            <div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-md bg-card px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-3 animate-fade-in"
                 onClick={e => e.stopPropagation()}>
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
              {gruppen.map(g => (
                <div key={g.titel} className="mb-4">
                  <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.titel}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {g.eintraege.map(t => (
                      <button key={t.id} type="button" onClick={() => gehe(t.id)}
                              className={`flex h-12 items-center gap-3 rounded-[3px] border px-3 text-sm font-medium ${active === t.id ? 'border-foreground bg-foreground text-background' : 'bg-card'}`}>
                        <t.icon className="h-4 w-4" /> {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => navigate('/fonds')}
                      className="mb-4 flex h-12 w-full items-center gap-3 rounded-[3px] border px-3 text-sm font-medium">
                <Orbit className="h-4 w-4" /> Wohntraums · Fonds <span className="ml-auto text-xs text-muted-foreground">eigenes Programm</span>
              </button>
              <div className="flex items-center justify-between border-t px-2 pt-4">
                <span className="text-sm text-muted-foreground">{konto}</span>
                <button type="button" onClick={() => void signOut()} className="text-sm font-semibold">Abmelden</button>
              </div>
            </div>
          </div>
        )}

        {/* iOS Safari: "Zum Home-Bildschirm". Nicht über der 3D-Karte: dort
            fehlt die untere Leiste, über der er sitzt -- er läge auf Legende
            und Tafel. */}
        {showInstallHint && active !== 'karte3d' && (
          <div className="fixed inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 animate-fade-in lg:hidden">
            <div className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-ceramic-hover">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Aurora als App installieren</p>
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
