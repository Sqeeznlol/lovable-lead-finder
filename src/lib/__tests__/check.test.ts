import { describe, expect, it } from 'vitest';
import { TIPPS } from '../check-tipps';
import { readFileSync } from 'node:fs';
import { BETREIBER_ADRESSE, MARKEN, markeFuerHost } from '@/lib/check-marken';
import { FRAGEN, SCHRITTE } from '@/lib/check-inhalt';
import { HEIZUNG_TEXT } from '@/lib/heizung-text';
import { ARTIKEL } from '@/lib/ratgeber';
import { haeuserAus, herkunft, leadAngaben, mailOk, nameOk, prioritaet, schweizerNummer, ueberbauung } from '@/lib/check-daten';

describe('Marken der Check-Seiten', () => {
  it('erkennt die Marke am Hostnamen, auch mit www und Port', () => {
    expect(markeFuerHost('parzellenchecker.ch')?.id).toBe('parzellenchecker');
    expect(markeFuerHost('www.hauschecker.ch')?.id).toBe('hauschecker');
    expect(markeFuerHost('Was-Kann-Ich-Bauen.ch:443')?.id).toBe('wasdarfichbauen');
    expect(markeFuerHost('wohntraums.life')).toBeNull();
    expect(markeFuerHost('127.0.0.1')).toBeNull();
  });
  it('jede Domain gehört zu genau einer Marke', () => {
    const alle = MARKEN.flatMap(m => m.domains);
    expect(new Set(alle).size).toBe(alle.length);
  });
});

// Julian, 16. November: «Was Ihre Parzelle TRÄGT» macht wenig Sinn. Ein
// Grundstück trägt, kann, erlaubt und gibt nichts her -- darauf wird
// gebaut, und was erlaubt ist, sagt die Gemeinde. Ein Haus dagegen
// trägt ein Geschoss mehr oder nicht (Ratgeber Aufstocken).
describe('Wortlaut der Check-Seiten', () => {
  const texte = [
    ...MARKEN.flatMap(m => [m.titel, m.satz, m.aufruf, m.etikett, ...m.vorteile]),
    ...SCHRITTE.flat(), ...FRAGEN.flat(),
    HEIZUNG_TEXT.titel, HEIZUNG_TEXT.satz, HEIZUNG_TEXT.aufruf, ...HEIZUNG_TEXT.vorteile,
    ...ARTIKEL.flatMap(a => [a.titel, a.lead, a.kasten.titel, a.kasten.satz, a.kasten.knopf, ...a.abschnitte.flatMap(x => [x.titel, ...x.absaetze])]),
    ...TIPPS.flatMap(t => [t.titel, t.text]),
  ];
  it('kein Grundstück und keine Parzelle, die etwas trägt, kann, erlaubt oder hergibt', () => {
    // Nur wo Grundstück oder Parzelle selbst handeln (Nominativ): «was die Zone auf Ihrem Land erlaubt» ist richtig.
    const schief = /\b((Ihre|ihre|die|meine|eine) (Parzelle|Liegenschaft)|(Ihr|ihr|das|mein|ein) (Grundstück|Land))\b[^.?!:,]{0,40}\b(trägt|hergibt|kann|erlaubt)\b/;
    expect(schief.test('Sehen Sie, wie viel Ihre Parzelle heute trägt.')).toBe(true);
    expect(schief.test('wissen, was Ihr Grundstück kann')).toBe(true);
    expect(schief.test('wissen, was das Grundstück erlaubt')).toBe(true);
    expect(schief.test('was Ihr Grundstück laut den amtlichen Daten hergibt')).toBe(true);
    expect(texte.filter(s => schief.test(s))).toEqual([]);
  });
  it('kein Gedankenstrich und kein scharfes S', () => {
    expect(texte.filter(s => /[–—ß]/.test(s))).toEqual([]);
  });
});

describe('Impressum', () => {
  const seite = readFileSync('src/pages/Check.tsx', 'utf8');
  it('nennt die Postadresse des Betreibers', () => {
    expect(BETREIBER_ADRESSE).toEqual(['c/o PROJECTA SERVICES GMBH', 'Sihleggstrasse 23', '8832 Wollerau']);
    const impressum = seite.slice(seite.indexOf("recht === 'impressum'\n"), seite.indexOf('Wir speichern die Angaben'));
    expect(impressum).toContain('BETREIBER_ADRESSE.map(');
    expect(seite).not.toContain('werden hier ergänzt');
  });
  it('ist auch vom Ratgeber aus erreichbar', () => {
    expect(readFileSync('src/pages/Ratgeber.tsx', 'utf8')).toContain('<a href={impressum}>Impressum</a>');
    expect(seite).toContain("window.location.hash === '#impressum' ? 'impressum'");
  });
});

