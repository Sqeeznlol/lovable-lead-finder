import { useEffect, useState } from 'react';
import { Building2, LayoutDashboard, Upload, Phone, Menu, X, Zap, Search, FileSpreadsheet, Eye, Shield, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dashboard } from '@/components/Dashboard';
import { PropertyList } from '@/components/PropertyList';
import { CsvImport } from '@/components/CsvImport';
import { PhoneManager } from '@/components/PhoneManager';
import { AkquiseMode } from '@/components/AkquiseMode';
import { TelefonSuche } from '@/components/TelefonSuche';
import { PipedriveExport } from '@/components/PipedriveExport';
import { Vorauswahl } from '@/components/Vorauswahl';
import { AdminSettings } from '@/components/AdminSettings';
import { ListSelector } from '@/components/ListSelector';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CantonTabs } from '@/components/CantonTabs';
import { useCanton } from '@/hooks/use-canton';
import { usePlatform } from '@/hooks/use-platform';

type Tab = 'dashboard' | 'vorauswahl' | 'akquise' | 'telsuche' | 'properties' | 'import' | 'phones' | 'export' | 'admin';

const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'vorauswahl', label: 'Vorauswahl', icon: Eye },
  { id: 'akquise', label: 'Akquise-Modus', icon: Zap },
  { id: 'telsuche', label: 'Telefon-Suche', icon: Search },
  { id: 'properties', label: 'Liegenschaften', icon: Building2 },
  { id: 'export', label: 'Pipedrive Export', icon: FileSpreadsheet },
  { id: 'import', label: 'CSV Import', icon: Upload },
  { id: 'phones', label: 'Telefone', icon: Phone },
  { id: 'admin', label: 'Admin', icon: Shield },
];

// Primary tabs visible in the iPhone bottom bar
const mobileBottomTabs: Tab[] = ['dashboard', 'vorauswahl', 'akquise', 'telsuche', 'properties'];

export default function Index() {
  const [active, setActive] = useState<Tab>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const { current, cantons } = useCanton();
  const cantonName = cantons.find(c => c.id === current)?.name ?? '';
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

  return (
    <div className="flex min-h-safe-screen bg-background">
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-sidebar/95 backdrop-blur-xl border-r border-foreground/5 transform transition-transform lg:translate-x-0 lg:static pt-safe pb-safe pl-safe ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-7 border-b border-foreground/5">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl bg-foreground text-background grid place-items-center font-serif text-lg shadow-ceramic">
              B
            </div>
            <div>
              <h1 className="font-serif text-2xl tracking-tight text-foreground leading-none">Bauraum</h1>
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-1.5">Immobilien · Schweiz</p>
            </div>
          </div>
          <div className="mt-5">
            <ListSelector />
          </div>
        </div>
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setActive(t.id); setMobileOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium transition-all duration-300
                ${active === t.id
                  ? 'bg-card text-foreground shadow-ceramic ring-1 ring-foreground/5'
                  : 'text-muted-foreground hover:bg-card/60 hover:text-foreground'
                }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </nav>
        <div className="p-5 border-t border-foreground/5 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Theme</span>
          <ThemeToggle compact />
        </div>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />}

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-foreground/5 px-4 lg:px-8 py-3 flex items-center gap-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <Button size="icon" variant="ghost" className="lg:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <h1 className="font-serif text-xl tracking-tight text-foreground lg:hidden">Bauraum</h1>
          <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono uppercase tracking-[0.15em]">Kanton</span>
            <span className="text-foreground font-medium">{cantonName}</span>
          </div>
          <div className="flex-1 flex justify-center lg:justify-start lg:ml-6 overflow-x-auto no-scrollbar">
            <CantonTabs />
          </div>
          <div className="lg:hidden">
            <ThemeToggle compact />
          </div>
        </header>

        {/* Mobile-only sub-bar with current tab name + ListSelector */}
        <div className="lg:hidden px-4 py-2 flex items-center gap-3 border-b border-foreground/5 bg-background/60 backdrop-blur-xl">
          <span className="text-xs font-medium text-foreground truncate">
            {tabs.find(t => t.id === active)?.label}
          </span>
          <div className="ml-auto min-w-0 flex-1 max-w-[60%]">
            <ListSelector />
          </div>
        </div>

        <div className="flex-1 p-4 lg:p-12 max-w-7xl pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-12 animate-fade-in">
          {active === 'dashboard' && <Dashboard />}
          {active === 'vorauswahl' && <Vorauswahl />}
          {active === 'akquise' && <AkquiseMode />}
          {active === 'telsuche' && <TelefonSuche />}
          {active === 'properties' && <PropertyList />}
          {active === 'export' && <PipedriveExport />}
          {active === 'import' && <CsvImport />}
          {active === 'phones' && <PhoneManager />}
          {active === 'admin' && <AdminSettings />}
        </div>

        {/* iOS-style bottom tab bar (mobile only) */}
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/85 backdrop-blur-2xl border-t border-foreground/5 pb-safe"
          aria-label="Hauptnavigation"
        >
          <div className="grid grid-cols-5 px-2 pt-2">
            {mobileBottomTabs.map(id => {
              const t = tabs.find(x => x.id === id)!;
              const isActive = active === id;
              return (
                <button
                  key={id}
                  onClick={() => setActive(id)}
                  className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl transition-all ${
                    isActive ? 'text-foreground' : 'text-muted-foreground active:scale-95'
                  }`}
                >
                  <span className={`h-9 w-9 grid place-items-center rounded-2xl transition-all ${
                    isActive ? 'bg-foreground text-background shadow-ceramic' : ''
                  }`}>
                    <t.icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="text-[10px] font-medium leading-tight">{t.label.split('-')[0].split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* iOS Safari "Add to Home Screen" hint */}
        {showInstallHint && (
          <div className="lg:hidden fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] inset-x-3 z-50 animate-fade-in">
            <div className="bg-card shadow-ceramic-hover rounded-3xl p-4 border border-foreground/5 flex items-start gap-3">
              <div className="h-10 w-10 rounded-2xl bg-foreground text-background grid place-items-center font-serif shrink-0">B</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Bauraum als App installieren</p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1 flex-wrap">
                  Tippe auf <Share className="h-3.5 w-3.5 inline" /> <span>«Teilen»</span> und dann
                  <Plus className="h-3.5 w-3.5 inline" /> <span>«Zum Home-Bildschirm»</span>
                </p>
              </div>
              <button onClick={dismissInstallHint} className="text-muted-foreground hover:text-foreground p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
