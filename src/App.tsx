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
const Index = lazy(() => import("./pages/Index.tsx"));
const SwipePage = lazy(() => import("./pages/SwipePage.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Anfrage = lazy(() => import("./pages/Anfrage.tsx"));
const FondsSeite = lazy(() => import("./pages/Fonds.tsx"));

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
            hinter eine Anmeldung -- alle Seiten, auch /swipe; offen sind nur
            die drei Anfrage-Seiten, die nichts lesen können. */}
        <BrowserRouter>
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <Routes>
              {/* Die drei öffentlichen Seiten -- die einzigen Ausnahmen.
                  Sie können nur eine Anfrage einfügen, nichts lesen
                  (20261101240000_anfrage.sql). Alles andere bleibt
                  hinter dem Torwächter. */}
              <Route path="/bewertung" element={<Anfrage art="bewertung" />} />
              <Route path="/potenzial" element={<Anfrage art="potenzial" />} />
              <Route path="/investor" element={<Anfrage art="investor" />} />
              {/* Wohntraums, die Oberfläche für Fondsleitungen: eigene
                  Adresse, eigene Anmeldung. */}
              <Route path="/fonds" element={<FondsSeite />} />
              <Route path="*" element={
                <Torwaechter>
                  <GlobalListeners />
                  <Suspense fallback={<div className="min-h-screen bg-background" />}>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      {/* Jeder Bereich hat seine Adresse (/zentrale, /baugesuche ...),
                          damit "Zurück" im Browser funktioniert. */}
                      <Route path="/:bereich" element={<Index />} />
                      <Route path="/swipe" element={<SwipePage />} />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </Torwaechter>
              } />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </CantonProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
