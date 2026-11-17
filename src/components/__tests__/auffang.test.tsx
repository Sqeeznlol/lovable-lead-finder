import { useEffect, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Auffang } from '@/components/Auffang';

/**
 * Die Bereiche stecken in einem Auffang mit dem Bereich als Schlüssel: beim
 * Wechsel verschwindet er mit seinem Inhalt. Wirft der alte Bereich beim
 * Aufräumen, fängt ihn darum niemand -- am 17. November war nach "Zurück"
 * aus der 3D-Karte die ganze Seite leer. Der Auffang um die ganze
 * Anwendung hält das auf.
 */
// Nur beim ersten Verlassen: sonst würfe auch das Abräumen am Ende des Tests.
let bricht = true;
function Bricht() {
  useEffect(() => () => { if (bricht) { bricht = false; throw new Error('kaputt beim Aufräumen'); } }, []);
  return <p>Bereich A</p>;
}
function Seite() {
  const [bereich, setBereich] = useState('a');
  return (
    <>
      <button type="button" onClick={() => setBereich('b')}>weiter</button>
      <Auffang key={bereich} bereich={bereich}>{bereich === 'a' ? <Bricht /> : <p>Bereich B</p>}</Auffang>
    </>
  );
}

describe('Auffang um die ganze Anwendung', () => {
  afterEach(() => { cleanup(); vi.restoreAllMocks(); bricht = true; });

  it('ein Fehler beim Verlassen eines Bereichs leert die Seite nicht', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // React meldet den Fehler in der Entwicklungsfassung zusätzlich am Fenster;
    // ohne eigenen Hörer nähme der Test das als unbehandelten Fehler.
    const still = (e: ErrorEvent) => e.preventDefault();
    window.addEventListener('error', still);
    try {
      render(<Auffang bereich="Die Seite" ganz><Seite /></Auffang>);
      expect(screen.getByText('Bereich A')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'weiter' }));
      // Statt nichts: die Meldung, und ein Tipp führt weiter.
      expect(screen.getByText('Die Seite konnte nicht angezeigt werden.')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Nochmals versuchen' }));
      expect(screen.getByRole('button', { name: 'weiter' })).toBeTruthy();
    } finally { window.removeEventListener('error', still); }
  });
  it('ohne das Netz bliebe nichts stehen', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const still = (e: ErrorEvent) => e.preventDefault();
    window.addEventListener('error', still);
    try {
      const { container } = render(<Seite />);
      try { fireEvent.click(screen.getByRole('button', { name: 'weiter' })); } catch { /* React wirft den Fehler weiter */ }
      expect(container.textContent).toBe('');
    } finally { window.removeEventListener('error', still); }
  });
});
