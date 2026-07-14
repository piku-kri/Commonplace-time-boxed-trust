import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        page: "#F6F0E4",
        cloth: "#5B2A2E",
        "cloth-soft": "#7A4448",
        spine: "#2E1F1A",
        gilt: "#B8863B",
        leaf: "#3F5C43",
        parchment: "#EDE3CE",
        card: "#C7B89B",
        overdue: "#A23B2E",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        stamp: "2px",
      },
      keyframes: {
        stamp: {
          "0%": { transform: "scale(1.3) rotate(3deg)", opacity: "0" },
          "60%": { transform: "scale(0.96) rotate(3deg)", opacity: "1" },
          "100%": { transform: "scale(1) rotate(3deg)", opacity: "1" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
      },
      animation: {
        stamp: "stamp 0.35s ease-out",
        "pulse-dot": "pulseDot 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
