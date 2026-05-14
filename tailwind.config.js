/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1.5rem",
        lg: "2rem",
      },
    },
    extend: {
      colors: {
        bg: {
          DEFAULT: "var(--color-bg)",
          primary: "var(--color-bg-primary)",
          secondary: "var(--color-bg-secondary)",
          tertiary: "var(--color-bg-tertiary)",
        },
        surface: {
          DEFAULT: "var(--color-surface)",
          raised: "var(--color-surface-raised)",
        },
        border: {
          DEFAULT: "var(--color-border)",
          strong: "var(--color-border-strong)",
          light: "var(--color-border-light)",
        },
        text: {
          DEFAULT: "var(--color-text)",
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          tertiary: "var(--color-text-tertiary)",
        },
        brand: {
          DEFAULT: "var(--color-brand)",
          light: "var(--color-brand-light)",
          dark: "var(--color-brand-dark)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
          subtle: "var(--color-accent-subtle)",
          light: "var(--color-accent-light)",
          dark: "var(--color-accent-dark)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          subtle: "var(--color-success-subtle)",
          light: "var(--color-success-light)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          subtle: "var(--color-warning-subtle)",
          light: "var(--color-warning-light)",
        },
        error: {
          DEFAULT: "var(--color-error)",
          subtle: "var(--color-error-subtle)",
          light: "var(--color-error-light)",
        },
      },
      fontFamily: {
        display: ['"Nunito"', '"Noto Sans SC"', 'sans-serif'],
        heading: ['"Nunito"', '"Noto Sans SC"', 'sans-serif'],
        body: ['"Noto Sans SC"', '"Nunito"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        sm: "12px",
        md: "16px",
        lg: "20px",
        xl: "28px",
        card: "20px",
        button: "16px",
        input: "16px",
      },
      boxShadow: {
        "1": "var(--shadow-1)",
        "2": "var(--shadow-2)",
        "3": "var(--shadow-3)",
        card: "var(--shadow-1)",
        "card-hover": "var(--shadow-2)",
        dropdown: "var(--shadow-2)",
        modal: "var(--shadow-3)",
      },
      transitionDuration: {
        micro: "120ms",
        standard: "200ms",
        emphasized: "350ms",
        exit: "150ms",
      },
      transitionTimingFunction: {
        "out-quart": "cubic-bezier(0.25, 1, 0.5, 1)",
        "out-quint": "cubic-bezier(0.22, 1, 0.36, 1)",
        "in-quad": "cubic-bezier(0.55, 0, 1, 0.45)",
      },
      spacing: {
        18: "4.5rem",
        88: "22rem",
        112: "28rem",
        144: "36rem",
      },
      keyframes: {
        "skeleton-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        "modal-backdrop-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "modal-slide-up": {
          from: { opacity: "0", transform: "translateY(12px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "dropdown-in": {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        spin: {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
      animation: {
        "skeleton-pulse": "skeleton-pulse 2s ease-in-out infinite",
        "modal-backdrop-in": "modal-backdrop-in 200ms var(--ease-out-quart)",
        "modal-slide-up": "modal-slide-up 350ms var(--ease-out-quint)",
        "dropdown-in": "dropdown-in 150ms var(--ease-out-quart)",
        "fade-in": "fade-in 200ms var(--ease-out-quart)",
        "slide-up": "slide-up 200ms var(--ease-out-quart)",
        "slide-down": "slide-down 200ms var(--ease-out-quart)",
        "scale-in": "scale-in 200ms var(--ease-out-quart)",
        spin: "spin 800ms linear infinite",
        shimmer: "shimmer 1.5s ease-in-out infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
