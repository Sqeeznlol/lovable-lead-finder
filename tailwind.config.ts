import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        // Signalfarben der Vorlage (DESIGN.md): Orange nur für "heiss",
        // Violett für Beträge, Grün für "verfügbar".
        heiss: "hsl(var(--heiss) / <alpha-value>)",
        violett: "hsl(var(--violett) / <alpha-value>)",
        gruen: "hsl(var(--gruen) / <alpha-value>)",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          primary: "hsl(var(--sidebar-primary) / <alpha-value>)",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground) / <alpha-value>)",
          accent: "hsl(var(--sidebar-accent) / <alpha-value>)",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      fontFamily: {
        // Urbanist, geometrisch wie in der Vorlage (DESIGN.md).
        sans: ["'Urbanist'", "system-ui", "sans-serif"],
        // "serif" bleibt als Name, damit bestehende Klassen nicht brechen --
        // es ist dieselbe Familie (eine Schrift für alles).
        serif: ["'Urbanist'", "system-ui", "sans-serif"],
      },
      borderRadius: {
        // Fast eckig wie in der Vorlage: 4 px für Tafeln, 2 px für Knöpfe.
        "2xl": "var(--radius)",
        xl: "var(--radius)",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
      },
      boxShadow: {
        ceramic: "var(--shadow-ceramic)",
        "ceramic-hover": "var(--shadow-ceramic-hover)",
        "inner-glow": "var(--shadow-inner-glow)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0", opacity: "0" }, to: { height: "var(--radix-accordion-content-height)", opacity: "1" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)", opacity: "1" }, to: { height: "0", opacity: "0" } },
        "fade-in": { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "scale-in": { "0%": { transform: "scale(0.97)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
        // Bewegung nach DESIGN.md: Tafeln steigen gestaffelt auf, das
        // Luftbild zoomt langsam auf, Striche füllen sich nacheinander.
        "aufsteigen": { "0%": { opacity: "0", transform: "translateY(14px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        "luftbild": { "0%": { transform: "scale(1.08)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
        "strich": { "0%": { transform: "scaleY(0.15)", opacity: "0.2" }, "100%": { transform: "scaleY(1)", opacity: "1" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s ease-out",
        "scale-in": "scale-in 0.3s ease-out",
        "aufsteigen": "aufsteigen 0.55s cubic-bezier(.2,.7,.2,1) both",
        "luftbild": "luftbild 1.4s cubic-bezier(.2,.7,.2,1) both",
        "strich": "strich 0.35s ease-out both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
