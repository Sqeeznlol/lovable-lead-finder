import { createRoot } from "react-dom/client";
import { benenneEigenenTab } from "@/lib/fenster";
import { lazy, Suspense } from "react";
import { markeFuerHost } from "@/lib/check-marken";
import "./index.css";
import { FASSUNG } from "./lib/fassung";
import { neuLadenEinmal } from "./lib/neue-fassung";

// Damit im Browser und von aussen nachpruefbar ist, welcher Stand hier
// laeuft -- ohne Klicken, ohne Raten.
(window as unknown as { bauraumFassung: string }).bauraumFassung = FASSUNG;

// Der eigene Tab bekommt seinen Namen, bevor irgendetwas oeffnet --
// sonst kommt das Lesezeichen nicht hierher zurueck, sondern macht
// einen zweiten "Bauraum" auf.
benenneEigenenTab();

// Vite meldet, wenn ein nachgeladener Programmteil fehlt (neue Fassung
// ausgeliefert, diese Seite noch alt): dann einmal neu laden.
window.addEventListener("vite:preloadError", (e) => {
  if (neuLadenEinmal()) e.preventDefault();
});

// Auf einer Marken-Domain nur der schlanke Einstieg (CheckApp), sonst die ganze App.
const marke = markeFuerHost(window.location.hostname);
const App = lazy(() => import("./App.tsx"));
const CheckApp = lazy(() => import("./CheckApp.tsx"));
createRoot(document.getElementById("root")!).render(
  <Suspense fallback={null}>{marke ? <CheckApp marke={marke} /> : <App />}</Suspense>,
);
