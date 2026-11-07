import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Welcher Stand ausgeliefert wurde, steht sonst nirgends: der Name des
// Buendels haengt am Inhalt, und der haengt auch an den Umgebungs-
// variablen -- zwei Bauten desselben Commits heissen verschieden. Also
// wird der Commit selbst hineingeschrieben. Vercel setzt ihn,
// GitHub Actions auch; lokal bleibt "lokal".
const fassung =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  "lokal";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  define: {
    __FASSUNG__: JSON.stringify(fassung),
  },
  build: {
    rollupOptions: {
      output: {
        // React und Supabase ändern sich fast nie, die App bei jedem
        // Push. In eigenen Dateien bleiben sie im Browser liegen, wenn
        // eine neue Fassung kommt -- statt dass jedes Mal 170 kB neu
        // geladen werden. Der Commit (__FASSUNG__) bleibt im App-Teil
        // index-*.js, dort sucht "Was ist live".
        manualChunks(id) {
          // Die Helfer von Vite (Vorladen der Teile, CommonJS) braucht jede
          // Seite. Ohne eigene Zuweisung legt Rollup sie in den ersten Teil,
          // der sie braucht -- das war Cesium, und so lud jede Seite 1,1 MB
          // 3D-Karte mit (im Bau am 3. November gesehen). Dasselbe mit tslib,
          // das Supabase und Radix auch brauchen: Rollup zieht Abhängigkeiten
          // eines zugewiesenen Teils in diesen hinein.
          if (id.includes("vite/preload-helper") || id.includes("commonjsHelpers")) return "helfer";
          if (/[\\/]node_modules[\\/]tslib[\\/]/.test(id)) return "helfer";
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|@remix-run)[\\/]/.test(id)) return "react";
          if (/[\\/]node_modules[\\/]@supabase[\\/]/.test(id)) return "supabase";
          // Cesium ist gross (rund 4 MB) und nur für die 3D-Karte da:
          // eigene Datei, die erst beim Öffnen der 3D-Karte geladen wird.
          if (/[\\/]node_modules[\\/](cesium|@cesium)[\\/]/.test(id)) return "cesium";
          return undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
