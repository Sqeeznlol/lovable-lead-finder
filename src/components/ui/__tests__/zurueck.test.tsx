import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

// Julian, 14. November, als App auf dem iPhone: auf mehreren Seiten kein Weg zurück. Die
// Statusleiste (47 px) lag über dem Kreuz; ein Seitenblatt füllt die ganze Breite, ein Dialog
// scrollte das Kreuz mit weg.
describe('Immer ein Weg zurück', () => {
  it('Seitenblatt: Kreuz unter der Statusleiste, 44 px, steht beim Scrollen', () => {
    render(<Sheet open><SheetContent><SheetTitle>Lead</SheetTitle><p>Inhalt</p></SheetContent></Sheet>);
    const zu = screen.getByRole('button', { name: 'Schliessen' });
    expect(zu.className).toMatch(/top-\[calc\(env\(safe-area-inset-top\)/);
    expect(zu.className).toMatch(/\bh-11\b/); expect(zu.className).toMatch(/\bw-11\b/);
    expect(zu.className).toMatch(/\bfixed\b/);
    expect(screen.getByRole('dialog').className).toMatch(/pt-\[calc\(env\(safe-area-inset-top\)/);
  });
  it('Dialog: Kreuz klebt oben und steht vor dem Inhalt, Kasten bleibt in der sicheren Fläche', () => {
    render(<Dialog open><DialogContent><DialogTitle>Parzelle</DialogTitle><p>Inhalt</p></DialogContent></Dialog>);
    const zu = screen.getByRole('button', { name: 'Schliessen' }), kasten = screen.getByRole('dialog');
    expect(zu.className).toMatch(/\bsticky\b/); expect(zu.className).toMatch(/\bh-11\b/);
    expect(kasten.firstElementChild).toBe(zu);
    expect(kasten.className).toMatch(/max-h-\[calc\(100dvh-env\(safe-area-inset-top\)/);
    expect(kasten.className).toMatch(/overflow-y-auto/);
  });
});
