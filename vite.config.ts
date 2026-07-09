import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri 期望的前端约定：
// - dev: localhost:1420
// - build: 输出到 dist
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          pptx: ["pptxgenjs"],
        },
      },
    },
  },
  // Vite 对 rust 文件做防抖监听
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
