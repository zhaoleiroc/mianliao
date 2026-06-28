/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "PingFang SC",
          "Microsoft YaHei",
          "Noto Sans SC",
          "system-ui",
          "sans-serif",
        ],
        serif: ["Cormorant Garamond", "Source Han Serif SC", "serif"],
      },
      colors: {
        ink: "#1c1917",
        canvas: "#faf8f5",
        accent: "#a85d27",
        accentHover: "#7a3f12",
      },
      boxShadow: {
        card: "0 1px 2px rgba(28,25,23,.04), 0 8px 24px -8px rgba(28,25,23,.12)",
      },
    },
  },
  plugins: [],
};
