import { describe, expect, it } from 'vitest';
import { eintragKurz, istOereb, oerebLesen } from '@/lib/oereb';

/**
 * Julian, 23. November, zum ÖREB-Auszug eines Grundstücks: «das auch
 * einpflegen». Aufgebaut wie ein echter Auszug des Kantons Zürich, mit
 * erfundenen Zahlen.
 */
const TEXT = `Auszug aus dem Kataster der öffentlich-
rechtlichen Eigentumsbeschränkungen
(ÖREB-Kataster)
Grundstück-Nr. 999
Grundstückart Liegenschaft
E-GRID CH000000000999
Gemeinde (BFS-Nr.) Musterdorf (9999)
Fläche 2'000 m²
Erstellungsdatum des Auszugs 01.02.2026
01.02.2026 00:00:00 1 Seite 3/9
Nutzungsplanung (kantonal/kommunal): Grundnutzungen
Rechtskräftig
Typ Anteil Anteil in %
Legende beteiligter Objekte Die Zone W/2.5 ist für Wohnbauten und nicht  1800 m² 90 %
störende Betriebe bestimmt. (W/2.5)
Wald () 200 m² 10 %
Übrige Legende (im sichtbaren Bereich) Die Zone Oe ist für Anlagen
Rechtsvorschriften Genehmigung vom 1. Januar 2005
01.02.2026 00:00:00 1 Seite 4/9
Nutzungsplanung (kantonal/kommunal): überlagernde
Nutzungen
Änderung mit Vorwirkung
Typ Anteil Anteil in %
Legende beteiligter Objekte Arealüberbauung zulässig 3000 m² * 150 % *
01.02.2026 00:00:00 1 Seite 5/9
Gewässerraum
Rechtskräftig
Typ Anteil Anteil in %
Legende beteiligter Objekte Gewässerraum (in Kraft) 300 m² 15 %
Übrige Legende (im sichtbaren Bereich)
01.02.2026 00:00:00 1 Seite 6/9
Baulinien (kantonal/kommunal)
Rechtskräftig
Typ Anteil Anteil in %
Legende beteiligter Objekte Baulinie.Verkehr, kommunal 40 m
Rechtsvorschriften`;

describe('ÖREB-Auszug lesen', () => {
  it('erkennt den Auszug und liest Grundstück, E-GRID, Gemeinde, Fläche und Datum', () => {
    expect(istOereb(TEXT)).toBe(true);
    expect(istOereb('Markt- und Mietwertgutachten')).toBe(false);
    expect(oerebLesen(TEXT)).toMatchObject({ grundstueckNr: '999', egrid: 'CH000000000999', gemeinde: 'Musterdorf', flaeche: 2000, datum: '2026-02-01' });
  });

  it('je Thema die betroffenen Flächen, mit Stand und umgebrochenem Namen', () => {
    const t = oerebLesen(TEXT).themen;
    expect(t.map(x => [x.thema, x.stand])).toEqual([
      ['Nutzungsplanung (kantonal/kommunal): Grundnutzungen', 'Rechtskräftig'],
      ['Nutzungsplanung (kantonal/kommunal): überlagernde Nutzungen', 'Änderung mit Vorwirkung'],
      ['Gewässerraum', 'Rechtskräftig'],
      ['Baulinien (kantonal/kommunal)', 'Rechtskräftig'],
    ]);
    expect(t[0].eintraege.map(e => [eintragKurz(e), e.wert, e.einheit, e.anteil])).toEqual([['W/2.5', 1800, 'm²', 90], ['Wald', 200, 'm²', 10]]);
    expect(t[1].eintraege[0]).toMatchObject({ wert: 3000, anteil: 150 });
    expect(eintragKurz(t[2].eintraege[0])).toBe('Gewässerraum');
    expect(t[3].eintraege[0]).toMatchObject({ wert: 40, einheit: 'm', anteil: null });
  });
});
