import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Dark "night shift" theme. Class names kept from v1 so components stay readable:
        paper: "#0A0B09", // page background
        sheet: "#121410", // card surface
        raise: "#1A1D17", // raised surface
        ink: "#EEECE2", // main text, ivory
        inksoft: "#9B9E92", // secondary text
        rule: "#2A2E25", // borders
        stamp: "#FF5E4F", // red: rejected, fired, warnings
        marker: "#F1E05A", // accent yellow
        ok: "#5CD38C",
      },
      fontFamily: {
        display: ["'Bricolage Grotesque Variable'", "system-ui", "sans-serif"],
        sans: ["'Geist Variable'", "system-ui", "sans-serif"],
        mono: ["'Geist Mono Variable'", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
