import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Suspense, type ReactNode } from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Auffang } from '@/components/Auffang';
import { nachladen } from '@/lib/neue-fassung';

/**
 * «Reiter prüfen», 17. November: der Admin-Reiter mitten in einer
 * Auslieferung zeigte «Fehler im Bereich Die Seite: Cannot read properties
 * of undefined (reading 'default')». So endet bei Vite der Import, wenn
 * main.tsx wegen eines fehlenden Programmteils neu lädt.
 */
function Bereich() { return <p>Bereich da</p>; }

function zeigen(bereich: ReactNode) {
  return render(<Auffang bereich="Test"><Suspense fallback={<p>lädt</p>}>{bereich}</Suspense></Auffang>);
}

describe('Nachgeladener Bereich', () => {
  afterEach(() => vi.useRealTimers());

  it('zeigt den Bereich, wenn sein Programmteil kommt', async () => {
    const B = nachladen(() => Promise.resolve({ Bereich }), 'Bereich');
    zeigen(<B />);
    expect(await screen.findByText('Bereich da')).toBeTruthy();
  });

  it('wartet ohne Fehler, solange die Seite neu lädt', async () => {
    vi.useFakeTimers();
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => {});
    const B = nachladen(() => Promise.resolve(undefined as unknown as { Bereich: typeof Bereich }), 'Bereich');
    zeigen(<B />);
    await act(async () => { await vi.advanceTimersByTimeAsync(14_000); });
    expect(screen.getByText('lädt')).toBeTruthy();
    expect(fehler).not.toHaveBeenCalled();
    // Kommt das Neuladen nicht, steht die fehlende Fassung da, mit Knopf.
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(screen.getByText(/Test konnte nicht angezeigt werden/)).toBeTruthy();
    expect(screen.getByText(/dynamically imported module/)).toBeTruthy();
    fehler.mockRestore();
  });
});

// Wer einen Bereich wieder mit `lazy` direkt lädt, bringt den Fehler zurück.
function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap(n => {
    const p = join(ordner, n);
    return statSync(p).isDirectory() ? (n === '__tests__' ? [] : dateien(p)) : /\.tsx?$/.test(n) ? [p] : [];
  });
}
describe('Kein Bereich ohne den Helfer', () => {
  it('lazy steht nur in src/lib/neue-fassung.ts', () => {
    const mit = dateien('src').filter(p => !p.endsWith(join('lib', 'neue-fassung.ts')) && /\blazy\(/.test(readFileSync(p, 'utf8')));
    expect(mit).toEqual([]);
  });
});
