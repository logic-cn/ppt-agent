/**
 * 临时探针：只跑 pagePlan，打印每页 plan 字段体积，定位提示词溢出的根因。
 * 用法：npx vitest run --config vitest.local.config.ts scripts/local-e2e/plan-probe.test.ts
 */
import { describe, it, expect, vi } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

import { generatePagePlan } from "@/services/outline";
import { DEFAULT_DESIGN } from "@/types/design";
import { useSettingsStore } from "@/store/settings";
import { PROVIDER_PRESETS } from "@/types/llm";

const ROOT = resolve(process.cwd());
const BIN = join(ROOT, "src-tauri/target/release/llm_headless");
const MODEL_PATH =
  process.env.PPT_LOCAL_MODEL ??
  join(
    homedir(),
    "Library/Application Support/com.pptagent.app/models/MiniCPM5-2B-Q4_K_M.gguf",
  );

describe("pagePlan 体积探针", () => {
  it("打印 plan 字段体积", async () => {
    const child: ChildProcessWithoutNullStreams = spawn(BIN, [
      MODEL_PATH,
      "16384",
    ]);
    let buffer = "";
    let pending: ((v: Record<string, unknown>) => void) | null = null;
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      let idx = buffer.indexOf("\n");
      while (idx >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line) {
          const msg = JSON.parse(line) as Record<string, unknown>;
          const r = pending;
          pending = null;
          r?.(msg);
        }
        idx = buffer.indexOf("\n");
      }
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (c: string) => process.stderr.write(`[llm] ${c}`));

    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    invokeMock.mockImplementation(async (_cmd: string, args: unknown) => {
      const req = (args as { req: Record<string, unknown> }).req;
      const res = await new Promise<Record<string, unknown>>((res) => {
        pending = res;
        child.stdin.write(JSON.stringify(req) + "\n");
      });
      if (res.ok === false) throw new Error(String(res.error));
      return res;
    });

    useSettingsStore.setState((s) => ({
      settings: {
        ...s.settings,
        activeProvider: "local",
        providers: {
          ...s.settings.providers,
          local: { ...PROVIDER_PRESETS.local, apiKey: "", enabled: true },
        },
      },
    }));

    const plan = await generatePagePlan({
      topic: process.env.PPT_LOCAL_TOPIC ?? "企业级 AI 落地的五个关键抓手",
      design: DEFAULT_DESIGN,
      pageCount: Number(process.env.PPT_LOCAL_PAGES ?? 7),
    });

    for (const [i, p] of plan.entries()) {
      const bullets = p.bullets ?? [];
      console.log(
        `${i + 1}. role=${p.role} chart=${p.chartType ?? "-"} title=${p.title.length} intent=${p.intent.length} bullets=${bullets.length}(${bullets.map((b: string) => b.length).join("/")}) quote=${(p.quote ?? "").length} attribution=${(p.attribution ?? "").length} notes=${(p.notes ?? "").length}`,
      );
    }
    child.stdin.end();
    child.kill();
    expect(plan.length).toBeGreaterThan(0);
  }, 30 * 60 * 1000);
});
