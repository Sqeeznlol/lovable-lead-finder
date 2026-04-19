import { useState } from 'react';
import { Building2, LayoutDashboard, Upload, Phone, Menu, X, Zap, Search, FileSpreadsheet, Eye, Shield } from 'lucide-react';
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

export default function Index() {
  const [active, setActive] = useState<Tab>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const { current, cantons } = useCanton();
  const cantonName = cantons.find(c => c.id === current)?.name ?? '';

  return (
    <div className="flex min-h-screen bg-background">
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-sidebar/95 backdrop-blur-xl border-r border-foreground/5 transform transition-transform lg:translate-x-0 lg:static ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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
        <nav className="p-4 space-y-1 flex-1">
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

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-foreground/5 px-4 lg:px-8 py-3 flex items-center gap-3">
          <Button size="icon" variant="ghost" className="lg:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <h1 className="font-serif text-xl tracking-tight text-foreground lg:hidden">Bauraum</h1>
          <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono uppercase tracking-[0.15em]">Kanton</span>
            <span className="text-foreground font-medium">{cantonName}</span>
          </div>
          <div className="flex-1 flex justify-center lg:justify-start lg:ml-6">
            <CantonTabs />
          </div>
          <div className="lg:hidden">
            <ThemeToggle compact />
          </div>
        </header>
        <div className="p-6 lg:p-12 max-w-7xl animate-fade-in">
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
      </main>
    </div>
  );
}
