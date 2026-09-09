import { Bookmark } from 'lucide-react';
import { lesezeichenCode } from '@/lib/lesezeichen';

/**
 * Der Knopf, den man in die Lesezeichenleiste zieht.
 *
 * Er lässt sich nicht anklicken, sondern nur ziehen -- das ist keine
 * Nachlässigkeit, sondern wie Lesezeichen entstehen. Ein Klick hier
 * täte nichts Sinnvolles, weil auf dieser Seite kein Auszug steht.
 */
export function Lesezeichen() {
  const ziel = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://www.wohntraums.life';

  return (
    <div className="rounded-2xl border p-5">
      <div className="flex items-center gap-2">
        <Bookmark className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">Auskunft übernehmen — ohne Extension</p>
      </div>

      <p className="mt-1 text-sm text-muted-foreground">
        Den Knopf in die Lesezeichenleiste ziehen. Im Grundbuchportal ein
        Klick darauf, sobald die Auskunft offen ist: der Eigentümer wird
        gelesen und hier eingetragen. Die Abfrage läuft dabei über deinen
        eigenen Anschluss, nicht über einen Server.
      </p>

      <a
        href={lesezeichenCode(ziel)}
        onClick={e => e.preventDefault()}
        draggable
        className="mt-3 inline-flex cursor-grab items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
      >
        <Bookmark className="h-4 w-4" /> Bauraum: Eigentümer übernehmen
      </a>

      <p className="mt-3 text-xs text-muted-foreground">
        Erkennt es nichts, im Auszug die Zeilen mit den Eigentümern
        markieren und nochmals klicken. Wird die Leiste nicht angezeigt:
        in Chrome mit Strg+Umschalt+B (Mac: ⌘+Umschalt+B) einblenden.
      </p>
    </div>
  );
}
