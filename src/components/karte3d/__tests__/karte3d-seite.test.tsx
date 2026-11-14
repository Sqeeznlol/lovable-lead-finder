import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Cesium braucht WebGL; hier geht es nur um Kopfzeile und Zurück.
vi.mock('@/components/karte3d/Karte3D', () => ({ Karte3D: () => <div data-testid="karte" /> }));
import { Karte3DSeite } from '@/components/karte3d/Karte3DSeite';

function Ort() { return <div data-testid="ort">{useLocation().pathname}</div>; }
const zeigen = (eintraege: string[]) => render(
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter initialEntries={eintraege} initialIndex={eintraege.length - 1}>
      <Routes><Route path="/karte3d" element={<Karte3DSeite />} /><Route path="*" element={<Ort />} /></Routes>
    </MemoryRouter>
  </QueryClientProvider>,
);

describe('3D-Karte als eigene Seite', () => {
  // Julian, 14. November, als App auf dem iPhone: "ich kann nicht mehr weg von dieser Ansicht".
  it('Statusleiste kommt zur Kopfzeile dazu, die Kopfzeile bleibt 56 px hoch', () => {
    zeigen(['/karte3d']);
    const zurueck = screen.getByRole('button', { name: 'Zurück' });
    const zeile = zurueck.parentElement!, aussen = zeile.parentElement!;
    expect(zeile.className).toMatch(/\bh-14\b/);
    expect(zeile.className).not.toMatch(/safe-area/);
    expect(aussen.className).toMatch(/pt-\[env\(safe-area-inset-top\)\]/);
    expect(aussen.className).not.toMatch(/\bh-14\b/);
  });
  it('Direkt geöffnet führt Zurück zur Startseite statt ins Leere', () => {
    window.history.replaceState(null, '');
    zeigen(['/karte3d']);
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(screen.getByTestId('ort').textContent).toBe('/');
  });
});
