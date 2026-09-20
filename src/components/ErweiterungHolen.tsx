import { Puzzle, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';
import { FENSTER } from '@/lib/fenster';
import { Button } from '@/components/ui/button';
import { useExtensionAvailable } from '@/hooks/use-eigentuemer-lookup';
import { useState } from 'react';

/**
 * Wo die Erweiterung liegt und wie sie hineinkommt.
 *
 * Ohne sie bleibt ein Klick im Portal nötig: eine Seite darf in eine
 * fremde Seite kein Skript schicken. Das ist eine Regel des Browsers,
 * keine Frage der Mühe -- und der Grund, warum die Reihe erst mit der
 * Erweiterung ganz aus der Übersicht heraus läuft.
 *
 * Chrome nimmt einen Ordner, kein ZIP: deshalb entpacken, bevor man
 * lädt. Das ist die Stelle, an der es üblicherweise klemmt.
 */
const PAKET = 'https://github.com/Sqeeznlol/lovable-lead-finder/actions/workflows/extension.yml';

export function ErweiterungHolen() {
  const da = useExtensionAvailable();
  const [probe, setProbe] = useState<string | null>(null);

  // Ein Probeauftrag ohne Grundstueck: er zeigt, ob die Erweiterung
  // zuhoert. Passiert nichts, liegt es nicht am Bestand und nicht am
  // Portal, sondern an der Erweiterung selbst -- und man sucht nicht
  // an der falschen Stelle.
  const probelauf = () => {
    setProbe('Auftrag geschickt — geht gleich ein Fenster auf?');
    window.dispatchEvent(new CustomEvent('akquise-start-reihe', {
      detail: { objekte: [{ propertyId: 'probe', egrid: 'CH627728290920', kanton: 'TG', bfsNr: '', address: 'Probe' }] },
    }));
  };

  return (
    <div className="rounded-2xl border p-5">
      <div className="flex items-center gap-2">
        <Puzzle className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">Erweiterung: die Reihe ganz ohne Klicken</p>
        <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
          da ? 'bg-emerald-600/15 text-emerald-600' : 'bg-destructive/15 text-destructive'
        }`}>
          {da
            ? <><CheckCircle2 className="h-3 w-3" /> erkannt</>
            : <><XCircle className="h-3 w-3" /> nicht erkannt</>}
        </span>
      </div>

      {da && (
        <div className="mt-3 rounded-xl border bg-muted/30 p-3">
          <p className="text-sm">
            Die Erweiterung läuft. In „Heute nachschlagen" steht jetzt
            oben rechts das Feld <b>Anzahl</b> und der Knopf <b>Reihe
            abfragen</b>.
          </p>
          <Button size="sm" variant="outline" className="mt-2" onClick={probelauf}>
            Probeauftrag schicken
          </Button>
          {probe && <p className="mt-2 text-xs text-muted-foreground">{probe}</p>}
        </div>
      )}

      <p className="mt-1 text-sm text-muted-foreground">
        Mit ihr steht in der Übersicht ein Feld für die Anzahl und der
        Knopf <b>Reihe abfragen</b>: eintragen, klicken, und das Portal
        wird geöffnet, ausgelesen, eingetragen — und weiter zum
        nächsten. Ohne sie bleibt der eine Klick auf das Lesezeichen im
        Portal, weil eine Seite in eine fremde Seite nichts schicken
        darf.
      </p>

      <ol className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        <li>
          <b>1.</b> Beim <a
            href={PAKET}
            target={FENSTER.portal}
            className="underline underline-offset-4"
          >
            Ablauf „Extension packen" <ExternalLink className="inline h-3 w-3" />
          </a> den obersten Lauf öffnen und unter <b>Artifacts</b> die
          Datei <code>extension-2.0.0.zip</code> laden.
        </li>
        <li><b>2.</b> Die Datei <b>entpacken</b> — Chrome will den Ordner, nicht das ZIP.</li>
        <li><b>3.</b> In Chrome <code>chrome://extensions</code> öffnen, oben rechts <b>Entwicklermodus</b> einschalten.</li>
        <li><b>4.</b> <b>Entpackte Erweiterung laden</b> und den entpackten Ordner wählen.</li>
        <li><b>5.</b> Diese Seite neu laden — dann steht der Knopf in der Übersicht.</li>
      </ol>

      <p className="mt-3 text-xs text-muted-foreground">
        Beim ersten Mal mit <b>Anzahl 2</b> anfangen, nicht mit zehn.
        Dann sieht man an zwei Abfragen, ob richtig zugeordnet wird,
        ohne zehn des Tageskontingents zu riskieren.
      </p>
    </div>
  );
}
