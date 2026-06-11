import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          purple: "var(--neon-purple)",
          "purple-dark": "var(--neon-purple-dark)",
          "purple-tint": "var(--neon-purple-tint)",
          pink: "var(--neon-pink)",
          "pink-dark": "var(--neon-pink-dark)",
          green: "var(--neon-green)",
        },
        bg: {
          DEFAULT: "var(--bg)",
          secondary: "var(--bg-secondary)",
          tertiary: "var(--bg-tertiary)",
          card: "var(--bg-card)",
          elevated: "var(--bg-elevated)",
          panel: "var(--bg-panel)",
        },
        border: {
          DEFAULT: "var(--border)",
          subtle: "var(--border-subtle)",
          glass: "var(--border-glass)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          faint: "var(--text-faint)",
          soft: "var(--text-soft)",
        },
        surface: {
          hover: "var(--surface-hover)",
          elevated: "var(--surface-elevated)",
          overlay: "var(--surface-overlay)",
          "overlay-hover": "var(--surface-overlay-hover)",
          "overlay-strong": "var(--surface-overlay-strong)",
        },
        accent: {
          on: "var(--on-accent)",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "Menlo", "Monaco", "monospace"],
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0, 0, 0, 0.4)",
        "neon-green": "0 0 20px rgba(0, 255, 159, 0.15)",
        "neon-pink": "0 0 20px rgba(255, 0, 170, 0.15)",
      },
      backdropBlur: {
        xs: "2px",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
        "scale-in": "scaleIn 0.2s cubic-bezier(0.32, 0.72, 0, 1)",
        "confetti-pop": "confettiPop 0.4s ease-out forwards",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.96)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        confettiPop: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "50%": { transform: "scale(1.1)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
