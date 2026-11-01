import { Marke, Seite } from '@/components/rahmen';
import { ImmoKalender, kalenderZahlen } from '@/components/ImmoKalender';
import { BILD } from '@/lib/luftbild';
import { zeitraum } from '@/lib/immo-kalender';

/** Der Immo-Kalender als eigener Bereich in Bauraum (/kalender). */
export function Kalender() {
  const z = kalenderZahlen();
  return (
    <Seite bild={BILD.kalender} ueber="Immo-Kalender · Schweiz und die grossen im Ausland"
      titel={`${z.anzahl} Immobilienanlässe in den nächsten Monaten`}
      unter={z.naechster ? <>Als Nächstes: <b className="font-semibold text-foreground">{z.naechster.name}</b>, {zeitraum(z.naechster)}{z.naechster.ort ? `, ${z.naechster.ort}` : ''}.</> : undefined}
      kennzahlen={[
        { titel: 'Anlässe', wert: String(z.anzahl), marke: <Marke art="lila">mit Datum</Marke> },
        { titel: 'Messen', wert: String(z.messen), marke: <Marke art="heiss">Messe</Marke> },
        { titel: 'Nächster', wert: z.tage == null ? '–' : z.tage <= 0 ? 'heute' : `${z.tage} Tage`, marke: <Marke art="minze">bis Beginn</Marke> },
        { titel: 'Datum offen', wert: String(z.offen), marke: <Marke>noch nicht publiziert</Marke> },
      ]}>
      <ImmoKalender />
    </Seite>
  );
}
