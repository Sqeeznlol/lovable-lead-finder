import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bisherFuer, standKurz, fundstelle, fundstelleZeilen, GESETZE, gesetzFuer, schnittDaten } from '@/lib/check-fundstelle';
import { ANGEBOT, BEISPIEL_HINWEIS, beispielBericht, beispielFundstelle } from '@/lib/check-beispiel';
import { fragtKaufangebot, leadAngaben, prioritaet, type Befund } from '@/lib/check-daten';
import type { Ziffern } from '@/lib/check-modell';

/**
 * Jede Zahl mit Fundstelle, ein Beispielbericht mit erfundenen Daten und
 * das Kaufangebot auf Wunsch (Julian, 19. November, nach dem Vergleich mit
 * baugesuch.prüfer.ch). Diese Tests werden rot, wenn eine Rechnung nicht
 * mehr aufgeht, ein Zitat ohne amtliche Quelle dasteht oder die Seite mehr
 * verspricht, als der Ablauf hält.
 */
const LEER: Ziffern = { zone: 'Wohnzone W2', kuerzel: 'W2', gemeinde: null, quelle: 'Zonenplan Kanton ZH', az: 0.6, bmz: null, uez: null, gruen: null, frei: null,
  vollgeschosse: 2, dachgeschosse: 1, untergeschosse: null, attika: null, gebaeudehoehe: null, fassadenhoehe: null, fassadenhoehe_giebel: null, gesamthoehe: null, firsthoehe: null, wohnanteil: null, unbestimmt: null };

describe('Fundstelle: die Rechnung Zahl für Zahl', () => {
  it('Ausnützung aus dem Zonenplan: möglich, heute, Reserve, ohne Annahme', () => {
    const f = fundstelle({ kanton: 'ZH', ziffern: LEER, flaeche: 812, az: 0.6, haeuser: [{ grundflaeche: 120, geschosse: 2 }], volumenHeute: null });
    expect([f.moeglich, f.heute, f.reserve]).toEqual([487, 240, 247]);
    expect(f.rechnung).toEqual([
      'Möglich: 812 m² Grundstück × 0.6 = 487 m² Geschossfläche',
      'Heute: 120 m² Grundfläche × 2 Geschosse = 240 m² (Gebäuderegister)',
      'Baureserve: 487 m² − 240 m² = 247 m²',
    ]);
    expect(f.vorgabe).toBe('Zonenplan Kanton ZH, Zone Wohnzone W2: Ausnützungsziffer 0.6');
    expect(f.annahme).toBeNull();
  });

  it('mit dem Regler verschoben oder ohne Wert im Plan: als Annahme bezeichnet', () => {
    expect(fundstelle({ kanton: 'ZH', ziffern: LEER, flaeche: 812, az: 0.9, haeuser: [], volumenHeute: null }).annahme).toMatch(/Regler/);
    expect(fundstelle({ kanton: 'BE', ziffern: null, flaeche: 812, az: 0.6, haeuser: [], volumenHeute: null }).annahme).toMatch(/^Annahme/);
  });

  it('Baumassenziffer in Kubikmetern; ohne Volumen im Register keine erfundene Reserve', () => {
    const z = { ...LEER, az: null, bmz: 1.5 };
    const mit = fundstelle({ kanton: 'ZH', ziffern: z, flaeche: 1000, az: 0.6, haeuser: [], volumenHeute: 900 });
    expect([mit.moeglich, mit.reserve, mit.einheit]).toEqual([1500, 600, 'm³']);
    expect(fundstelle({ kanton: 'ZH', ziffern: z, flaeche: 1000, az: 0.6, haeuser: [], volumenHeute: null }).reserve).toBeNull();
  });

  it('keine Reserve ist «keine», nie eine negative Zahl', () => {
    const f = fundstelle({ kanton: 'ZH', ziffern: LEER, flaeche: 300, az: 0.6, haeuser: [{ grundflaeche: 150, geschosse: 3 }], volumenHeute: null });
    expect(f.reserve).toBe(0);
    expect(f.rechnung[2]).toMatch(/= keine$/);
  });

  it('ohne nachgelesenen Artikel sagt die Fundstelle das, statt einen zu nennen', () => {
    const f = fundstelle({ kanton: 'XX', ziffern: LEER, flaeche: 812, az: 0.6, haeuser: [], volumenHeute: null });
    expect(f.gesetz).toBeNull();
    expect(fundstelleZeilen(f).find(z => z.titel === 'Gesetz')?.wert).toMatch(/prüfen wir in der Analyse/);
    expect(f.bisher).toBeNull();
  });

  it('der Schnitt nur mit Geschossen aus dem Zonenplan', () => {
    expect(schnittDaten(LEER, 2)).toEqual({ heute: 2, erlaubt: 2, dach: 'dach', hoehe: null });
    expect(schnittDaten({ ...LEER, vollgeschosse: null }, 2)).toBeNull();
  });
});

