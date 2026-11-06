import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          base: "rgb(var(--bg-base) / <alpha-value>)",
          surface: "rgb(var(--bg-surface) / <alpha-value>)",
          elevated: "rgb(var(--bg-elevated) / <alpha-value>)",
          hover: "rgb(var(--bg-hover) / <alpha-value>)",
        },
        border: {
          DEFAULT: "rgb(var(--border) / <alpha-value>)",
          strong: "rgb(var(--border-strong) / <alpha-value>)",
        },
        text: {
          primary: "rgb(var(--text-primary) / <alpha-value>)",
          secondary: "rgb(var(--text-secondary) / <alpha-value>)",
          muted: "rgb(var(--text-muted) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          hover: "rgb(var(--accent-hover) / <alpha-value>)",
          soft: "rgb(var(--accent-soft) / <alpha-value>)",
        },
        ai: {
          DEFAULT: "rgb(var(--ai) / <alpha-value>)",
          hover: "rgb(var(--ai-hover) / <alpha-value>)",
          soft: "rgb(var(--ai-soft) / <alpha-value>)",
        },
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        /* 彩色底上的文字色：浅色=白、深色=深灰，保证两种主题对比度 */
        on: {
          accent: "rgb(var(--on-accent) / <alpha-value>)",
          ai: "rgb(var(--on-ai) / <alpha-value>)",
          success: "rgb(var(--on-success) / <alpha-value>)",
          warning: "rgb(var(--on-warning) / <alpha-value>)",
          danger: "rgb(var(--on-danger) / <alpha-value>)",
        },
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
