import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--color-bg-primary)",
        "canvas-secondary": "var(--color-bg-secondary)",
        surface: "var(--color-surface)",
        "surface-elevated": "var(--color-surface-elevated)",
        ivory: "var(--color-ivory)",
        "editorial-primary": "var(--color-text-primary)",
        "editorial-secondary": "var(--color-text-secondary)",
        "editorial-muted": "var(--color-text-muted)",
        "editorial-inverse": "var(--color-text-inverse)",
        "border-subtle": "var(--color-border-soft)",
        "border-strong": "var(--color-border-strong)",
        sage: {
          50: "#F2F4EC",
          100: "#EAEEE0",
          200: "#D6DEC4",
          300: "#B8C49E",
          400: "#969E78", // brand-primary
          500: "#838B67",
          600: "#73795B", // brand-secondary
          700: "#6B7154", // button-primary
          800: "#565B43", // button-primary-hover
          900: "#454935",
        },
        olive: {
          DEFAULT: "var(--color-brand-secondary)",
          deep: "var(--color-brand-deep)",
        },
        sand: {
          50: "#FAF7F2",
          100: "#EDE6DA",
          200: "#E2D8C9",
          300: "#CEB38D",
          400: "#BA9568",
          500: "#A37D52",
        },
        greige: "var(--color-greige)",
        wood: "var(--color-accent-wood)",
      },
      fontFamily: {
        serif: ["var(--font-serif)"],
        sans: ["var(--font-sans)"],
        script: ["var(--font-script)"],
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        card: "var(--shadow-card)",
        floating: "var(--shadow-floating)",
      },
      borderRadius: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "20px",
        xl: "32px",
      },
    },
  },
  plugins: [],
};

export default config;
