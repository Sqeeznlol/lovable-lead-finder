import { lazy, Suspense, useEffect, useState } from 'react';
import { Building2, LayoutDashboard, Upload, Phone, X, Zap, Search, FileSpreadsheet, Eye, Shield, Share, Plus, Database, Send, Map, Target, BarChart3, Gauge, HardHat, MoreHorizontal, Briefcase } from 'lucide-react';
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
const Auswertung = lazy(() => import('@/components/Auswertung').then(m => ({ default: m.Auswertung })));
const Cockpit = lazy(() => import('@/components/Cockpit').then(m => ({ default: m.Cockpit })));
const Baugesuche = lazy(() => import('@/components/Baugesuche').then(m => ({ default: m.Baugesuche })));
const Gelegenheiten = lazy(() => import('@/components/Gelegenheiten').then(m => ({ default: m.Gelegenheiten })));
const Nachbarschaft = lazy(() => import('@/components/Nachbarschaft').then(m => ({ default: m.Nachbarschaft })));
// Die Karte zieht Leaflet nach -- das gehoert nicht ins erste
// Buendel, sondern wird geholt, wenn jemand den Reiter oeffnet.
const Karte = lazy(() => import('@/components/Karte').then(m => ({ default: m.Karte })));
// Was nur ein Reiter braucht, kommt erst mit dem Reiter: das erste
// Bündel trägt nur den Rahmen und das Cockpit.
const Zentrale = lazy(() => import('@/components/Zentrale').then(m => ({ default: m.Zentrale })));
const Nummern = lazy(() => import('@/components/Nummern').then(m => ({ default: m.Nummern })));
const PipedriveBereit = lazy(() => import('@/components/PipedriveBereit').then(m => ({ default: m.PipedriveBereit })));
const Protokoll = lazy(() => import('@/components/Protokoll').then(m => ({ default: m.Protokoll })));
const Anmeldungen = lazy(() => import('@/components/Anmeldungen').then(m => ({ default: m.Anmeldungen })));
const Teams = lazy(() => import('@/components/Teams').then(m => ({ default: m.Teams })));
const Lesezeichen = lazy(() => import('@/components/Lesezeichen').then(m => ({ default: m.Lesezeichen })));
const ErweiterungHolen = lazy(() => import('@/components/ErweiterungHolen').then(m => ({ default: m.ErweiterungHolen })));
const AdminSettings = lazy(() => import('@/components/AdminSettings').then(m => ({ default: m.AdminSettings })));
import { CantonTabs } from '@/components/CantonTabs';
import { KeyboardShortcutsOverlay } from '@/components/KeyboardShortcutsOverlay';
import { AdminZugang } from '@/components/AdminZugang';
import { Auffang } from '@/components/Auffang';
import { AuskunftAusLesezeichen } from '@/components/AuskunftAusLesezeichen';
import { useAuth } from '@/hooks/use-auth';
import { usePlatform } from '@/hooks/use-platform';
import { useMidnightReset } from '@/hooks/use-phones';

