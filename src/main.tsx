import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { FASSUNG } from "./lib/fassung";

// Damit im Browser und von aussen nachpruefbar ist, welcher Stand hier
// laeuft -- ohne Klicken, ohne Raten.
(window as unknown as { bauraumFassung: string }).bauraumFassung = FASSUNG;

createRoot(document.getElementById("root")!).render(<App />);
