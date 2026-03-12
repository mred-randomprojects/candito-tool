/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#12121e",
          light: "#1a1a2e",
          lighter: "#22223a",
        },
        border: "#2a2a40",
        accent: {
          DEFAULT: "#f59e0b",
          dim: "#b45309",
        },
      },
    },
  },
  plugins: [],
};