type Tab = 'cockpit' | 'zentrale' | 'baugesuche' | 'pipedrive' | 'nummern' | 'karte' | 'nachbarschaft' | 'gelegenheiten' | 'auswertung' | 'uebersicht' | 'dashboard' | 'master' | 'vorauswahl' | 'akquise' | 'telsuche' | 'properties' | 'import' | 'masterimport' | 'phones' | 'export' | 'admin';

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
const gruppen: { titel: string; eintraege: Eintrag[] }[] = [
  { titel: 'Heute', eintraege: [
    { id: 'cockpit', label: 'Cockpit', icon: Gauge },
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
  ] },
  { titel: 'Akquise', eintraege: [
    { id: 'uebersicht', label: 'Übersicht', icon: LayoutDashboard },
    { id: 'master', label: 'Abfrage', icon: Database },
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
const mobileBottomTabs: Tab[] = ['cockpit', 'zentrale', 'karte', 'gelegenheiten'];

export default function Index() {
  const [active, setActive] = useState<Tab>('cockpit');
  const [mehrAuf, setMehrAuf] = useState(false);
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

  const gehe = (t: Tab) => { setActive(t); setMehrAuf(false); window.scrollTo({ top: 0 }); };
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
  const karteAktiv = active === 'karte';
  const akquise = gruppen.find(g => g.titel === 'Akquise')!.eintraege.some(t => t.id === active);
  const titel = tabs.find(t => t.id === active)?.label ?? stillgelegt.find(t => t.id === active)?.label ?? '';

  return (
    <div className="flex min-h-safe-screen bg-background">
      <KeyboardShortcutsOverlay />

      {/* Seitenleiste: hell, in Gruppen, nur auf grossen Bildschirmen. */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-card lg:flex">
        <div className="px-6 pb-4 pt-7">
          <p className="text-xl font-bold tracking-tight">Aurora</p>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">Immobilien-Plattform · Schweiz</p>
        </div>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2" aria-label="Hauptnavigation">
          {gruppen.map(g => (
            <div key={g.titel}>
              <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.titel}</p>
              {g.eintraege.map(t => (
                <button key={t.id} type="button" onClick={() => gehe(t.id)}
                        aria-current={active === t.id ? 'page' : undefined}
                        className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
                          active === t.id ? 'bg-foreground text-background' : 'text-foreground/80 hover:bg-secondary'}`}>
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="flex items-center justify-between border-t px-6 py-4">
          <span className="truncate text-sm text-muted-foreground">{konto}</span>
          <button type="button" onClick={() => void signOut()} className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Abmelden
          </button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col" onTouchStart={e => setWisch({ x: e.touches[0].clientX, y: e.touches[0].clientY })} onTouchEnd={wischEnde}>
        {/* Kopfzeile: der Kanton gilt für die Akquise-Bereiche. */}
        {!karteAktiv && (
          <header className={`sticky top-0 z-30 flex items-center gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur-xl pt-[max(0.75rem,env(safe-area-inset-top))] lg:px-10 ${akquise ? '' : 'lg:hidden'}`}>
            {/* Auf dem Desktop steht der Titel als Überschrift der Seite; hier nur auf dem iPhone, sonst doppelt. */}
            <span className="text-base font-bold lg:hidden">{titel}</span>
            {/* Der Kanton gilt nur für die Akquise -- über Cockpit oder
                Baugesuchen stand er da und tat nichts. */}
            {akquise && (
              <div className="ml-auto flex items-center gap-2 overflow-x-auto no-scrollbar">
                <CantonTabs />
              </div>
            )}
          </header>
        )}

        <div className={karteAktiv ? 'flex-1' : `w-full flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 lg:px-10 lg:pb-12 lg:pt-10 animate-fade-in`} key={active}>
          <Auffang key={active} bereich={titel}>
          <Suspense fallback={
            <div className="space-y-4">
              <Skeleton className="h-10 w-1/3" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          }>
            {active === 'cockpit' && <Cockpit onGehe={z => setActive(z)} />}
            {active === 'zentrale' && <Zentrale />}
            {active === 'baugesuche' && <Baugesuche />}
            {active === 'uebersicht' && <Uebersicht />}
            {active === 'dashboard' && <Dashboard />}
            {active === 'master' && <MasterList />}
            {active === 'nummern' && <Nummern />}
            {active === 'karte' && <Karte onSchliessen={() => setActive('cockpit')} />}
            {active === 'nachbarschaft' && <Nachbarschaft />}
            {active === 'gelegenheiten' && <Gelegenheiten />}
            {active === 'auswertung' && <Auswertung />}
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
                {/* Wer war von wo da -- das Erste, was der Admin sieht. */}
                <Anmeldungen />
                {/* Wer welchen Kunden sieht -- die Grenze zieht die Datenbank. */}
                <Teams />
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
                        onClick={() => setActive(t.id)}
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
                    onClick={() => setActive('masterimport')}
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
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/90 backdrop-blur-2xl pb-safe lg:hidden" aria-label="Hauptnavigation">
          <div className="grid grid-cols-5 px-1 pt-1.5">
            {[...mobileBottomTabs.map(id => tabs.find(x => x.id === id)!), { id: 'mehr' as const, label: 'Mehr', icon: MoreHorizontal }].map(t => {
              const an = t.id === 'mehr' ? mehrAuf : active === t.id && !mehrAuf;
              return (
                <button key={t.id} type="button"
                        onClick={() => (t.id === 'mehr' ? setMehrAuf(v => !v) : gehe(t.id as Tab))}
                        className={`flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold transition-colors ${an ? 'text-foreground' : 'text-muted-foreground'}`}>
                  <span className={`grid h-8 w-12 place-items-center rounded-full transition-colors ${an ? 'bg-secondary' : ''}`}>
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
            <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" />
            <div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-3xl bg-card px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-3 animate-fade-in"
                 onClick={e => e.stopPropagation()}>
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
              {gruppen.map(g => (
                <div key={g.titel} className="mb-4">
                  <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.titel}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {g.eintraege.map(t => (
                      <button key={t.id} type="button" onClick={() => gehe(t.id)}
                              className={`flex h-12 items-center gap-3 rounded-xl border px-3 text-sm font-medium ${active === t.id ? 'border-foreground bg-foreground text-background' : 'bg-card'}`}>
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

        {/* iOS Safari: "Zum Home-Bildschirm" */}
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
