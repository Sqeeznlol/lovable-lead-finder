import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  adressbloecke, anrede, brief, chfText, deckblattBreite, felderVorgabe, FIRMEN, FIRMEN_WAHL, inWorten, lernen, leerePerson, luecken, nachricht,
  parzellenText, personenAusEigentuemer, punkteAlsText, vorschlag, VORLAGEN, type Kontext, type Person, type Rueckmeldung, type VorlageId,
} from '@/lib/angebot';
import { angebotDateiname, angebotPdf } from '@/lib/angebot-pdf';

/**
 * Das Kaufangebot (Julian, 19. November): was in jedem Brief individuell
 * ist (Datum, Anrede, Adresse, Parzellen, Preis), muss stimmen, und das
 * PDF muss es so lesen lassen, wie ein Mensch es liest. Erfundene Namen
 * und Adressen: die Vorlagen nennen echte Eigentümer, die gehören nicht
 * in ein öffentliches Repository.
 */
const ehepaar: Person[] = [
  leerePerson({ art: 'frau', vorname: 'Anna', name: 'Muster', strasse: 'Musterweg 12', plzOrt: '8400 Winterthur', empfaenger: true }),
  leerePerson({ art: 'herr', vorname: 'Peter', name: 'Muster', strasse: 'Musterweg 12', plzOrt: '8400 Winterthur', empfaenger: true }),
];

function kontext(vorlage: VorlageId, o: Partial<Kontext> = {}): Kontext {
  return {
    firma: FIRMEN.stimo, felder: { ...felderVorgabe(vorlage, new Date('2026-12-10T10:00:00'), o.firma?.id), unterschriften: [{ name: 'TEST Unterschrift', titel: 'CEO' }] },
    preis: 3_450_000, adresse: 'Musterweg 12', plzOrt: '8400 Winterthur', gemeinde: 'Winterthur', kanton: 'ZH',
    zone: 'Wohnzone W2/1.6', parzellen: [{ nummer: 'SE9999', flaeche: 2112 }], personen: ehepaar, ...o,
  };
}

describe('Angebot: Empfänger und Anrede', () => {
  it('ein Ehepaar: eine Zeile im Fenster, beide in der Anrede', () => {
    expect(adressbloecke(ehepaar)).toEqual([['Anna & Peter Muster', 'Musterweg 12', '8400 Winterthur']]);
    expect(anrede(ehepaar)).toBe('Sehr geehrte Frau Muster, sehr geehrter Herr Muster');
  });

  it('nur wer als Empfänger gewählt ist, bekommt den Brief', () => {
    const drei = [...ehepaar, leerePerson({ art: 'herr', vorname: 'Max', name: 'Beispiel', empfaenger: false })];
    expect(anrede(drei)).not.toMatch(/Beispiel/);
    expect(anrede([{ ...ehepaar[0], empfaenger: false }])).toBe('Sehr geehrte Damen und Herren');
    expect(adressbloecke([])).toEqual([['An die Eigentümerschaft']]);
  });

  it('Makler über die Firma, Vertretung mit Kanzlei, Erbengemeinschaft zuerst', () => {
    expect(adressbloecke([leerePerson({ art: 'herr', vorname: 'Hans', name: 'Makler', firma: 'TEST Immobilien AG', strasse: 'Gasse 1', plzOrt: '8001 Zürich', rolle: 'makler', empfaenger: true })]))
      .toEqual([['TEST Immobilien AG', 'Z. Hd. Herrn Hans Makler', 'Gasse 1', '8001 Zürich']]);
    expect(adressbloecke([leerePerson({ art: 'herr', vorname: 'Urs', name: 'Anwalt', firma: 'TEST Kanzlei AG', strasse: 'Weg 2', plzOrt: '8155 Niederhasli', rolle: 'vertreter', empfaenger: true })]))
      .toEqual([['Urs Anwalt', 'TEST Kanzlei AG', 'Weg 2', '8155 Niederhasli']]);
    expect(adressbloecke([leerePerson({ art: 'herr', vorname: 'Albert', name: 'Erbe', firma: 'Erbengemeinschaft Erbe', strasse: 'Rain 9', plzOrt: '8322 Madetswil', empfaenger: true })]))
      .toEqual([['Erbengemeinschaft Erbe', 'Herr Albert Erbe', 'Rain 9', '8322 Madetswil']]);
  });

  it('aus dem Grundbuch-Feld wird ein Vorschlag: Name zuerst, Firmen als Firma', () => {
    const p = personenAusEigentuemer('Muster Anna; TEST Bau AG');
    expect(p.map(x => [x.vorname, x.name, x.firma])).toEqual([['Anna', 'Muster', ''], ['', '', 'TEST Bau AG']]);
    // Bei mehreren entscheidet ein Mensch, wer das Angebot bekommt.
    expect(p.some(x => x.empfaenger)).toBe(false);
  });

  it('ein einziger Eigentümer bekommt das Angebot von selbst (23. November)', () => {
    expect(personenAusEigentuemer('Muster Anna').map(x => x.empfaenger)).toEqual([true]);
  });
});

