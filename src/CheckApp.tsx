import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import type { Marke } from '@/lib/check-marken';

const Check = lazy(() => import('./pages/Check.tsx'));
const Ratgeber = lazy(() => import('./pages/Ratgeber.tsx'));

/**
 * Der Einstieg auf den Marken-Domains: nur Check und Ratgeber, ohne
 * Anmeldung, Abfrage-Cache und Oberflächenbausteine der internen App.
 * Lighthouse auf dem Handy, 15. November: diese Teile und die
 * Datenbank-Bibliothek luden mit, ohne gebraucht zu werden (rund 130 KB
 * ungenutztes JavaScript vor dem ersten Bild).
 */
export default function CheckApp({ marke }: { marke: Marke }) {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen" />}>
        <Routes>
          <Route path="/ratgeber/:artikel" element={<Ratgeber marke={marke} />} />
          <Route path="/heizung" element={<Check marke={marke} modus="heizung" />} />
          <Route path="/gemeinde/:ort" element={<Check marke={marke} modus="gemeinde" />} />
          <Route path="/gemeinden" element={<Check marke={marke} modus="gemeinden" />} />
          <Route path="*" element={<Check marke={marke} />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
