import { ExternalLink } from 'lucide-react';
import { KNOPF, KNOPF_HAUPT } from '@/components/rahmen';
import { FENSTER } from '@/lib/fenster';
import { belege, nichtMehrOeffentlich, type Gesuch } from '@/lib/baugesuch-belege';
import { parzelleLink, projektSatz, projektZaehlt, registerLink, type Projekt } from '@/lib/bauprojekt';

const datum = (s: string) => new Date(s.slice(0, 10) + 'T00:00:00').toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Was auf der Parzelle schon geplant ist, über jeder eigenen Rechnung
 * (Julian, 18. November: «lueg dass bi publizierte Baugsuech mit eme
 * Button ufs Projekt zuegriffe werde chan. Nöd das Aurora rechnet und
 * debi gits es bewilligts Projekt mit anderne Zahle»).
 *
 * Zwei Quellen: das Gebäuderegister (projektierte, bewilligte und
 * begonnene Bauten mit ihren Zahlen, auch für Gesuche, die älter sind als
 * die geladenen) und das letzte Baugesuch auf der Parzelle. Der Knopf
 * führt aufs Amtsblatt, solange es die Publikation zeigt, danach auf den
 * Eintrag im Register.
 */
export function ProjektHinweis({ projekt, gesuch, wo = 'Die Rechnung' }: { projekt: Projekt | null | undefined; gesuch?: Gesuch | null; wo?: string }) {
  if (!projekt && !gesuch) return null;
  const links = gesuch ? belege(gesuch) : [];
  const publikation = links.find(l => l.titel === 'Publikation im Amtsblatt');
  const pdf = links.find(l => l.titel === 'Publikation als PDF');
  const bau = projekt?.bauten.find(b => b.id && b.wohnungen) ?? projekt?.bauten.find(b => b.id);
  const register = bau?.id ? registerLink(bau.id) : gesuch?.egrid ? parzelleLink(gesuch.egrid) : null;
  const vorbei = gesuch ? nichtMehrOeffentlich(gesuch) : null;
  const haupt = publikation?.url ?? register;
  const zaehlt = projektZaehlt(projekt);

  return (
    <section aria-label="Projekt auf dieser Parzelle" className="space-y-3 rounded-[3px] border border-accent/40 bg-accent/5 p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Projekt auf dieser Parzelle</p>
      {projekt ? (
        <p className="text-lg leading-snug">{projektSatz(projekt)}.</p>
      ) : (
        <p className="text-lg leading-snug">Baugesuch vom {datum(gesuch!.publiziert_am)}{gesuch!.beschreibung ? `: ${gesuch!.beschreibung}` : ''}</p>
      )}
      <p className="text-sm text-muted-foreground">
        {projekt && <>Gebäuderegister des Bundes{projekt.stand ? `, Stand ${projekt.stand}` : ''}. </>}
        {zaehlt ? `${wo} rechnet mit diesen Zahlen, nicht mit der Formel.`
          : projekt ? 'Noch nicht bewilligt: gerechnet wird nach der Formel, das Projekt zeigt, was der Eigentümer plant.'
          : `${wo} kennt die Zahlen des Gesuchs nicht${haupt ? ': zuerst das Projekt ansehen' : ''}.`}
      </p>
      {projekt && gesuch && (
        <p className="text-sm">Baugesuch vom {datum(gesuch.publiziert_am)}{gesuch.beschreibung ? `: ${gesuch.beschreibung}` : ''}</p>
      )}
      {haupt && (
        <div className="flex flex-wrap gap-2 print:hidden">
          <a className={KNOPF_HAUPT} href={haupt} target={FENSTER.portal}><ExternalLink className="h-4 w-4" /> Projekt ansehen</a>
          {pdf && <a className={KNOPF} href={pdf.url} target={FENSTER.portal}>Publikation als PDF</a>}
          {publikation && register && <a className={KNOPF} href={register} target={FENSTER.portal}>Im Gebäuderegister</a>}
        </div>
      )}
      {vorbei && gesuch?.publikation_id && (
        <p className="text-xs text-muted-foreground">
          Das Amtsblatt zeigte die Publikation bis {datum(vorbei)}; Pläne und Bewilligung liegen bei der Gemeinde{gesuch.gemeinde ? ` ${gesuch.gemeinde}` : ''}.
        </p>
      )}
    </section>
  );
}
