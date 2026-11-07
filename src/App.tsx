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
const Index = lazy(() => import("./pages/Index.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const FondsSeite = lazy(() => import("./pages/Fonds.tsx"));

// Die Akquise (Eigentümerabfrage, Nummern, Pipedrive, Erweiterung,
// Check-Seiten, Ratgeber, Anfrage-Seiten) ist seit dem 7. November ein
// eigenes Programm: Repository-Zweig "akquise", später bauraum-akquise.
// Julian: "alles Akquise ... separiert im Git ... dann weg von der Webseite".

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <AuthProvider>
    <CantonProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {/* Die Liste enthält Adressen und Eigentümernamen von Menschen,
            die nie um ihre Aufnahme gebeten haben. Sie gehört hinter eine
            Anmeldung -- alle Seiten. */}
        <BrowserRouter>
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <Routes>
              {/* Wohntraums, die Oberfläche für Fondsleitungen: eigene
                  Adresse, eigene Anmeldung. */}
              <Route path="/fonds" element={<FondsSeite />} />
              <Route path="/fonds/:bereich" element={<FondsSeite />} />
              <Route path="*" element={
                <Torwaechter>
                  <Suspense fallback={<div className="min-h-screen bg-background" />}>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      {/* Jeder Bereich hat seine Adresse (/zentrale, /baugesuche ...),
                          damit "Zurück" im Browser funktioniert. */}
                      <Route path="/:bereich" element={<Index />} />
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
