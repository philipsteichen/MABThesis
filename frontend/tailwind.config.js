/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        kstate: {
          purple: "#512888",
          light: "#7a4db5",
          dark: "#3b1d66",
        },
        wheat: {
          50: "#FFF1C9",
          100: "#E4D89E",
          200: "#F4C55C",
          300: "#CEA152",
          400: "#AC9766",
          500: "#9F694F",
        },
        neutral: {
          warm: "#E7DED0",
          mid: "#B9AB97",
          cool: "#939193",
        },
      },
    },
  },
  plugins: [],
};
