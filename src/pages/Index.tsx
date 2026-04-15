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

  return (
    <div className="flex min-h-screen">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform lg:translate-x-0 lg:static ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Sqeeztraum
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Immobilien-Akquise CRM</p>
          <div className="mt-3">
            <ListSelector />
          </div>
        </div>
        <nav className="p-3 space-y-1 flex-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setActive(t.id); setMobileOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${active === t.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </nav>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />}

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b px-6 py-3 flex items-center gap-4 lg:hidden">
          <Button size="icon" variant="ghost" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <h1 className="font-bold text-lg bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Sqeeztraum</h1>
        </header>
        <div className="p-6 lg:p-10 max-w-7xl">
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
