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
        background: "var(--background)",
        foreground: "var(--foreground)",
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
    },
  },
  plugins: [],
};
export default config;
