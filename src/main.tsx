import { createRoot } from "react-dom/client";
import { benenneEigenenTab } from "@/lib/fenster";
import App from "./App.tsx";
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

createRoot(document.getElementById("root")!).render(<App />);
