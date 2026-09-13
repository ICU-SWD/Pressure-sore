import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7ff",
          100: "#d9edff",
          500: "#2f6fed",
          600: "#2258c4",
          700: "#1c469a",
        },
        risk: {
          low: "#16a34a",
          moderate: "#ca8a04",
          high: "#ea580c",
          severe: "#dc2626",
        },
      },
    },
  },
  plugins: [],
};

export default config;
