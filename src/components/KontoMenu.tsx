import * as M from '@radix-ui/react-dropdown-menu';
import { Building2, Check, ChevronDown, LogOut, Orbit } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export interface Gesellschaft { id: string; name: string; gesellschaft: string | null; fonds: number; konten: string[] }

/** Die Fondsleitungen für unsere Konten; ein Fondsmanager bekommt eine leere Liste (Datenbank). */
export function useGesellschaften() {
  return useQuery({
    queryKey: ['fonds-gesellschaften'],
    queryFn: async (): Promise<Gesellschaft[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = await (supabase as any).rpc('fonds_gesellschaften');
      return r.error ? [] : (r.data as Gesellschaft[]);
    },
    staleTime: 5 * 60 * 1000,
  });
}

const PUNKT = 'flex min-h-11 cursor-pointer select-none items-center gap-3 rounded-[2px] px-3 py-2 text-left text-[15px] outline-none data-[highlighted]:bg-secondary';

/**
 * Das Konto oben rechts. Julian (1. November): dort, wo Konto und Mail
 * stehen, auch die Fondsleitungen mit ihren Adressen -- ein Klick, und
 * man sieht Wohntraums genau so, wie diese Leitung es sieht. Nur
 * Wohntraums, ohne Pipedrive, Verwaltung und den Rest.
 *
 * `aktiv` ist die Leitung, die gerade angezeigt wird (auf /fonds).
 */
export function KontoMenu({ aktiv, nurSymbol = false }: { aktiv?: string | null; nurSymbol?: boolean }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: leitungen = [] } = useGesellschaften();
  const konto = user?.email?.split('@')[0] ?? '';

  return (
    <M.Root>
      <M.Trigger aria-label="Konto und Fondsleitungen"
        className="group flex h-11 shrink-0 items-center gap-2 rounded-[3px] px-2 text-left outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-secondary">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-foreground text-sm font-semibold uppercase text-background">{konto.slice(0, 1) || '?'}</span>
        {!nurSymbol && (
          <span className="hidden min-w-0 leading-tight lg:block">
            <span className="block max-w-[180px] truncate text-[15px] font-semibold">{konto}</span>
            <span className="block max-w-[180px] truncate text-xs text-muted-foreground">{user?.email}</span>
          </span>
        )}
        <ChevronDown className="hidden h-4 w-4 shrink-0 text-muted-foreground lg:block transition-transform duration-150 group-data-[state=open]:rotate-180" />
      </M.Trigger>
      <M.Portal>
        <M.Content align="end" sideOffset={8} collisionPadding={12}
          className="z-[1200] w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-[3px] border bg-card p-1 text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.12)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95">
          <M.Item className={PUNKT} onSelect={() => navigate('/')}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[3px] bg-secondary"><Building2 className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate font-semibold">Bauraum · {konto}</span>
              <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
            </span>
            {!aktiv && <Check className="h-4 w-4 shrink-0 text-accent" />}
          </M.Item>

          {leitungen.length > 0 && (
            <>
              <M.Separator className="my-1 h-px bg-border" />
              <M.Label className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Wohntraums · als Fondsleitung ansehen</M.Label>
              {leitungen.map(l => (
                <M.Item key={l.id} className={PUNKT} onSelect={() => navigate(`/fonds?als=${l.id}`)}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[3px] bg-foreground text-background"><Orbit className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate font-semibold">{l.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {l.konten[0] ?? 'noch kein Konto'}{l.konten.length > 1 ? ` +${l.konten.length - 1}` : ''} · {l.fonds} Fonds
                    </span>
                  </span>
                  {aktiv === l.id && <Check className="h-4 w-4 shrink-0 text-accent" />}
                </M.Item>
              ))}
            </>
          )}

          <M.Separator className="my-1 h-px bg-border" />
          <M.Item className={PUNKT} onSelect={() => void signOut()}>
            <span className="grid h-9 w-9 shrink-0 place-items-center"><LogOut className="h-4 w-4" /></span>
            Abmelden
          </M.Item>
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}
