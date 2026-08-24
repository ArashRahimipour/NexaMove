import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Orange — primary accent across the whole app.
        brand: {
          50: "#FFF7ED",
          100: "#FFEDD5",
          400: "#FB923C",
          500: "#F97316",
          600: "#EA580C",
          700: "#C2410C",
          900: "#7C2D12",
        },
        // Dark navy — sidebar only. Everything else is a light surface.
        navy: "#0F1628",
        navy2: "#1A2744",
        navy3: "#1E3A6B",
        // Light surfaces.
        card: "#FFFFFF",
        elevated: "#F1F5F9",
        line: "#E2E8F0",
        // Text.
        ink: "#0F172A",
        secondary: "#1E293B",
        dim: "#64748B",
        muted: "#94A3B8",
        // Status accents.
        warn: "#F97316",
        ok: "#16A34A",
        danger: "#DC2626",
      },
      boxShadow: {
        card: "0 1px 12px rgba(15,22,40,0.07)",
        elevated: "0 4px 24px rgba(15,22,40,0.12)",
        glow: "0 0 0 3px rgba(249,115,22,0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
