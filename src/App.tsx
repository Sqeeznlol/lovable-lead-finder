import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { CantonProvider } from "@/hooks/use-canton";
import { AuthProvider } from "@/hooks/use-auth";
import { Torwaechter } from "@/components/Torwaechter";
import { useEigentuemerLookupListener } from "@/hooks/use-eigentuemer-lookup";
import { AuskunftAusLesezeichen } from "@/components/AuskunftAusLesezeichen";
import { markeFuerHost } from "@/lib/check-marken";
const Index = lazy(() => import("./pages/Index.tsx"));
const SwipePage = lazy(() => import("./pages/SwipePage.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Anfrage = lazy(() => import("./pages/Anfrage.tsx"));
const Check = lazy(() => import("./pages/Check.tsx"));
const Ratgeber = lazy(() => import("./pages/Ratgeber.tsx"));

/**
 * Bauraum Akquise: ein eigenes Programm, getrennt von wohntraums.life
 * (Julian, 7. November: "alles Akquise ... separiert im Git ... dann weg
 * von der Webseite"). Es teilt nur die Datenbank mit der Webseite.
 *
 * Drei Teile:
 *   - die Akquise hinter der Anmeldung: Übersicht, Abfrage, Gebäudesuche,
 *     Nummern, Pipedrive und die stillgelegten Werkzeuge;
 *   - die Check-Seiten und der Ratgeber, auf ihren eigenen Domains offen;
 *   - die Anfrage-Seiten Bewertung, Potenzial, Investor, ebenfalls offen.
 */

// Auf einer Marken-Domain (parzellenchecker.ch, hauschecker.ch ...) ist
// die ganze Seite der Check -- ohne Anmeldung, ohne Akquise dahinter.
const CHECK_MARKE = typeof window !== "undefined" ? markeFuerHost(window.location.hostname) : null;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function GlobalListeners() {
  useEigentuemerLookupListener();
  // Das Lesezeichen bringt die Auskunft hinter der Raute mit; hier
  // wird sie entgegengenommen, gleich auf welcher Seite man landet.
  return <AuskunftAusLesezeichen />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <AuthProvider>
    <CantonProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {/* Die Liste enthält Adressen, Eigentümernamen und Nummern von
            Menschen, die nie um ihre Aufnahme gebeten haben. Sie gehört
            hinter eine Anmeldung; offen sind nur die Seiten, die nichts
            lesen können. */}
        <BrowserRouter>
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
            {CHECK_MARKE ? (
              <Routes>
                <Route path="/ratgeber/:artikel" element={<Ratgeber marke={CHECK_MARKE} />} />
                <Route path="*" element={<Check marke={CHECK_MARKE} />} />
              </Routes>
            ) : (
            <Routes>
              {/* Die Check-Seiten zur Vorschau: /check, /check/hauschecker ... */}
              <Route path="/check" element={<Check />} />
              <Route path="/check/:marke" element={<Check />} />
              <Route path="/check/:marke/ratgeber/:artikel" element={<Ratgeber />} />
              {/* Die drei Anfrage-Seiten können nur eine Anfrage einfügen,
                  nichts lesen (Migration 20261101240000_anfrage.sql im
                  Repository der Webseite). */}
              <Route path="/bewertung" element={<Anfrage art="bewertung" />} />
              <Route path="/potenzial" element={<Anfrage art="potenzial" />} />
              <Route path="/investor" element={<Anfrage art="investor" />} />
              <Route path="*" element={
                <Torwaechter>
                  <GlobalListeners />
                  <Suspense fallback={<div className="min-h-screen bg-background" />}>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      {/* Jeder Bereich hat seine Adresse (/nummern, /pipedrive ...),
                          damit "Zurück" im Browser funktioniert. */}
                      <Route path="/:bereich" element={<Index />} />
                      <Route path="/swipe" element={<SwipePage />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </Torwaechter>
              } />
            </Routes>
            )}
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </CantonProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
