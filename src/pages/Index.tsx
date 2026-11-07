import { lazy, Suspense, useEffect, useState } from 'react';
import { Building2, LayoutDashboard, Upload, Phone, X, Zap, Search, FileSpreadsheet, Eye, Shield, Share, Plus, Database, Send, Map, Target, BarChart3, Gauge, HardHat, MoreHorizontal, Briefcase, LogOut, Orbit, CalendarDays } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PropertyDetailDialog } from '@/components/PropertyDetailDialog';
import { useSchliessen, useUrlWert } from '@/hooks/use-url-wert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
const Uebersicht = lazy(() => import('@/components/Uebersicht').then(m => ({ default: m.Uebersicht })));
const Dashboard = lazy(() => import('@/components/Dashboard').then(m => ({ default: m.Dashboard })));
const PropertyList = lazy(() => import('@/components/PropertyList').then(m => ({ default: m.PropertyList })));
const CsvImport = lazy(() => import('@/components/CsvImport').then(m => ({ default: m.CsvImport })));
const MasterImport = lazy(() => import('@/components/MasterImport').then(m => ({ default: m.MasterImport })));
const MasterList = lazy(() => import('@/components/MasterList').then(m => ({ default: m.MasterList })));
const PhoneManager = lazy(() => import('@/components/PhoneManager').then(m => ({ default: m.PhoneManager })));
const AkquiseMode = lazy(() => import('@/components/AkquiseMode').then(m => ({ default: m.AkquiseMode })));
const TelefonSuche = lazy(() => import('@/components/TelefonSuche').then(m => ({ default: m.TelefonSuche })));
const PipedriveExport = lazy(() => import('@/components/PipedriveExport').then(m => ({ default: m.PipedriveExport })));
const Vorauswahl = lazy(() => import('@/components/Vorauswahl').then(m => ({ default: m.Vorauswahl })));
const GebaeudeSuche = lazy(() => import('@/components/GebaeudeSuche').then(m => ({ default: m.GebaeudeSuche })));
const Nummern = lazy(() => import('@/components/Nummern').then(m => ({ default: m.Nummern })));
const PipedriveBereit = lazy(() => import('@/components/PipedriveBereit').then(m => ({ default: m.PipedriveBereit })));
const Protokoll = lazy(() => import('@/components/Protokoll').then(m => ({ default: m.Protokoll })));
const Lesezeichen = lazy(() => import('@/components/Lesezeichen').then(m => ({ default: m.Lesezeichen })));
const ErweiterungHolen = lazy(() => import('@/components/ErweiterungHolen').then(m => ({ default: m.ErweiterungHolen })));
const AdminSettings = lazy(() => import('@/components/AdminSettings').then(m => ({ default: m.AdminSettings })));
import { CantonTabs } from '@/components/CantonTabs';
import { Parzellensuche } from '@/components/Parzellensuche';
import { useCanton } from '@/hooks/use-canton';
import { KeyboardShortcutsOverlay } from '@/components/KeyboardShortcutsOverlay';
import { AdminZugang } from '@/components/AdminZugang';
import { Auffang } from '@/components/Auffang';
import { AuskunftAusLesezeichen } from '@/components/AuskunftAusLesezeichen';
import { useAuth } from '@/hooks/use-auth';
import { usePlatform } from '@/hooks/use-platform';
import { useMidnightReset } from '@/hooks/use-phones';

// Jeder Bereich ist eine Adresse: /zentrale, /baugesuche ... ("/" ist
// das Cockpit). So führt "Zurück" im Browser in den vorigen Bereich.
const TABS = ['uebersicht', 'master', 'gebaeudesuche', 'nummern', 'pipedrive', 'dashboard', 'vorauswahl', 'akquise', 'telsuche', 'properties', 'import', 'masterimport', 'phones', 'export', 'admin'] as const;
type Tab = typeof TABS[number];
const istTab = (x: string | undefined): x is Tab => !!x && (TABS as readonly string[]).includes(x);

