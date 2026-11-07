import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useSchliessen, useUrlSetzen, useUrlWert } from '../use-url-wert';

let api: { wert: string | null; setze: (v: string | null) => void; viele: (w: Record<string, string | null>) => void; zu: () => void; ort: string };
function Probe() {
  const [wert, setze] = useUrlWert('vorhaben');
  const viele = useUrlSetzen();
  const zu = useSchliessen('vorhaben');
  const l = useLocation();
  api = { wert, setze, viele, zu, ort: l.pathname + l.search };
  return null;
}

describe('Zustand in der Adresse', () => {
  it('setzt, liest und entfernt einen Wert', () => {
    render(<MemoryRouter initialEntries={['/zentrale']}><Probe /></MemoryRouter>);
    expect(api.wert).toBeNull();
    act(() => api.setze('v1'));
    expect(api.ort).toBe('/zentrale?vorhaben=v1');
    expect(api.wert).toBe('v1');
    act(() => api.setze(null));
    expect(api.ort).toBe('/zentrale');
  });

  it('Schliessen geht zurück, wenn in der App geöffnet', () => {
    render(<MemoryRouter initialEntries={['/zentrale?reiter=akquise']}><Probe /></MemoryRouter>);
    act(() => api.setze('v2'));
    act(() => api.zu());
    expect(api.ort).toBe('/zentrale?reiter=akquise');
  });

  it('mehrere Werte in einem Schritt, andere bleiben stehen', () => {
    render(<MemoryRouter initialEntries={['/zentrale?neu=1&reiter=aktiv']}><Probe /></MemoryRouter>);
    act(() => api.viele({ neu: null, vorhaben: 'v3' }));
    expect(api.ort).toBe('/zentrale?reiter=aktiv&vorhaben=v3');
  });
});
