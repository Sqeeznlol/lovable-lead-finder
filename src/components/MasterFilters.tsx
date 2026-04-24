import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { MasterFilters as Filters } from '@/hooks/use-master';
import { useDistinctValues } from '@/hooks/use-master';

interface Props {
  filters: Filters;
  onChange: (next: Filters) => void;
  scope?: 'master' | 'akquise' | 'vorwahl';
}

const akquiseStatuses = [
  'Neu', 'In Prüfung', 'Interessant', 'Nicht interessant', 'Eigentümer gesucht',
  'Eigentümer gefunden', 'Eigentümer ermittelt', 'Telefonnummer gesucht', 'Telefon gefunden',
  'Kontaktiert', 'Kein Interesse', 'Interesse vorhanden', 'Termin vereinbart',
  'Follow-up', 'Exportiert', 'Archiviert',
];
const preselectionStatuses = [
  'Nicht geprüft', 'Sehr interessant', 'Potenzial vorhanden',
  'Später prüfen', 'Kein Potenzial', 'Ausschliessen',
];

export function MasterFiltersBar({ filters, onChange, scope = 'master' }: Props) {
  const update = (patch: Partial<Filters>) => onChange({ ...filters, ...patch, page: 0 });
  const { data: zones } = useDistinctValues('zone');
  const { data: kategorien } = useDistinctValues('kategorie');
  const { data: bezirke } = useDistinctValues('bezirk');
  const { data: sources } = useDistinctValues('source_file');

  const reset = () => onChange({ page: 0, pageSize: filters.pageSize });

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="space-y-1.5 col-span-2 lg:col-span-2">
          <Label className="text-xs">Suche</Label>
          <Input
            placeholder="Adresse, EGRID, Eigentümer, Parzelle…"
            value={filters.search ?? ''}
            onChange={e => update({ search: e.target.value || undefined })}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Bezirk</Label>
          <Select value={filters.bezirk ?? 'all'} onValueChange={v => update({ bezirk: v === 'all' ? null : v })}>
            <SelectTrigger><SelectValue placeholder="Alle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              {bezirke?.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Zone</Label>
          <Select value={filters.zone ?? 'all'} onValueChange={v => update({ zone: v === 'all' ? null : v })}>
            <SelectTrigger><SelectValue placeholder="Alle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              {zones?.slice(0, 100).map(z => <SelectItem key={z} value={z}>{z}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Kategorie</Label>
          <Select value={filters.kategorie ?? 'all'} onValueChange={v => update({ kategorie: v === 'all' ? null : v })}>
            <SelectTrigger><SelectValue placeholder="Alle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              {kategorien?.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Quelle</Label>
          <Select value={filters.source ?? 'all'} onValueChange={v => update({ source: v === 'all' ? null : v })}>
            <SelectTrigger><SelectValue placeholder="Alle" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              {sources?.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <NumberRange
          label="Baujahr"
          from={filters.baujahrVon ?? null}
          to={filters.baujahrBis ?? null}
          onChange={(a, b) => update({ baujahrVon: a, baujahrBis: b })}
        />
        <NumberRange
          label="Renovation"
          from={filters.renovationVon ?? null}
          to={filters.renovationBis ?? null}
          onChange={(a, b) => update({ renovationVon: a, renovationBis: b })}
        />
        <NumberRange
          label="Grundstück m²"
          from={filters.areaMin ?? null}
          to={filters.areaMax ?? null}
          onChange={(a, b) => update({ areaMin: a, areaMax: b })}
        />
        <NumberRange
          label="Gebäude m²"
          from={filters.gebFlaecheMin ?? null}
          to={filters.gebFlaecheMax ?? null}
          onChange={(a, b) => update({ gebFlaecheMin: a, gebFlaecheMax: b })}
        />
        <NumberRange
          label="HNF m²"
          from={filters.hnfMin ?? null}
          to={filters.hnfMax ?? null}
          onChange={(a, b) => update({ hnfMin: a, hnfMax: b })}
        />
        <div className="space-y-1.5">
          <Label className="text-xs">PLZ</Label>
          <Input
            inputMode="numeric"
            placeholder="z.B. 8001"
            value={filters.plz ?? ''}
            onChange={e => update({ plz: e.target.value || null })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {scope !== 'vorwahl' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Akquise-Status</Label>
            <Select value={filters.status ?? 'all'} onValueChange={v => update({ status: v === 'all' ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {akquiseStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {scope !== 'akquise' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Vorwahl</Label>
            <Select value={filters.preselection ?? 'all'} onValueChange={v => update({ preselection: v === 'all' ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {preselectionStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs">Eigentümer</Label>
          <Select value={filters.withOwner ?? 'all'} onValueChange={v => update({ withOwner: v as 'all' | 'mit' | 'ohne' })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="mit">Gefunden</SelectItem>
              <SelectItem value="ohne">Fehlt</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Telefon</Label>
          <Select value={filters.withPhone ?? 'all'} onValueChange={v => update({ withPhone: v as 'all' | 'mit' | 'ohne' })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="mit">Vorhanden</SelectItem>
              <SelectItem value="ohne">Fehlt</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Kontaktiert</Label>
          <Select value={filters.contacted ?? 'all'} onValueChange={v => update({ contacted: v as 'all' | 'mit' | 'ohne' })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="mit">Ja</SelectItem>
              <SelectItem value="ohne">Nein</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Notiz</Label>
          <Select value={filters.hasNote ?? 'all'} onValueChange={v => update({ hasNote: v as 'all' | 'mit' | 'ohne' })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle</SelectItem>
              <SelectItem value="mit">Vorhanden</SelectItem>
              <SelectItem value="ohne">Fehlt</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-2 border-t">
        <ToggleSwitch
          label="Exportierte ausblenden"
          checked={!!filters.hideExported}
          onChange={v => update({ hideExported: v })}
        />
        <ToggleSwitch
          label="Eigentümer-bekannt ausblenden"
          checked={!!filters.hideOwnerFound}
          onChange={v => update({ hideOwnerFound: v })}
        />
        <ToggleSwitch
          label="Nur Follow-ups fällig"
          checked={!!filters.followUpDue}
          onChange={v => update({ followUpDue: v })}
        />
        <Button size="sm" variant="ghost" className="ml-auto" onClick={reset}>
          <X className="h-3.5 w-3.5 mr-1" /> Zurücksetzen
        </Button>
      </div>
    </div>
  );
}

function NumberRange({
  label, from, to, onChange,
}: { label: string; from: number | null; to: number | null; onChange: (a: number | null, b: number | null) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-1.5">
        <Input inputMode="numeric" placeholder="von" className="text-sm"
          value={from ?? ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : null, to)} />
        <Input inputMode="numeric" placeholder="bis" className="text-sm"
          value={to ?? ''} onChange={e => onChange(from, e.target.value ? Number(e.target.value) : null)} />
      </div>
    </div>
  );
}

function ToggleSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <Switch checked={checked} onCheckedChange={onChange} />
      <span>{label}</span>
    </label>
  );
}