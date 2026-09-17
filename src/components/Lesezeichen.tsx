import { Bookmark, PlayCircle } from 'lucide-react';
import { lesezeichenCode } from '@/lib/lesezeichen';

/**
 * Die Knöpfe, die man in die Lesezeichenleiste zieht.
 *
 * Sie lassen sich nicht anklicken, sondern nur ziehen -- das ist keine
 * Nachlässigkeit, sondern wie Lesezeichen entstehen. Ein Klick hier
 * täte nichts Sinnvolles, weil auf dieser Seite kein Auszug steht.
 *
 * Es gibt eines je Kanton, weil das Portal je Kanton ein anderes ist
 * und die Reihe aus dem jeweiligen Bestand kommt.
 */
export function Lesezeichen() {
  const ziel = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://www.wohntraums.life';

  const kantone: { kuerzel: string; name: string; portal: string }[] = [
    { kuerzel: 'TG', name: 'Thurgau', portal: 'ThurGIS' },
    { kuerzel: 'ZH', name: 'Zürich', portal: 'GIS-Browser' },
  ];

  return (
    <div className="space-y-4 rounded-2xl border p-5">
      <div>
        <div className="flex items-center gap-2">
          <PlayCircle className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">Zwanzig am Stück abfragen</p>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Den Knopf des Kantons in die Lesezeichenleiste <b>ziehen</b> (nicht
          klicken). Dann im Portal einmal per SMS bestätigen — und einmal
          auf das Lesezeichen klicken. Es holt sich die zwanzig
          Grundstücke mit dem grössten Potenzial und arbeitet sie der
          Reihe nach ab: suchen, Eigentümer lesen, hier eintragen,
          weiter. Was es nicht eindeutig lesen kann, überspringt es,
          statt etwas Falsches einzutragen.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Die Abfragen laufen über den eigenen Anschluss und über die
          eigene Bestätigung — nichts davon geschieht auf einem Server,
          und mehr als die zwanzig, die das Portal freigibt, werden es
          nicht.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {kantone.map(k => (
          <a
            key={k.kuerzel}
            href={lesezeichenCode(ziel, k.kuerzel)}
            onClick={e => e.preventDefault()}
            draggable
            className="inline-flex cursor-grab items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            <Bookmark className="h-4 w-4" /> Bauraum: {k.kuerzel} abfragen
          </a>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Steht schon ein Auszug auf dem Schirm, übernimmt ein Klick nur
        diesen einen — die Reihe fängt erst an, wenn keiner dasteht.
        Erkennt es nichts, im Auszug die Zeilen mit den Eigentümern
        markieren und nochmals klicken. Wird die Leiste nicht angezeigt:
        in Chrome mit Strg+Umschalt+B (Mac: ⌘+Umschalt+B) einblenden.
      </p>
    </div>
  );
}
