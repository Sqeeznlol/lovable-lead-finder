import type { ReactNode } from 'react';
import { useUrlSetzen } from '@/hooks/use-url-wert';

/**
 * Eine Adresse, die das Objekt öffnet (?parzelle=..., die eine
 * Objektansicht in Index.tsx). Prüfung der Abläufe, 1. November: in den
 * meisten Bereichen stand die Adresse als blosser Text da, und wer
 * weiterarbeiten wollte, musste sie von Hand suchen.
 */
export function ObjektLink({ id, children, className = '' }: { id: string | null | undefined; children: ReactNode; className?: string }) {
  const setzen = useUrlSetzen();
  if (!id) return <span className={className}>{children}</span>;
  return (
    <button type="button" onClick={e => { e.stopPropagation(); setzen({ parzelle: id }); }}
            className={`min-w-0 text-left underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none ${className}`}>
      {children}
    </button>
  );
}
