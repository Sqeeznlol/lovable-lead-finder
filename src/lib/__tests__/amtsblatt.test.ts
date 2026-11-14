import { describe, expect, it } from 'vitest';
import { ersteNummer, gesuchAus, punktAus, suchtexte, xmlLesen } from '../amtsblatt';

// Aufbau wie die Publikationen vom 11. bis 13. November 2026, Inhalte erfunden (TEST).
const bp = `<?xml version='1.0' encoding='UTF-8'?>
<BP-ZG10:publication xmlns:BP-ZG10="https://shab.ch/x"><meta><id>aaaa-1</id><publicationNumber>BP-ZG10-0000000001</publicationNumber>
<publicationDate>2026-11-12</publicationDate><expirationDate>2027-02-12</expirationDate><cantons>ZG</cantons>
<title><de>Baugesuch: TEST</de></title></meta><content>
<localization><municipalityId><key>1706</key><term><de>Oberägeri</de><fr>Oberägeri</fr></term></municipalityId></localization>
<buildingContractor><legalEntity><selectType>person</selectType><persons><person><prename>TEST</prename><name>Person</name></person></persons></legalEntity></buildingContractor>
<projectDescription>Neubau Doppeleinfamilienhaus &amp; Garage</projectDescription>
<projectLocation><address><street>Flurweg</street><houseNumber>26a und 26b</houseNumber><swissZipCode>6315</swissZipCode><town>Alosen</town></address></projectLocation>
<districtCadastre><relation><property>2360, 2361</property><coordinate>2'687'000 / 1'221'000</coordinate></relation></districtCadastre>
<entryDeadline>2026-12-02</entryDeadline></content></BP-ZG10:publication>`;

const el = (inhalt: string) => `<secondary><element>${inhalt}</element></secondary>`;
const ba = `<x:publication xmlns:x="y"><meta><id>bbbb-2</id><publicationNumber>BA-VS05-1</publicationNumber><publicationDate>2026-11-13</publicationDate><cantons>VS</cantons>
<title><de>Baugesuch – Bahnhofstrasse 5, 3900 Brig</de></title></meta><content><businessCase><key>constructionProject</key>
<primary><element><key>constructionProjectTitle</key><valueText><term><de>Abbruch Stall</de></term></valueText></element></primary>
${el('<key>projectDescription</key><valueRichText><de>&lt;p&gt;Projektverfasser: TEST&lt;/p&gt;</de></valueRichText>')}
${el('<key>parcel</key><valueTextNeutral>Parzellen-Nr 503, Plan Nr 6, Im Orte genannt TEST</valueTextNeutral>')}
${el("<key>coordinates</key><valueTextNeutral>2'647'793 1'137'497</valueTextNeutral>")}
${el('<key>buildingContractor</key><subject><selectType>legalPerson</selectType><legalPerson><company><name>TEST AG</name><legalForm>0106</legalForm></company></legalPerson></subject>')}
</businessCase><reaction><element><deadline><date>2026-12-14</date></deadline></element></reaction>
<localization><municipalityId><key>6205</key><term><de>Bettmeralp</de></term></municipalityId></localization></content></x:publication>`;

describe('Amtsblattportal', () => {
  it('liest feste Felder (BP), ohne Namen', () => {
    const g = gesuchAus(bp)!;
    expect(g).toMatchObject({ id: 'aaaa-1', kanton: 'ZG', bfs: '1706', gemeinde: 'Oberägeri', strasse: 'Flurweg 26a und 26b', plz: '6315', ort: 'Alosen',
      parzelle: '2360, 2361', beschreibung: 'Neubau Doppeleinfamilienhaus & Garage', bauherrschaft: null, einspracheBis: '2026-12-02', punkt: { e: 2687000, n: 1221000 } });
    expect(JSON.stringify(g)).not.toMatch(/Person/);
  });
  it('liest allgemeine Elemente (BA): Titel vor Richtext, Rechtsform statt Firmenname', () => {
    const g = gesuchAus(ba)!;
    expect(g).toMatchObject({ kanton: 'VS', beschreibung: 'Abbruch Stall', parzelle: '503', bauherrschaft: 'Aktiengesellschaft (AG)',
      einspracheBis: '2026-12-14', punkt: { e: 2647793, n: 1137497 }, strasse: null });
    expect(JSON.stringify({ ...g, titel: null })).not.toMatch(/TEST/);
  });
  it('Suchtexte: erste Hausnummer, Gemeinde als Rückfall, Titel nur mit Nummer', () => {
    expect(suchtexte(gesuchAus(bp)!).map(s => s.text)).toEqual(['Flurweg 26a, 6315 Alosen', 'Flurweg 26a, Oberägeri']);
    expect(suchtexte(gesuchAus(ba)!)).toEqual([{ text: 'Bahnhofstrasse 5, 3900 Brig', ausTitel: true }]);
    const name = { ...gesuchAus(ba)!, titel: 'Baugesuch – TEST Person, Lützelflüh' };
    expect(suchtexte(name)).toEqual([]);
  });
  it('Hausnummern und Koordinaten der Kantone', () => {
    expect(['Mühlebachstrasse 17, 19 und 21', 'Rübeldorfstrasse 86 & 88', 'Bernstrasse 3-5', 'Dorf 22f bis 22q', 'Gwand 1'].map(ersteNummer))
      .toEqual(['Mühlebachstrasse 17', 'Rübeldorfstrasse 86', 'Bernstrasse 3', 'Dorf 22f', 'Gwand 1']);
    expect(punktAus('2609737,073 / 2609737,073')).toBeNull();
    expect(punktAus('647793 / 137497')).toEqual({ e: 2647793, n: 1137497 });
    expect(xmlLesen('<a><b>x &lt; y</b><c/></a>').kinder[0].kinder.map(k => [k.name, k.text])).toEqual([['b', 'x < y'], ['c', '']]);
  });
});
