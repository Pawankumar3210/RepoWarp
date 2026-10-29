import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["Space Grotesk Variable", "Space Grotesk", "system-ui", "sans-serif"],
        sans: ["Manrope Variable", "Manrope", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono Variable", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        ink: "rgb(var(--c-ink) / <alpha-value>)",
        muted: "rgb(var(--c-muted) / <alpha-value>)",
        faint: "rgb(var(--c-faint) / <alpha-value>)",
        base: "rgb(var(--c-base) / <alpha-value>)",
        panel: "rgb(var(--c-panel) / <alpha-value>)",
        elevated: "rgb(var(--c-elevated) / <alpha-value>)",
        aqua: "rgb(var(--c-aqua) / <alpha-value>)",
        teal: "rgb(var(--c-teal) / <alpha-value>)",
        violet: "rgb(var(--c-violet) / <alpha-value>)",
        amber: "rgb(var(--c-amber) / <alpha-value>)",
        rose: "rgb(var(--c-rose) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)",
      },
      boxShadow: {
        glow: "0 0 40px rgb(var(--c-aqua) / 0.14)",
        panel: "0 24px 80px rgb(0 0 0 / 0.22)",
      },
      animation: {
        "float-slow": "float 9s ease-in-out infinite",
        "orbit-slow": "orbit 22s linear infinite",
        "pulse-soft": "pulseSoft 4s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        orbit: {
          to: { transform: "rotate(360deg)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