describe('Lead', () => {
  it('heiss nur mit Eigentum, Absicht verkaufen oder bauen und 12 Monaten', () => {
    expect(prioritaet({ eigentuemer: 'erbengemeinschaft', absicht: 'verkaufen', zeitraum: '12' })).toBe('heiss');
    expect(prioritaet({ eigentuemer: 'allein', absicht: 'bauen', zeitraum: '12' })).toBe('heiss');
    expect(prioritaet({ eigentuemer: 'allein', absicht: 'verkaufen', zeitraum: '36' })).toBe('warm');
    expect(prioritaet({ eigentuemer: 'allein', absicht: 'informieren', zeitraum: '12' })).toBe('normal');
    expect(prioritaet({ eigentuemer: 'nein', absicht: 'verkaufen', zeitraum: '12' })).toBe('normal');
  });
  it('nimmt nur Werbeherkunft aus der Adresse, nichts anderes', () => {
    expect(herkunft('?utm_source=google&utm_campaign=zh-verkaufen&gclid=abc&x=1')).toEqual({ utm_source: 'google', utm_campaign: 'zh-verkaufen', gclid: 'abc' });
  });
  it('Gebäude: nur diese Parzelle, ohne Abbruch, bestehende zuerst; Überbauung aus bestehenden', () => {
    // Bodenacherstrasse 79, Benglen, am 6. November beim Bund
    const h = haeuserAus([
      { egid: 192122563, egrid: 'CH545639778444', strname_deinr: 'Bodenacherstrasse 79a', gstat: 1001, ganzwhg: 5, gastw: 3 },
      { egid: 96093, egrid: 'CH545639778444', strname_deinr: 'Bodenacherstrasse 79', gstat: 1004, garea: 237, ganzwhg: 16, gbauj: 1973, genh1: 7520 },
      { egid: 1, egrid: 'CH545639778444', gstat: 1007, garea: 999 },
      { egid: 2, egrid: 'CH000000000000', gstat: 1004, garea: 50 },
    ], 'CH545639778444');
    expect(h.map(x => x.egid)).toEqual([96093, 192122563]);
    expect(ueberbauung({ flaeche: 2119, haeuser: h })).toEqual({ flaeche: 237, anteil: 11 });
    const a = leadAngaben({ marke: 'parzellenchecker', domain: 'parzellenchecker.ch', herkunft: { utm_source: 'meta' },
      antwort: { eigentuemer: 'allein', absicht: 'verkaufen', zeitraum: '12' },
      befund: { adresse: 'Bodenacherstrasse 79', nummer: '2725', egrid: 'CH545639778444', kanton: 'ZH', gemeinde: 'Fällanden', zone: 'Wohnzonen', flaeche: 2119, teile: [], haeuser: h } });
    expect(a).toMatchObject({ quelle: 'check', prioritaet: 'heiss', gebaeude: 1, wohnungen: 16, baujahr: 1973, projekt: true, utm_source: 'meta' });
    expect(JSON.stringify(a).length).toBeLessThan(2000);
    expect(a).toMatchObject({ landpreis_m2: null, boden_chf: null });
    // Mit dem Baulandpreis der Gemeinde (Fällanden 2023 bis 2025: CHF 2'244/m²) der Boden-Richtwert.
    const b = leadAngaben({ marke: 'x', domain: 'x.ch', herkunft: {}, antwort: { eigentuemer: 'allein', absicht: 'verkaufen', zeitraum: '12' },
      befund: { adresse: 'x', nummer: null, egrid: null, kanton: 'ZH', gemeinde: 'Fällanden', bfs: 193, zone: null, flaeche: 2119, teile: [], haeuser: [] }, landpreis: 2244 });
    expect(b).toMatchObject({ bfs: 193, landpreis_m2: 2244, boden_chf: 4760000 });  // 2244 × 2119 = 4755036, auf 10000 gerundet
  });
});

describe('Kontakt prüfen', () => {
  it('nimmt echte Schweizer Nummern und schreibt sie einheitlich', () => {
    expect(schweizerNummer('079 412 58 36')).toBe('+41 79 412 58 36');
    expect(schweizerNummer('+41 79 412 58 36')).toBe('+41 79 412 58 36');
    expect(schweizerNummer('0041794125836')).toBe('+41 79 412 58 36');
    expect(schweizerNummer('044 251 23 45')).toBe('+41 44 251 23 45');
    expect(schweizerNummer('076-388-21-09')).toBe('+41 76 388 21 09');
  });
  it('weist wilde Zahlen, Ausland, Gratis- und Mehrwertnummern ab', () => {
    for (const x of ['079 000 00 00', '079 123 45 67', '076 765 43 21', '0800 123 456', '0900 123 456', '0848 123 456', '123', '+49 151 1234567', '079 412 58 3', '0794125836x', ''])
      expect(schweizerNummer(x), x).toBeNull();
  });
  it('E-Mail und Namen', () => {
    expect(mailOk('anna@beispiel.ch')).toBe(true);
    expect(mailOk('anna@beispiel')).toBe(false);
    expect(mailOk('x@mailinator.com')).toBe(false);
    expect(nameOk('Zoë')).toBe(true);
    expect(nameOk("D'Alessandro-Meier")).toBe(true);
    expect(nameOk('a')).toBe(false);
    expect(nameOk('1234')).toBe(false);
  });
});

describe('Besucher zählen', () => {
  it('zählt nur auf echten Marken-Domains, nie auf Vorschau oder localhost', async () => {
    const { zaehltHier } = await import('@/lib/check-zaehlen');
    expect(zaehltHier('hauswert24.ch')).toBe(true);
    expect(zaehltHier('www.zonen-check.ch')).toBe(true);
    expect(zaehltHier('bauraum-lead-finder-git-akquise-i-nation.vercel.app')).toBe(false);
    expect(zaehltHier('bauraum-checks.vercel.app')).toBe(false);
    const { istBot } = await import('@/lib/check-zaehlen');
    expect(istBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', false)).toBe(true);
    expect(istBot('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/140.0 Safari/537.36', false)).toBe(true);
    expect(istBot('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', false)).toBe(false);
    expect(istBot('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', true)).toBe(true);
    expect(zaehltHier('localhost')).toBe(false);
    expect(zaehltHier('127.0.0.1')).toBe(false);
  });
});
