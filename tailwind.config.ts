import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 应用级语义色
        bg: {
          base: "#0f1115",
          surface: "#171a21",
          elevated: "#1e222b",
          hover: "#252a35",
        },
        border: {
          DEFAULT: "#2a2f3a",
          strong: "#3a4150",
        },
        text: {
          primary: "#e6e8ec",
          secondary: "#9ba3b0",
          muted: "#6b7280",
        },
        accent: {
          DEFAULT: "#4f8cff",
          hover: "#3b7bff",
          soft: "#1e2f4d",
        },
        success: "#22c55e",
        warning: "#f59e0b",
        danger: "#ef4444",
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
        // 暗色界面排版刻度
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
