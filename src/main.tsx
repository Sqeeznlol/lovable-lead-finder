import { createRoot } from "react-dom/client";
import { benenneEigenenTab } from "@/lib/fenster";
import App from "./App.tsx";
import "./index.css";
import { FASSUNG } from "./lib/fassung";

// Damit im Browser und von aussen nachpruefbar ist, welcher Stand hier
// laeuft -- ohne Klicken, ohne Raten.
(window as unknown as { bauraumFassung: string }).bauraumFassung = FASSUNG;

// Der eigene Tab bekommt seinen Namen, bevor irgendetwas oeffnet --
// sonst kommt das Lesezeichen nicht hierher zurueck, sondern macht
// einen zweiten "Bauraum" auf.
benenneEigenenTab();

createRoot(document.getElementById("root")!).render(<App />);