describe('Angebot: Zahlen und Parzellen', () => {
  it('Beträge wie in den Vorlagen und in Worten (Volketswil)', () => {
    expect(chfText(3_450_000)).toBe('CHF 3’450’000');
    expect(inWorten(10_200_000)).toBe('zehn Millionen zweihunderttausend');
    expect(inWorten(17_000_000)).toBe('siebzehn Millionen');
    expect(inWorten(1_250_000)).toBe('eine Million zweihundertfünfzigtausend');
    expect(inWorten(2_345_678)).toBe('zwei Millionen dreihundertfünfundvierzigtausendsechshundertachtundsiebzig');
  });

  it('eine oder mehrere Parzellen, mit Fläche und Summe', () => {
    expect(parzellenText([{ nummer: 'SE9999', flaeche: 2112 }], null)).toBe('das Grundstück Kat.-Nr. SE9999 mit einer Fläche von 2’112 m² gemäss Grundbuchauszug');
    expect(parzellenText([{ nummer: '9259', flaeche: 1372, gbBlatt: '1359' }, { nummer: '9261', flaeche: 1905 }], 'Meilen'))
      .toBe('die Grundstücke Kat.-Nr. 9259 (1’372 m², GB Blatt 1359) und Kat.-Nr. 9261 (1’905 m²), total 3’277 m² in der Gemeinde Meilen');
  });
});

describe('Angebot: die fünf Vorlagen', () => {
  it('jede Vorlage nennt Adresse, Parzelle und die Kosten und hat keine offenen Platzhalter', () => {
    for (const v of Object.keys(VORLAGEN) as VorlageId[]) {
      // Studer schreibt seit dem 23. November seinen eigenen Brief (studer-angebot.test.ts); die Vorlagen hier mit stimo und Lebensraum.
      const b = brief(v, kontext(v, { firma: v === 'bedingt' || v === 'bieterverfahren' ? FIRMEN.lebensraum : FIRMEN.stimo }));
      const alles = [b.betreff, ...b.einleitung, b.betragZeile, b.betragUnter, ...b.punkte.map(p => `${p.titel ?? ''} ${p.text}`), ...b.schluss].join(' ');
      expect(alles, v).toMatch(/SE9999/);
      expect(alles, v).toMatch(/Musterweg 12/);
      expect(alles, v).toMatch(/Grundstückgewinnsteuer/);
      expect(alles, v).not.toMatch(/\{|\}|undefined|null|NaN/);
    }
  });

  it('Bauland nennt Zone, Besitzantritt, Bindung und die Gesellschaften der Gruppe', () => {
    const t = brief('bauland', kontext('bauland')).punkte.map(p => p.text).join(' ');
    expect(t).toMatch(/Wohnzone W2\/1\.6/);
    expect(t).toMatch(/spätestens bis zum 31\.12\.2029/);
    expect(t).toMatch(/während 90 Tagen/);
    expect(t).toMatch(/stimo Generalunternehmung AG, stimo \+ partner AG, Stieger Immobilien AG/);
  });

  it('Anzahlung und Rest ergeben den Preis', () => {
    const b = brief('bedingt', kontext('bedingt', { firma: FIRMEN.lebensraum, preis: 17_000_000 }));
    expect(b.zahlung!.map(z => z.betrag)).toEqual([250_000, 16_750_000, 17_000_000]);
  });

  it('eigener Wortlaut geht der Vorlage vor, Titel bleiben bei nummerierten Bedingungen', () => {
    const k = kontext('bedingt', { firma: FIRMEN.lebensraum });
    const vorlage = brief('bedingt', k);
    const eigen = punkteAlsText(vorlage).replace('Es werden keine Hypotheken übernommen.', 'Hypotheken werden besprochen.');
    const b = brief('bedingt', { ...k, felder: { ...k.felder, punkte: eigen, einleitung: 'Erster Satz.\n\nZweiter Satz.' } });
    expect(b.einleitung).toEqual(['Erster Satz.', 'Zweiter Satz.']);
    expect(b.punkte.find(p => p.titel === 'Hypotheken')?.text).toBe('Hypotheken werden besprochen.');
    expect(b.punkte).toHaveLength(vorlage.punkte.length);
  });

  it('was fehlt, steht vor dem Weitergeben', () => {
    const k = kontext('bauland');
    expect(luecken({ ...k, firma: 'stimo', vorlage: 'bauland' })).toEqual([]);
    expect(luecken({ ...k, personen: [], firma: null, vorlage: 'bauland', felder: { ...k.felder, unterschriften: [] } }))
      .toEqual(['Kein Empfänger gewählt.', 'Keine Firma gewählt.', 'Niemand unterschreibt.']);
  });
});