describe('Fundstelle: die Gesetzesartikel', () => {
  it('jeder Artikel wörtlich, mit amtlicher Quelle und Stand', () => {
    const AMTLICH = /^https:\/\/(www\.)?(zh\.ch|zhlex\.zh\.ch|notes\.zh\.ch|bgs\.zg\.ch|srl\.lu\.ch|gesetzessammlungen\.ag\.ch|sz\.ch|bgs\.so\.ch|rechtsbuch\.sh\.ch|rechtsbuch\.tg\.ch|bpuk\.ch|fedlex\.admin\.ch)\//;
    for (const g of GESETZE) {
      expect(g.url, `${g.kanton} ${g.begriff}`).toMatch(AMTLICH);
      expect(g.zitat.length, `${g.kanton} ${g.begriff}`).toBeGreaterThan(30);
      expect(g.artikel).toMatch(/^(§|Art\.|Ziff\.|Anhang)/);
      expect(['neu', 'bisher']).toContain(g.fassung);
      expect(g.stand.trim()).not.toBe('');
      // Wörtlich heisst: keine Auslassungen und keine eigenen Klammern im Zitat.
      expect(g.zitat).not.toMatch(/\.\.\.|…|\[/);
    }
    // Je Kanton, Begriff und Fassung höchstens ein Artikel: sonst wäre unklar, welcher gilt.
    const schluessel = GESETZE.map(g => `${g.kanton}:${g.begriff}:${g.fassung}`);
    expect(new Set(schluessel).size).toBe(schluessel.length);
  });

  it('der Stand kurz und lesbar, für jeden Artikel', () => {
    expect(standKurz({ stand: 'Vom 20. November 2018 (Stand 1. Februar 2026)' })).toBe('Stand 1. Februar 2026');
    expect(standKurz({ stand: 'Nachtrag 134 (aktuell; Nachtrag 133 in Kraft bis 01.08.2026), Publikationsdatum 01.08.2026' })).toBe('Nachtrag 134');
    for (const g of GESETZE) expect(standKurz(g).length, g.stand).toBeLessThan(30);
  });

  it('für die Ausnützungsziffer nie der Artikel einer anderen Ziffer', () => {
    // Schaffhausen kennt kantonal nur die Geschossflächenziffer; die Ausnützungsziffer steht in der Bauordnung der Gemeinde.
    expect(GESETZE.some(g => g.kanton === 'SH' && g.begriff === 'gfz')).toBe(true);
    expect(gesetzFuer('SH', 'az')).toBeNull();
  });

  it('Zürich: geltendes Recht zuerst, das bisherige daneben; Luzern kennt die Ausnützungsziffer nur noch bisher', () => {
    expect(gesetzFuer('ZH', 'az')?.artikel).toBe('§ 255 Abs. 1');
    expect(bisherFuer('ZH', 'az')?.artikel).toBe('Anhang, § 254 Abs. 1');
    expect(gesetzFuer('LU', 'az')?.fassung).toBe('bisher');
    expect(bisherFuer('LU', 'az')).toBeNull();
    const f = fundstelle({ kanton: 'ZH', ziffern: LEER, flaeche: 812, az: 0.6, haeuser: [], volumenHeute: null });
    expect(fundstelleZeilen(f).map(z => z.wert).join(' ')).toMatch(/§ 255 Abs\. 1 Planungs- und Baugesetz \(PBG\), Kanton ZH.*bisherige: Anhang, § 254 Abs\. 1/);
  });
});

describe('Beispielbericht und Angebot', () => {
  it('das Beispiel ist als erfunden bezeichnet, auf der Seite und im PDF', () => {
    expect(BEISPIEL_HINWEIS).toMatch(/erfundenen Daten/);
    const b = beispielBericht({ name: 'Test', farbe: '#0E5A4E', domain: 'example.ch', betreiber: 'TEST', betreiberAdresse: [] });
    expect(b.adresse).toMatch(/^BEISPIEL/);
    expect(b.rechnung?.satz).toBe(BEISPIEL_HINWEIS);
    expect(beispielFundstelle().reserve).toBe(491);
  });

  it('das Angebot verspricht nur, was der Ablauf hält', () => {
    const text = ANGEBOT.flatMap(a => [a.titel, a.preis, ...a.punkte]).join(' ');
    expect(text).toMatch(/unverbindliches Kaufangebot/);
    // Eine Frist gibt es nur für die Analyse (zwei Arbeitstage), keine für das Kaufangebot.
    expect(text).not.toMatch(/24 Stunden|innert \d+ Stunden|morgen/);
    expect(text).not.toMatch(/ohne Anmeldung/);
  });

  it('nach dem Kaufangebot fragt die Seite nur, wer verkaufen oder den Wert kennen will, und der Lead wird heiss', () => {
    expect(fragtKaufangebot({ absicht: 'verkaufen' })).toBe(true);
    expect(fragtKaufangebot({ absicht: 'wert' })).toBe(true);
    expect(fragtKaufangebot({ absicht: 'bauen' })).toBe(false);
    expect(prioritaet({ eigentuemer: 'allein', absicht: 'wert', zeitraum: 'offen', kaufangebot: 'ja' })).toBe('heiss');
    expect(prioritaet({ eigentuemer: 'nein', absicht: 'wert', zeitraum: 'offen', kaufangebot: 'ja' })).toBe('normal');
    const befund = { adresse: 'TEST', nummer: null, flaeche: 500, zone: null, gemeinde: null, kanton: 'ZH', bfs: null, egrid: null, teile: [], haeuser: [] } as unknown as Befund;
    expect(leadAngaben({ marke: 't', domain: 'd', antwort: { eigentuemer: 'allein', absicht: 'verkaufen', zeitraum: '12', kaufangebot: 'ja' }, befund, herkunft: {} }).kaufangebot).toBe(true);
  });

  it('das PDF setzt nur Zeichen, die seine Schrift kennt', () => {
    const bericht = readFileSync('src/lib/check-bericht.ts', 'utf8');
    expect(bericht).toMatch(/replace\(\/\\u2212\/g, '\\u2013'\)/);
  });

  it('die Seite zeigt Fundstelle, Schnitt, Beispiel und Angebot, und fragt nach dem Kaufangebot', () => {
    const seite = readFileSync('src/pages/Check.tsx', 'utf8');
    for (const teil of ['<FundstelleTafel f={rechnungMitFundstelle}', '<Schnitt d={schnitt}', 'id="beispiel"', 'id="angebot"', "wahl('kaufangebot'", 'fundstelleZeilen(rechnungMitFundstelle)']) {
      expect(seite, teil).toContain(teil);
    }
  });
});

describe('Vergleich und ehrliche Fragen (19. November, nach eigenheimkompass.ch)', () => {
  it('der Vergleich nennt auch, was der Check nicht kann, und keine unbelegten Zahlen über andere', async () => {
    const { VERGLEICH, FRAGEN } = await import('@/lib/check-inhalt');
    expect(VERGLEICH.spalten[1]).toBe('Unser Check');
    expect(VERGLEICH.zeilen.find(z => z[0] === 'Blick vor Ort')?.[2]).toMatch(/^nein/);
    for (const z of VERGLEICH.zeilen) {
      expect(z).toHaveLength(4);
      // Über Online-Bewertung und Makler keine Beträge oder Prozente: belegen könnten wir sie nicht.
      expect(`${z[1]} ${z[3]}`).not.toMatch(/\d/);
    }
    const f = FRAGEN.map(([q]) => q);
    expect(f).toContain('Warum ist der Check kostenlos?');
    expect(f).toContain('Ersetzt der Check eine Bauanfrage oder einen Architekten?');
  });

  it('die Seite zeigt den Vergleich, ausser im Heizungs-Check, und das feste HTML enthält ihn', () => {
    const seite = readFileSync('src/pages/Check.tsx', 'utf8');
    expect(seite).toMatch(/modus !== 'heizung' && \(\s*<section className="abschnitt-gross vergleich" id="vergleich">/);
    expect(readFileSync('src/lib/seo-marken.ts', 'utf8')).toMatch(/Wo der Check hingehört/);
  });
});