// Zehn Reiter waren neun zu viel. Was der neue Ablauf selbst erledigt,
// braucht keinen eigenen Ort mehr:
//
//   Vorauswahl      -- die Zonenregeln archivieren von selbst, was sich
//                      nicht bebauen lässt
//   Telefon-Suche   -- läuft nach jeder Abfrage automatisch
//   Pipedrive Export-- der Deal entsteht beim Abfragen, nicht in einem
//                      eigenen Schritt
//   Liegenschaften  -- zeigt dasselbe wie die Master-Liste, nur älter
//   Kennzahlen      -- die Zahlen, die zählen, stehen oben in der Übersicht
//
// Gelöscht ist nichts: die Reiter lassen sich im Admin-Bereich wieder
// öffnen, ebenso der Master-Import, den man selten und bewusst macht.
type Eintrag = { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> };

// Drei Gruppen statt einer langen Liste: was heute zu tun ist, die
// Plattform (Karte, Gelegenheiten, Baugesuche, Auswertung), und die
// tägliche Akquise. Das Cockpit steht zuerst: dort steht alles, was zu
// prüfen ist (Julians Frage "wo steht das zur Überprüfung alles?").
// Die Akquise ist ein eigenes Programm, getrennt von wohntraums.life
// (Julian, 7. November): hier steht nur, was zur Akquise gehört.
const gruppen: { titel: string; eintraege: Eintrag[] }[] = [
  { titel: 'Akquise', eintraege: [
    { id: 'uebersicht', label: 'Übersicht', icon: LayoutDashboard },
    { id: 'master', label: 'Abfrage', icon: Database },
    // Gebäude nach Baujahr, Zimmern, Wohnfläche aus dem Register.
    { id: 'gebaeudesuche', label: 'Gebäudesuche', icon: Building2 },
    // Der Zwischenstand braucht einen eigenen Ort: Eigentümer da,
    // Nummer fehlt.
    { id: 'nummern', label: 'Nummern', icon: Phone },
    // Fertige Leads, die auf den Deal warten.
    { id: 'pipedrive', label: 'Pipedrive', icon: Send },
  ] },
  { titel: 'Verwaltung', eintraege: [
    { id: 'admin', label: 'Admin', icon: Shield },
  ] },
];
const tabs: Eintrag[] = gruppen.flatMap(g => g.eintraege);

/** Die stillgelegten Reiter -- erreichbar, aber nicht mehr im Weg. */
const stillgelegt: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  // Die Telefonverwaltung ist eine Einstellung, kein Arbeitsschritt.
  { id: 'phones', label: 'Telefone', icon: Phone },
  // Der Akquise-Modus stammt aus der Zeit, als hier telefoniert wurde.
  // Heute macht die Uebersicht die Abfrage und "Nummern" die Suche;
  // dazwischen bleibt nichts, was er noch tun muesste.
  { id: 'akquise', label: 'Akquise-Modus', icon: Zap },
  { id: 'dashboard', label: 'Kennzahlen', icon: LayoutDashboard },
  { id: 'vorauswahl', label: 'Vorauswahl', icon: Eye },
  { id: 'telsuche', label: 'Telefon-Suche', icon: Search },
  { id: 'properties', label: 'Liegenschaften', icon: Building2 },
  { id: 'export', label: 'Pipedrive Export', icon: FileSpreadsheet },
];

