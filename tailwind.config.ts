import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        boreal: {
          ink: "#020617",
          navy: "#061123",
          panel: "#0b1224",
          cyan: "#18e4ff",
          blue: "#3677ff",
          violet: "#8b5cf6",
          line: "rgba(103, 232, 249, 0.22)",
        },
      },
      boxShadow: {
        neon: "0 0 0 1px rgba(24,228,255,.18), 0 20px 80px rgba(54,119,255,.13)",
        glow: "0 0 35px rgba(24,228,255,.18)",
      },
    },
  },
  plugins: [],
} satisfies Config;
