import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: {
          900: "var(--green-900)",
          700: "var(--green-700)",
          500: "var(--green-500)",
          200: "var(--green-200)",
          50: "var(--green-50)",
        },
        gold: "var(--gold)",
      },
      fontFamily: {
        display: ['"Lora"', "serif"],
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
      },
      maxWidth: {
        mobile: "480px",
      },
    },
  },
  plugins: [],
} satisfies Config;
