import { describe, expect, it } from 'vitest';
import { berichtLink, mailLink, naechsterSchritt } from '../nachfass';

const lead = { name: 'TEST Muster', adresse: 'Seestrasse 147, 8800 Thalwil', erstellt_am: '2026-11-10T10:00:00Z', bearbeitet: false,
  angaben: { domain: 'www.hauschecker.ch', lv95: [2685000, 1238000] }, nachfass_stufe: 0 };

describe('Nachfass-Abfolge', () => {
  it('Tag 1, Tag 7, 3 Monate, gezählt ab Eingang', () => {
    const h = new Date('2026-11-15T10:00:00Z');
    expect(naechsterSchritt(lead, h)).toMatchObject({ stufe: 0, titel: 'Bericht senden', jetzt: true });
    expect(naechsterSchritt({ ...lead, nachfass_stufe: 1 }, h)).toMatchObject({ stufe: 1, jetzt: false });
    expect(naechsterSchritt({ ...lead, nachfass_stufe: 1 }, h)!.faellig.toISOString()).toBe('2026-11-17T10:00:00.000Z');
    expect(naechsterSchritt({ ...lead, nachfass_stufe: 2 }, h)!.faellig.toISOString()).toBe('2027-02-08T10:00:00.000Z');
    expect(naechsterSchritt({ ...lead, nachfass_stufe: 3 }, h)).toBeNull();
    expect(naechsterSchritt({ ...lead, bearbeitet: true }, h)).toBeNull();
  });
  it('Mail mit Link zum Bericht auf der Domain des Leads', () => {
    expect(berichtLink(lead)).toBe('https://www.hauschecker.ch/?adresse=Seestrasse+147%2C+8800+Thalwil&e=2685000&n=1238000');
    const s = naechsterSchritt(lead)!;
    expect(s.text).toContain(berichtLink(lead));
    expect(mailLink('test@example.ch', s)).toMatch(/^mailto:test@example\.ch\?subject=Ihre%20Analyse/);
    expect(berichtLink({ ...lead, angaben: {} })).toBeNull();
  });
});
