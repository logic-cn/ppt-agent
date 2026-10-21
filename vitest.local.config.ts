import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * 手动工具配置：端侧模型无头实跑（scripts/local-e2e）。
 *
 * 与主配置分开的原因：这条链路会真实加载 1.4GB 模型并逐页推理（分钟级），
 * 不适合进 CI；主 vitest.config.ts 已把 scripts/** 排除在外。
 *
 * 用法：npx vitest run --config vitest.local.config.ts
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["scripts/local-e2e/**/*.test.ts"],
    testTimeout: 60 * 60 * 1000,
    hookTimeout: 60 * 60 * 1000,
    teardownTimeout: 60_000,
  },
});
