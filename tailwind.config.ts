import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#FAF9F6",
          surface: "#F5F4F0",
          elevated: "#FFFFFF",
          hover: "#EEEDE8",
        },
        border: {
          DEFAULT: "#E8E7E2",
          strong: "#D4D3CE",
        },
        text: {
          primary: "#1A1A1E",
          secondary: "#6B6B76",
          muted: "#9A9AA8",
        },
        accent: {
          DEFAULT: "#4F6FFF",
          hover: "#3B5FFF",
          soft: "#EEF0FF",
        },
        ai: {
          DEFAULT: "#FF6B6B",
          hover: "#FF5252",
          soft: "#FFF5F5",
        },
        success: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
      },
      fontFamily: {
        sans: [
          "'PingFang SC'",
          "'Source Han Sans CN'",
          "'Microsoft YaHei'",
          "system-ui",
          "sans-serif",
        ],
        mono: ["'JetBrains Mono'", "'SF Mono'", "Menlo", "monospace"],
      },
      fontSize: {
        xs: ["11px", "16px"],
        sm: ["12px", "18px"],
        base: ["13px", "20px"],
        lg: ["15px", "22px"],
        xl: ["18px", "26px"],
        "2xl": ["22px", "30px"],
      },
    },
  },
  plugins: [],
};

export default config;
