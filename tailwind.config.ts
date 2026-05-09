import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0b0d12",
        panel: "#111721",
        line: "#273244",
        aqua: "#28d7c4",
        lime: "#a6e86f",
        amber: "#f2c35f",
        danger: "#ff6b7a"
      },
      boxShadow: {
        glow: "0 18px 70px rgba(40, 215, 196, 0.16)"
      }
    }
  },
  plugins: []
};

export default config;
