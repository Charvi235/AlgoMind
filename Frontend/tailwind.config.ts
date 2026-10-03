import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Constellation / Night-sky explorer ──────────────────────────
        background: "#060709", // deep-space page background (darkest point of gradient)
        panel:      "#0D1130", // cards & panels
        panelBorder:"#2A3166", // card borders
        star:       "#8A93B8", // background stars — desaturated blue-gray
        node:       "#7FA8FF", // default graph nodes & links
        gold:       "#FFD36E", // target nodes, streaks, CTA highlight
        teal:       "#6EE7C4", // correct answers, accuracy stats
        textPrimary:"#E8ECFB", // headings & main text
        textMuted:  "#9199B5", // secondary text & labels — desaturated gray-blue
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "Fira Code", "monospace"],
      },
      backgroundImage: {
        "space-gradient":
          "radial-gradient(ellipse at 30% 20%, #10131F 0%, #060709 60%, #030304 100%)",
      },
      boxShadow: {
        "glow-node": "0 0 0 2px #7FA8FF40, 0 0 16px 4px #7FA8FF55",
        "glow-gold": "0 0 0 2px #FFD36E40, 0 0 16px 4px #FFD36E55",
        "glow-teal": "0 0 0 2px #6EE7C440, 0 0 16px 4px #6EE7C455",
        panel: "0 4px 32px 0 rgba(6,8,24,0.75)",
      },
      keyframes: {
        twinkle: {
          "0%, 100%": { opacity: "0.2" },
          "50%":       { opacity: "0.9" },
        },
        streak: {
          "0%":   { transform: "translateX(-100%)", opacity: "0" },
          "50%":  { opacity: "1" },
          "100%": { transform: "translateX(200%)", opacity: "0" },
        },
      },
      animation: {
        twinkle: "twinkle 4s ease-in-out infinite",
        streak:  "streak 1.8s ease-in-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
