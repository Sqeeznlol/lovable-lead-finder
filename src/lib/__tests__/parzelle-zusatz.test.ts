import { describe, expect, it } from 'vitest';
import { belastungenAus, oerebAus, solarAus } from '@/lib/parzelle-zusatz';

// Ausschnitt einer echten Antwort von wfs.geodienste.ch (Zürich, 13. November).
const GML = `<wfs:FeatureCollection><wfs:member><ms:belastete_standorte_flaechen gml:id="x.1">
<ms:katasternummer>0261/D.0158-000</ms:katasternummer><ms:egrid>CH307091739972;CH852699709148</ms:egrid>
<ms:standorttyp>Ablagerungsstandort</ms:standorttyp><ms:statusaltlv>Belastet, keine schädlichen oder lästigen Einwirkungen zu erwarten</ms:statusaltlv>
<ms:url_kbs_auszug></ms:url_kbs_auszug><ms:zustaendige_behoerde>AWEL Amt für Abfall, Wasser, Energie und Luft</ms:zustaendige_behoerde>
<ms:url_kataster>https://geo.zh.ch/maps?initialMapIds=AwelKBSZH&amp;searchIndex=kbs</ms:url_kataster>
</ms:belastete_standorte_flaechen></wfs:member></wfs:FeatureCollection>`;

describe('Zusatzangaben zur Parzelle', () => {
  it('nimmt nur belastete Standorte, die genau diese EGRID nennen', () => {
    const b = belastungenAus(GML, 'CH852699709148');
    expect(b).toEqual([{ typ: 'Ablagerungsstandort', status: 'Belastet, keine schädlichen oder lästigen Einwirkungen zu erwarten',
      behoerde: 'AWEL Amt für Abfall, Wasser, Energie und Luft', nummer: '0261/D.0158-000', link: 'https://geo.zh.ch/maps?initialMapIds=AwelKBSZH&searchIndex=kbs' }]);
    expect(belastungenAus(GML, 'CH000000000000')).toEqual([]);
  });
  it('baut den ÖREB-Auszug mit der EGRID des Leads, nicht der getroffenen Parzelle', () => {
    const o = oerebAus({ oereb_webservice: 'https://maps.zh.ch/oereb/v2', oereb_extract_pdf: 'https://maps.zh.ch/oereb/v2/extract/pdf/?EGRID=CH232277277391',
      firmenname: 'Baudirektion des Kantons Zürich' }, 'CH545639778444');
    expect(o).toEqual({ pdf: 'https://maps.zh.ch/oereb/v2/extract/pdf/?EGRID=CH545639778444', stelle: 'Baudirektion des Kantons Zürich' });
    expect(oerebAus(undefined, 'CH545639778444')).toBeNull();
  });
  it('zählt beim Solarpotenzial nur Dachflächen ab «gut»', () => {
    // Bodenacherstrasse 79, Benglen: drei Dachflächen laut Bund.
    const s = solarAus([
      { klasse: 2, flaeche: 53.9, stromertrag: 7012, klasse_text: 'Mittel##Moyenne' },
      { klasse: 4, flaeche: 215.3, stromertrag: 41820, klasse_text: 'Sehr gut##Trés bonne' },
      { klasse: 4, flaeche: 72.9, stromertrag: 14858, klasse_text: 'Sehr gut##Trés bonne' },
    ]);
    expect(s).toEqual({ kwh: 56678, flaeche: 288, eignung: 'Sehr gut' });
    expect(solarAus([{ klasse: 1, flaeche: 10, stromertrag: 100 }])).toBeNull();
  });
});
