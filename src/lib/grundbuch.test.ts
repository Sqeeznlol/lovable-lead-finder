import { describe, it, expect } from 'vitest';
import { grundbuchUrl, verkauftNie } from './grundbuch';

describe('grundbuchUrl', () => {
  it('bildet die Adresse aus EGRID und Gemeindenummer', () => {
    expect(grundbuchUrl('CH592077140849', 230)).toBe(
      'https://portal.objektwesen.zh.ch/aks/detail/success?egrid=CH592077140849&bfsNr=230',
    );
  });

  it('führt im Thurgau in den kantonalen Kartendienst', () => {
    // Diessenhofen, Parzelle 454. Das Zürcher Portal kennt dieses
    // Grundstück nicht -- es zeigte bisher ein fremdes gleicher Nummer.
    const url = grundbuchUrl('CH770977292983', 4545, 'TG')!;
    expect(url).toContain('map.geo.tg.ch');
    expect(url).toContain('topic=grundbuchvermessung');
    expect(url).toContain('layers=grundbuch,av_komplett');
    expect(url).toContain('swisssearch=CH770977292983');
    expect(url).not.toContain('objektwesen.zh.ch');
  });

  it('braucht im Thurgau keine Gemeindenummer, aber den EGRID', () => {
    expect(grundbuchUrl('CH770977292983', null, 'TG')).toContain('map.geo.tg.ch');
    expect(grundbuchUrl(null, 4545, 'tg')).toBeNull();
  });

  it('liefert nichts, wenn eine der beiden Angaben fehlt', () => {
    // Ein Link ohne Gemeindenummer führt ins Leere -- dann lieber keiner.
    expect(grundbuchUrl('CH592077140849', null)).toBeNull();
    expect(grundbuchUrl(null, 230)).toBeNull();
    expect(grundbuchUrl('', '')).toBeNull();
  });
});

describe('verkauftNie', () => {
  it('erkennt die öffentliche Hand', () => {
    // Wortlaut aus dem Grundbuchauszug zu OB3827.
    expect(verkauftNie('Stadt Winterthur, besondere Rechtsform')).toBe(true);
    expect(verkauftNie('Gemeinde Küsnacht')).toBe(true);
    expect(verkauftNie('Kanton Zürich')).toBe(true);
    expect(verkauftNie('Schweizerische Eidgenossenschaft')).toBe(true);
    expect(verkauftNie('SBB AG')).toBe(true);
  });

  it('lässt private Eigentümer und Firmen in Ruhe', () => {
    expect(verkauftNie('Erbengemeinschaft Meier')).toBe(false);
    expect(verkauftNie('Hans Müller')).toBe(false);
    expect(verkauftNie('Bauraum Immobilien AG')).toBe(false);
    // "Stadthaus" ist kein Hinweis auf die Stadt als Eigentümerin.
    expect(verkauftNie('Stadthaus Immobilien GmbH')).toBe(false);
    expect(verkauftNie(null)).toBe(false);
  });
});