describe('Angebot: aus den Rückmeldungen lernen', () => {
  const r = (empfehlung: number, preis: number, kanton = 'ZH'): Rueckmeldung => ({ empfehlung, preis, urteil: preis > empfehlung ? 'zu_tief' : preis < empfehlung ? 'zu_hoch' : 'passt', grund: 'TEST Grund', kanton, vorlage: 'bauland', am: '2026-11-19' });

  it('Median von Preis zu Empfehlung, im selben Kanton, sobald es dort genug sind', () => {
    const g = lernen([r(100, 90), r(100, 95), r(100, 100), r(100, 120, 'ZG')], 'ZH')!;
    expect(g.n).toBe(3);
    expect(g.kanton).toBe('ZH');
    expect(g.faktor).toBeCloseTo(0.95);
    expect(vorschlag(2_000_000, g)).toBe(1_900_000);
  });

  it('je näher, desto besser: dieselbe Gemeinde vor dem Kanton (22. November: «wo in der Ortschaft»)', () => {
    const o = (preis: number, gemeinde: string) => ({ ...r(100, preis), gemeinde });
    const alle = [o(200, 'Uitikon'), o(180, 'Uitikon'), o(190, 'Uitikon'), o(100, 'Zürich'), o(100, 'Zürich'), o(100, 'Zürich'), o(100, 'Zürich')];
    const imOrt = lernen(alle, 'ZH', 'Uitikon')!;
    expect(imOrt.gemeinde).toBe('Uitikon');
    expect(imOrt.n).toBe(3);
    expect(imOrt.faktor).toBeCloseTo(1.9);
    expect(imOrt.gruende[0].gemeinde).toBe('Uitikon');
    // Zu wenige im Ort: dann zählt der Kanton.
    const anderswo = lernen(alle, 'ZH', 'Schlieren')!;
    expect(anderswo.gemeinde).toBeNull();
    expect(anderswo.kanton).toBe('ZH');
    expect(anderswo.n).toBe(7);
  });

  it('unter drei Rückmeldungen kein Vorschlag, und Ausreisser zählen nicht', () => {
    expect(vorschlag(2_000_000, lernen([r(100, 90), r(100, 95)], 'ZH'))).toBeNull();
    expect(lernen([r(100, 1), r(100, 9000)], null)).toBeNull();
  });
});

describe('Angebot: Nachricht an die nächste Hand', () => {
  it('Mail und WhatsApp mit Aufgabe, Adresse, Betrag und Link', () => {
    const n = nachricht({ zustand: 'visum', adresse: 'Musterweg 12', ort: '8400 Winterthur', preis: 3_450_000, link: 'https://wohntraums.life/calc?calc=1', von: 'David',
      an: [{ id: '1', name: 'TEST Tim', titel: null, email: 'test@example.com', telefon: '079 000 00 00', firma: 'stimo', rollen: ['visum'], user_id: null, reihe: 0 }] })!;
    expect(n.text).toMatch(/Bitte den Kaufpreis visieren: Musterweg 12, 8400 Winterthur \(CHF 3’450’000\)/);
    expect(n.mail).toMatch(/^mailto:test%40example\.com\?subject=CALC/);
    expect(n.whatsapp).toMatch(/^https:\/\/wa\.me\/41790000000\?text=/);
    expect(nachricht({ zustand: 'gesendet', adresse: 'x', ort: '', preis: null, link: '', von: '', an: [] })).toBeNull();
  });
});

