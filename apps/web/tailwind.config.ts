import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        observatory: {
          ink: "#05070d",
          panel: "#0b101c",
          panelSoft: "#101827",
          line: "#1d2a3d",
          text: "#e6edf7",
          muted: "#8ea0b8",
          cyan: "#60e6ff",
          amber: "#f8c36a",
          green: "#6fffb0",
        },
      },
      boxShadow: {
        panel: "0 24px 80px rgba(0, 0, 0, 0.35)",
      },
      fontFamily: {
        sans: ["Sora", "Aptos", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
