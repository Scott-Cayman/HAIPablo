import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F6F7FB",
        foreground: "#111827",
        muted: "#F6F7FB",
        "muted-foreground": "#6B7280",
        accent: "#4F46E5",
        "accent-foreground": "#ffffff",
        card: "#ffffff",
        "card-foreground": "#111827",
        border: "#E5E7EB",
        input: "#E5E7EB",
        primary: "#4F46E5",
        "primary-foreground": "#ffffff",
        secondary: "#F6F7FB",
        "secondary-foreground": "#111827",
        destructive: "#DC2626",
        "destructive-foreground": "#ffffff",
        success: "#16A34A",
        warning: "#F59E0B",
      },
      borderRadius: {
        lg: "12px",
        md: "8px",
        sm: "4px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        card: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
        "card-hover": "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
      },
    },
  },
  plugins: [],
};
export default config;
