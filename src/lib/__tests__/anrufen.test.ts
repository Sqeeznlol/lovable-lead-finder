import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { anrufListe, telLink, woSuchen, type Anruf } from '@/lib/anrufen';

/** Julian, 22. November: «... da soll dann Tim anrufen». Testnamen nur mit TEST. */
const zeile = (id: string, owner_name: string, owner_phone: string | null = null): Anruf =>
  ({ id, address: 'TEST Musterweg 1', gemeinde: 'Zürich', owner_name, owner_phone, marge_chf: 1_000_000 });

describe('Anrufliste', () => {
  it('lässt weg, wo schon ein Gespräch erfasst ist', () => {
    const l = anrufListe([zeile('a', 'Muster Anna'), zeile('b', 'Beispiel Beat')], ['b']);
    expect(l.map(z => z.id)).toEqual(['a']);
  });

  it('ruft keine Testdaten und keine leeren Namen an', () => {
    expect(anrufListe([zeile('a', 'TEST Person'), zeile('b', '  ')], [])).toEqual([]);
  });

  it('behält die Reihenfolge der Abfrage (grösste Marge zuerst)', () => {
    expect(anrufListe([zeile('x', 'Muster X'), zeile('y', 'Muster Y')], []).map(z => z.id)).toEqual(['x', 'y']);
  });
});

describe('Telefonnummer zum Wählen', () => {
  it('nur Ziffern, ein führendes + bleibt', () => {
    expect(telLink('079 123 45 67')).toBe('tel:0791234567');
    expect(telLink('+41 (0)79 123-45-67')).toBe('tel:+41791234567');
  });
});

describe('Wo die Nummer gesucht wird', () => {
  it('am Wohnort des Eigentümers, sonst in der Gemeinde des Objekts', () => {
    expect(woSuchen({ owner_address: 'TEST Seeweg 3, 8800 Thalwil', gemeinde: 'Zürich' })).toBe('8800 Thalwil');
    expect(woSuchen({ owner_address: null, gemeinde: 'Zürich' })).toBe('Zürich');
  });
});

describe('Telefon-Knopf in der Objektansicht', () => {
  it('steht bei «Maps» und «Tel.search», wählt die eingetragene Nummer', () => {
    const t = readFileSync('src/components/PropertyDetailDialog.tsx', 'utf8');
    expect(t).toContain('href={telLink(data.owner_phone)}');
    expect(t.indexOf('href={telLink(data.owner_phone)}')).toBeGreaterThan(t.indexOf('Tel.search'));
  });
});
