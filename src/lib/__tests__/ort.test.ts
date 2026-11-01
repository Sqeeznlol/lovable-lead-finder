import { describe, expect, it } from 'vitest';
import { ortText } from '../ort';

describe('Ort zur Adresse', () => {
  it('liest die Antwort von geojs', () => {
    expect(ortText({ ip: '1.2.3.4', city: 'Zürich', region: 'Zurich', country: 'Switzerland', country_code: 'CH' }))
      .toEqual({ text: 'Zürich, Zurich · CH', ip: '1.2.3.4' });
  });
  it('liest die Antwort von ipwho.is und lässt die doppelte Region weg', () => {
    expect(ortText({ success: true, ip: '5.6.7.8', city: 'Basel', region: 'Basel', country: 'Switzerland', country_code: 'CH' }))
      .toEqual({ text: 'Basel · CH', ip: '5.6.7.8' });
  });
  it('gibt nichts, wenn der Dienst nichts weiss oder einen Fehler meldet', () => {
    expect(ortText({ success: false, message: 'reserved range' })).toBeNull();
    expect(ortText({ ip: '10.0.0.1' })).toBeNull();
    expect(ortText(null)).toBeNull();
  });
  it('kommt mit nur dem Land aus', () => {
    expect(ortText({ country: 'Switzerland', ip: '9.9.9.9' })).toEqual({ text: 'Switzerland', ip: '9.9.9.9' });
  });
});
