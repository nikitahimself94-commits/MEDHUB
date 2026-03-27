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
        /* Semantic tokens — dark theme (MEDHUB_BRIEF_2026) */
        background: "var(--bg-primary)",
        foreground: "var(--text-primary)",
        surface: {
          DEFAULT: "var(--bg-surface)",
          hover: "var(--bg-surface-hover)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          muted: "var(--accent-muted)",
        },
        amber: "var(--amber)",
        "text-primary": "var(--text-primary)",
        "text-muted": "var(--text-muted)",
        border: "var(--border)",

        /* Legacy brand scale — kept for backward compatibility with
           existing .tsx inline styles until Module Color Sweep (Chunk 4).
           Will be removed after all components migrate to semantic tokens. */
        brand: {
          50: "#EDF2F1",
          100: "#D4E0DE",
          200: "#C8D5D2",
          300: "#8AA8A2",
          400: "#5A8F85",
          500: "#3A7A74",
          600: "#2D6E6A",
          700: "#245B57",
          800: "#1E4A47",
          900: "#1A2F2B",
        },
      },
      boxShadow: {
        glow: "var(--glow)",
      },
    },
  },
  plugins: [],
};
export default config;