// Das PDF, gelesen wie von einem Menschen.
const schriften = async (pfad: string) => { const b = readFileSync(join('public', pfad)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };
const pdftotext = !spawnSync('pdftotext', ['-v']).error;

async function lesen(vorlage: VorlageId, firma: keyof typeof FIRMEN, schrift: 'nunito' | 'helvetica' | 'carlito' | 'dmsans' | 'serif') {
  const k = kontext(vorlage, { firma: FIRMEN[firma] });
  const b = brief(vorlage, k);
  const doc = await angebotPdf({
    firma: FIRMEN[firma], schrift, brief: b, preis: k.preis, felder: { ...k.felder, kontakt: { name: 'TEST', titel: '', telefon: '+41 79 000 00 00', email: 'test@example.com' } },
    adressbloecke: adressbloecke(k.personen), anrede: anrede(k.personen), titel: 'Musterweg 12', untertitel: '8400 Winterthur-Seen', kat: 'Kat.-Nr. SE9999', test: true,
  }, schriften);
  const ort = join(mkdtempSync(join(tmpdir(), 'angebot-')), 'a.pdf');
  writeFileSync(ort, Buffer.from(doc.output('arraybuffer')));
  return { seiten: doc.getNumberOfPages(), text: spawnSync('pdftotext', ['-layout', ort, '-'], { encoding: 'utf8' }).stdout };
}

describe.skipIf(!pdftotext)('Angebot: das PDF', () => {
  it('stimo wie die Arbergstrasse: Deckblatt, Brief, Über uns, Unterschrift', async () => {
    const { seiten, text } = await lesen('bauland', 'stimo', 'nunito');
    expect(seiten).toBeGreaterThanOrEqual(4);
    const flach = text.replace(/\s+/g, ' ');
    for (const s of ['K A U F A N G E B O T', 'MUSTERWEG 12', 'Anna & Peter Muster', 'Kloten, 10.12.2026', 'Sehr geehrte Frau Muster, sehr geehrter Herr Muster',
      'CHF 3’450’000', 'Kat.-Nr. SE9999', 'ÜBER UNS', 'Freundliche Grüsse', 'TEST Unterschrift', '„Wir suchen Bauland“', 'Lindengartenstrasse 6', 'TEST']) {
      expect(flach, s).toContain(s.replace(/\s+/g, ' '));
    }
  }, 30_000);

  it('Lebensraum mit nummerierten Bedingungen und Zahlung, Studer wie seine Vorlage mit Preis in Worten', async () => {
    const l = (await lesen('bedingt', 'lebensraum', 'helvetica')).text.replace(/\s+/g, ' ');
    for (const s of ['Lebensraum Schweiz AG', 'B E D I N G U N G E N', '01 Kaufobjekt', 'Anzahlung', 'Restkaufpreis', 'CHF 3’200’000', 'Seite 1']) expect(l, s).toContain(s);
    const st = (await lesen('unverbindlich', 'studer', 'helvetica')).text.replace(/\s+/g, ' ');
    for (const s of ['Studer Immobilien Schweiz AG | Sihleggstrasse 23', 'Wollerau, 10. Dezember 2026', 'Unverbindliches Kaufangebot', "CHF 3'450'000.- (drei Millionen vierhundertfünfzigtausend)",
      "Kaufpreis: CHF 3'450'000.-, umfassend das Grundstück mit der Parzellennummer SE9999.", 'Gültigkeit: Dieses Angebot ist gültig bis zum 21. Januar 2027.', 'Freundliche Grüsse']) {
      expect(st, s).toContain(s);
    }
  }, 30_000);

  it('alle Schriften setzen Umlaute und Apostroph', async () => {
    for (const s of ['dmsans', 'serif'] as const) {
      const { text } = await lesen('bestand', 'stimo', s);
      expect(text, s).toMatch(/Übernahme erfolgt im heutigen Zustand/);
      expect(text, s).toMatch(/CHF 3’450’000/);
    }
  }, 30_000);

  it('der Dateiname wie in den Vorlagen', () => {
    expect(angebotDateiname('Glattalstrasse 138–142', '2026-09-23')).toBe('Kaufangebot_Glattalstrasse138142_2026-09-23.pdf');
    expect(angebotDateiname('Zürichstrasse 5', '2026-01-02')).toBe('Kaufangebot_Zurichstrasse5_2026-01-02.pdf');
  });
});

describe('Angebot, 20. November', () => {
  it('Lebensraum ist keine Vorlage mehr, frühere Angebote bleiben lesbar', () => {
    expect(FIRMEN_WAHL).toEqual(['stimo', 'studer']);
    expect(FIRMEN.lebensraum.name).toBe('Lebensraum Schweiz AG');
  });
  it('das Deckblatt zeigt das Haus: Ausschnitt nach der Grösse des Grundstücks', () => {
    const k = (flaeche: number) => ({ parzellen: [], eingaben: { eingabe: { grundlage: { flaeche } } } });
    expect(deckblattBreite(k(101))).toBe(80);
    expect(deckblattBreite(k(900))).toBe(120);
    expect(deckblattBreite(k(20_000))).toBe(160);
  });
});
