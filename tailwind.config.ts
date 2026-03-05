import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        shell: "#f2eee6",
        ink: "#1e2a39",
        coral: "#e66043",
        tide: "#2f7a8e",
        linen: "#fff9ef",
      },
      boxShadow: {
        card: "0 14px 40px rgba(30, 42, 57, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;

