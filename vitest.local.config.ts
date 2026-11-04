import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * 手动工具配置：端侧模型无头实跑（scripts/local-e2e）。
 *
 * 与主配置分开的原因：这条链路会真实加载 1.4GB 模型并逐页推理（分钟级），
 * 不适合进 CI；主 vitest.config.ts 已把 scripts/** 排除在外。
 *
 * 用法：npx vitest run --config vitest.local.config.ts
 *
 * 时限默认 1 小时（墙钟）。宿主可能中途挂起（虚拟机/睡眠）时墙钟虚耗、
 * 单调钟不动——progress.log 的大段"空洞"配 llm_headless 连续的单调钟耗时
 * 即挂起痕迹。此时用 PPT_LOCAL_TIMEOUT_MS 放宽（毫秒），如 3 小时：
 *   PPT_LOCAL_TIMEOUT_MS=10800000 npx vitest run --config vitest.local.config.ts
 */
const LOCAL_TIMEOUT_MS = Number(
  process.env.PPT_LOCAL_TIMEOUT_MS ?? 60 * 60 * 1000,
);

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
    testTimeout: LOCAL_TIMEOUT_MS,
    hookTimeout: LOCAL_TIMEOUT_MS,
    teardownTimeout: 60_000,
  },
});
