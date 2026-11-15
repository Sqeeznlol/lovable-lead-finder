import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { bezuegeLaden } from '@/lib/bezuege';

export function Bezuege({ parzelleId, egrid }: { parzelleId: string; egrid: string | null }) {
  const nav = useNavigate();
  const { data } = useQuery({
    queryKey: ['bezuege', parzelleId, egrid],
    queryFn: () => bezuegeLaden(parzelleId, egrid),
    staleTime: 60_000,
  });
  // Ohne Bezug kein Kasten: ein leerer Block sähe aus wie ein Fehler.
  if (!data?.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-lg">In Aurora</h3>
      <div className="divide-y rounded-lg border">
        {data.map((b, i) => {
          const inhalt = (
            <>
              <span className="w-24 shrink-0 text-muted-foreground">{b.art}</span>
              <span className="min-w-0 flex-1 truncate">{b.text}</span>
              {b.neben && <span className="shrink-0 text-xs text-muted-foreground">{b.neben}</span>}
            </>
          );
          return b.ziel ? (
            <button key={i} type="button" onClick={() => nav(b.ziel!)}
                    className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50">
              {inhalt}
            </button>
          ) : (
            <div key={i} className="flex min-h-11 items-center gap-3 px-3 py-2 text-sm">{inhalt}</div>
          );
        })}
      </div>
    </div>
  );
}
