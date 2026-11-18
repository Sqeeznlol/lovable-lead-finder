import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjektHinweis } from '@/components/ProjektHinweis';
import { projektAus } from '@/lib/bauprojekt';
import type { Gesuch } from '@/lib/baugesuch-belege';

/** Der Knopf aufs Projekt: Amtsblatt, solange es zeigt, sonst Gebäuderegister. */
const projekt = projektAus([{ featureId: '192104376_0', attributes: { egid: '192104376', gstat: 1002, gastw: 5, ganzwhg: 2, warea: [60, 96], gexpdat: '16.11.2026' } }]);
const gesuch = (bis: string): Gesuch => ({
  id: 'g', publiziert_am: '2025-07-25', gemeinde: 'Kloten', adresse: 'Dietlikerstrasse 49', parzelle_nr: '6424', egrid: 'CH970577700821',
  beschreibung: 'Neubau MFH', bauherrschaft: null, parzelle_id: 'p', nachbar_egrids: null, erfasst_am: '2025-07-25', quelle: 'zh-statistik',
  publikation_nr: 'BP-ZH01-0000054709', publikation_id: '9af63c78-bb8d-462e-b636-6b73d4a436f9', publiziert_bis: bis,
});
const ziel = () => screen.getByRole('link', { name: /Projekt ansehen/ }).getAttribute('href');

describe('Hinweis aufs Projekt', () => {
  it('ohne Projekt und ohne Gesuch: nichts', () => {
    const { container } = render(<ProjektHinweis projekt={null} gesuch={null} />);
    expect(container.innerHTML).toBe('');
  });
  it('Publikation noch öffentlich: Knopf aufs Amtsblatt, dazu PDF und Register', () => {
    render(<ProjektHinweis projekt={projekt} gesuch={gesuch('2099-01-01')} wo="Die Machbarkeit" />);
    expect(ziel()).toBe('https://amtsblatt.zh.ch/#!/search/publications/detail/9af63c78-bb8d-462e-b636-6b73d4a436f9');
    expect(screen.getByRole('link', { name: 'Im Gebäuderegister' })).toBeTruthy();
    expect(screen.getByText(/Die Machbarkeit rechnet mit diesen Zahlen/)).toBeTruthy();
  });
  it('Publikation abgelaufen: Knopf auf den Bau im Register, Hinweis auf die Gemeinde', () => {
    render(<ProjektHinweis projekt={projekt} gesuch={gesuch('2025-07-25')} />);
    expect(ziel()).toMatch(/^https:\/\/map\.geo\.admin\.ch\/.*features=192104376_0/);
    expect(screen.queryByRole('link', { name: 'Publikation als PDF' })).toBeNull();
    expect(screen.getByText(/liegen bei der Gemeinde Kloten/)).toBeTruthy();
  });
  it('nur ein abgelaufenes Gesuch: Knopf auf die Parzelle im Register', () => {
    render(<ProjektHinweis projekt={null} gesuch={gesuch('2025-07-25')} />);
    expect(ziel()).toMatch(/swisssearch=CH970577700821/);
  });
});