// Primary tabs visible in the iPhone bottom bar
// Auf dem iPhone vier feste Ziele und "Mehr" für den Rest.
const mobileBottomTabs: Tab[] = ['uebersicht', 'master', 'nummern', 'pipedrive'];

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
  const active: Tab = istTab(bereich) ? bereich : 'uebersicht';
  // Ein Fondsmanager-Konto ist ein Kunde: Eigentümernamen und Nummern
  // gehen ihn nichts an. Er sieht hier nur einen Hinweis.
  const { data: fondsmanager } = useQuery({
    queryKey: ['ist-fondsmanager'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await (supabase as any).rpc('ist_fondsmanager');
      return r.error ? false : Boolean(r.data);
    },
    staleTime: 10 * 60 * 1000,
  });
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
  useMidnightReset();

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

  const gehe = (t: Tab, suche = '') => { navigate((t === 'uebersicht' ? '/' : `/${t}`) + suche); setMehrAuf(false); window.scrollTo({ top: 0 }); };
  // Wischen auf dem iPhone: links/rechts wechselt zwischen den vier
  // Zielen der unteren Leiste. Nur waagrecht und deutlich -- sonst
  // stört es das Scrollen.
  const wischEnde = (e: React.TouchEvent) => {
    if (!wisch) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - wisch.x, dy = t.clientY - wisch.y;
    setWisch(null);
    if (Math.abs(dx) < 80 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    const i = mobileBottomTabs.indexOf(active);
    if (i < 0) return;
    const j = i + (dx < 0 ? 1 : -1);
    if (j >= 0 && j < mobileBottomTabs.length) gehe(mobileBottomTabs[j]);
  };
  const akquise = gruppen.find(g => g.titel === 'Akquise')!.eintraege.some(t => t.id === active);
  const titel = tabs.find(t => t.id === active)?.label ?? stillgelegt.find(t => t.id === active)?.label ?? '';

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
      <KeyboardShortcutsOverlay />
      <PropertyDetailDialog id={parzelle} onClose={parzelleZu} />

      {/* Schmale Leiste nur mit Symbolen, wie in der Vorlage (DESIGN.md):
          der aktive Punkt als schwarzes Quadrat. Der Name steht beim
          Überfahren daneben und für Screenreader im Knopf. */}
      <aside className="sticky top-0 hidden h-screen w-[76px] shrink-0 flex-col items-center border-r bg-card py-5 lg:flex">
        <button type="button" onClick={() => gehe('uebersicht')} aria-label="Übersicht"
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
        {(
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
                {/* Der Kanton gilt nur für die Akquise. */}
                {akquise && <div className="flex min-w-0 items-center gap-2 overflow-x-auto no-scrollbar"><CantonTabs /></div>}
                <ThemeToggle />
              </div>
            </div>
          </header>
        )}

        <div className="w-full flex-1 overflow-x-clip px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 lg:px-10 lg:pb-12 lg:pt-4 animate-fade-in" key={active}>
          <Auffang key={active} bereich={titel}>
          <Suspense fallback={
            <div className="space-y-4">
              <Skeleton className="h-10 w-1/3" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          }>
            {active === 'uebersicht' && <Uebersicht />}
            {active === 'dashboard' && <Dashboard />}
            {active === 'master' && <MasterList />}
            {active === 'nummern' && <Nummern />}
            {active === 'gebaeudesuche' && <GebaeudeSuche />}
            {active === 'pipedrive' && <PipedriveBereit />}
            {active === 'masterimport' && <MasterImport />}
            {active === 'vorauswahl' && <Vorauswahl />}
            {active === 'akquise' && <AkquiseMode />}
            {active === 'telsuche' && <TelefonSuche />}
            {active === 'properties' && <PropertyList />}
            {active === 'export' && <PipedriveExport />}
            {active === 'import' && <CsvImport />}
            {active === 'phones' && <PhoneManager />}
            {active === 'admin' && (
              <AdminZugang>
              <div className="space-y-6">
                {/* Das Lesezeichen steht oben, weil es kein
                    Einstellungswert ist, sondern ein Werkzeug, das
                    jeder einmal in seine Leiste zieht. */}
                <Lesezeichen />
                <ErweiterungHolen />

                <div className="space-y-6">
                <AdminSettings />
                <Protokoll />
                <div className="rounded-2xl border border-dashed p-5">
                  <p className="text-sm font-medium">Stillgelegte Bereiche</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Was der Ablauf inzwischen selbst erledigt. Nichts davon
                    ist gelöscht -- ein Klick öffnet es wieder.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {stillgelegt.map(t => (
                      <Button
                        key={t.id}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => gehe(t.id)}
                      >
                        <t.icon className="h-4 w-4" /> {t.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-dashed p-5">
                  <p className="text-sm font-medium">Master-Import</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Weitere Listen einlesen. Bestehende Parzellen werden nur
                    ergänzt, nie überschrieben.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-3 gap-2"
                    onClick={() => gehe('masterimport')}
                  >
                    <Upload className="h-4 w-4" /> Import öffnen
                  </Button>
                </div>
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
        {showInstallHint && (
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
