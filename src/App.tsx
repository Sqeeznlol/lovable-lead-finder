import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { CantonProvider } from "@/hooks/use-canton";
import { useEigentuemerLookupListener } from "@/hooks/use-eigentuemer-lookup";
import { AuskunftAusLesezeichen } from "@/components/AuskunftAusLesezeichen";
const Index = lazy(() => import("./pages/Index.tsx"));
const SwipePage = lazy(() => import("./pages/SwipePage.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

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
    <CantonProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {/* Ohne Anmeldung: wer die Adresse kennt, ist drin. Was die
            Liste hergibt, entscheiden damit allein die Regeln der
            Datenbank -- in ihr stehen Adressen, Eigentuemernamen und
            Nummern von Menschen, die nie um ihre Aufnahme gebeten
            haben. */}
        <BrowserRouter>
          <GlobalListeners />
          <Suspense fallback={<div className="min-h-screen bg-background" />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/swipe" element={<SwipePage />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </CantonProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
