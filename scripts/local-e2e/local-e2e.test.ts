/**
 * 端侧模型无头端到端实跑（手动工具，不进 CI）。
 *
 * 目的：验证第三轮 ppt-master 质量对齐在**真实端侧推理**下是否成立——
 * 连续正文页的整宽↔双栏骨架轮换、每页演讲者备注、导出锁对越界/低对比页的
 * 拦截，以及导出产物是否真的可编辑。
 *
 * 之所以需要它：这些能力此前只在 mock provider 下被测过，端侧小模型
 * （MiniCPM5）的真实输出形态与 mock 不同——轮换是否真的发生、备注是否
 * 真的落库、错误页是否真的被锁住，都必须实跑才能下结论。
 *
 * 运行：
 *   npx vitest run --config vitest.local.config.ts
 *   PPT_LOCAL_PAGES=6 PPT_LOCAL_TOPIC="..." npx vitest run --config vitest.local.config.ts
 *
 * 前置：模型已下载到应用数据目录（或用 PPT_LOCAL_MODEL 指定 .gguf 路径）。
 * 产物落在 dist/local-e2e/<时间戳>/：deck.json、每页 svg、导出的 pptx、
 * 以及实跑报告 report.json。
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import {
  spawn,
  spawnSync,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import JSZip from "jszip";
import { join, resolve } from "node:path";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

import { buildDeckSvgsDetailed } from "@/engine/svg/pipeline";
import { DEFAULT_DESIGN } from "@/types/design";
import { useSettingsStore } from "@/store/settings";
import { PROVIDER_PRESETS } from "@/types/llm";
import { checkDeckQuality, hasHardError } from "@/services/quality";
import { exportDeckToBlob } from "@/engine/pptx/exporter";
import type { Deck } from "@/types/deck";
import type { PagePlanItem } from "@/types/page-plan";

const ROOT = resolve(process.cwd());
const TAURI_DIR = join(ROOT, "src-tauri");
const BIN = join(TAURI_DIR, "target/release/llm_headless");
const MODEL_PATH =
  process.env.PPT_LOCAL_MODEL ??
  join(
    homedir(),
    "Library/Application Support/com.pptagent.app/models/MiniCPM5-2B-Q4_K_M.gguf",
  );
const PAGE_COUNT = Number(process.env.PPT_LOCAL_PAGES ?? 6);
const TOPIC =
  process.env.PPT_LOCAL_TOPIC ?? "2026 年企业级 AI 落地进展与下一步规划";
const CTX_SIZE = Number(process.env.PPT_LOCAL_CTX ?? 8192);

/** 无头推理子进程：行 JSON 请求 → 行 JSON 响应 */
class LlmChild {
  private child: ChildProcessWithoutNullStreams;
  private buffer = "";
  private pending: ((msg: Record<string, unknown>) => void) | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  constructor() {
    this.child = spawn(BIN, [MODEL_PATH, String(CTX_SIZE)], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => this.onData(chunk));
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk: string) => {
      process.stderr.write(`[llm_headless] ${chunk}`);
    });
  }

  private onData(chunk: string) {
    this.buffer += chunk;
    let idx = this.buffer.indexOf("\n");
    while (idx >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (line) {
        const msg = JSON.parse(line) as Record<string, unknown>;
        const resolvePending = this.pending;
        this.pending = null;
        resolvePending?.(msg);
      }
      idx = this.buffer.indexOf("\n");
    }
  }

  chat(req: Record<string, unknown>): Promise<Record<string, unknown>> {
    const next = this.queue.then(
      () =>
        new Promise<Record<string, unknown>>((res) => {
          this.pending = res;
          this.child.stdin.write(JSON.stringify(req) + "\n");
        }),
    );
    // 串行化：推理本身是串行的，队列只用于保持请求/响应一一对应
    this.queue = next.catch(() => undefined);
    return next;
  }

  close() {
    this.child.stdin.end();
    this.child.kill();
  }
}

/** blob → bytes：jsdom 的 Blob 不一定有 arrayBuffer，退回 FileReader */
async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === "function") {
    return new Uint8Array(await blob.arrayBuffer());
  }
  const buf = await new Promise<ArrayBuffer>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as ArrayBuffer);
    fr.onerror = () => rej(fr.error);
    fr.readAsArrayBuffer(blob);
  });
  return new Uint8Array(buf);
}

/** 页面正文列数：正文页骨架整宽时所有要点同一起始 x，双栏时出现第二个列起点 */
function columnCount(svg: string): number {
  const xs = new Set<number>();
  for (const m of svg.matchAll(/<text\b[^>]*\bx="([\d.]+)"/gi)) {
    const x = Number.parseFloat(m[1]);
    if (Number.isFinite(x)) xs.add(Math.round(x / 8) * 8);
  }
  const left = [...xs].filter((x) => x < 200);
  const right = [...xs].filter((x) => x >= 500 && x < 900);
  return left.length > 0 && right.length > 0 ? 2 : 1;
}

describe("端侧模型无头实跑", () => {
  let child: LlmChild;
  let outDir: string;

  /** 进度落盘：端侧推理是分钟级，跑超时也能留下过程证据 */
  const log = (line: string) => {
    if (!outDir) return;
    appendFileSync(
      join(outDir, "progress.log"),
      `${new Date().toISOString()} ${line}\n`,
      "utf8",
    );
  };

  beforeAll(
    async () => {
      if (!existsSync(MODEL_PATH)) {
        throw new Error(
          `模型文件不存在: ${MODEL_PATH}（先在设置页下载端侧模型）`,
        );
      }
      const build = spawnSync(
        "cargo",
        ["build", "--release", "--bin", "llm_headless"],
        { cwd: TAURI_DIR, stdio: "inherit" },
      );
      if (build.status !== 0) {
        throw new Error(`cargo build --bin llm_headless 失败: ${build.status}`);
      }

      // 本地 provider 的运行时判定与 Tauri IPC 桩
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
      invokeMock.mockImplementation(async (cmd: string, args: unknown) => {
        if (cmd === "local_llm_chat") {
          const req = (args as { req: Record<string, unknown> }).req;
          const userChars = JSON.stringify(req.messages).length;
          const res = await child.chat(req);
          if (res.ok === false) throw new Error(String(res.error));
          // 提示词体积双侧对照：TS 侧字符数 vs Rust 侧 token 数
          log(
            `请求：tsChars=${userChars} rustPromptTokens=${res.prompt_tokens} gen=${res.tokens_generated} ms=${res.elapsed_ms}`,
          );
          return res;
        }
        throw new Error(`无头 harness 不支持的命令: ${cmd}`);
      });

      // 设置：激活内置本地模型
      useSettingsStore.setState((s) => ({
        settings: {
          ...s.settings,
          activeProvider: "local",
          providers: {
            ...s.settings.providers,
            local: {
              ...PROVIDER_PRESETS.local,
              apiKey: "",
              enabled: true,
            },
          },
        },
      }));

      child = new LlmChild();
      outDir = join(
        ROOT,
        "dist/local-e2e",
        new Date().toISOString().replace(/[:.]/g, "-"),
      );
      mkdirSync(outDir, { recursive: true });
    },
    60 * 60 * 1000,
  );

  afterAll(() => {
    child?.close();
  });

  it(
    "真实生成多页 deck：轮换 / 备注 / 导出锁 / 可编辑导出",
    async () => {
      const baseDeck: Deck = {
        id: "local-e2e",
        title: TOPIC,
        design: DEFAULT_DESIGN,
        slides: [],
        version: 2,
        createdAt: 0,
        updatedAt: 0,
      };

      const t0 = Date.now();
      let plan: PagePlanItem[] = [];
      const pageErrors: { page: number; error: string }[] = [];
      const runErrors: string[] = [];
      // 走 App 实际路径（isolatePageFailures 默认 false：含 cohort 早期门与
      // 跨页版式轮换）；若整份生成中断，降级为逐页隔离再取一次产物用于诊断。
      let deck: Deck;
      let pathUsed = "app-default(isolate=false)";
      try {
        deck = (
          await buildDeckSvgsDetailed(baseDeck, DEFAULT_DESIGN, {
            topic: TOPIC,
            pageCount: PAGE_COUNT,
            onPlanReady: (pages) => {
              plan = pages;
              log(`plan 就绪：${pages.length} 页`);
            },
            onProgress: (done, total) => log(`进度 ${done}/${total}`),
            onPageError: (pageIndex, error) => {
              pageErrors.push({ page: pageIndex + 1, error: error.message });
              log(`第 ${pageIndex + 1} 页失败：${error.message}`);
            },
          })
        ).deck;
      } catch (e) {
        runErrors.push(String((e as Error).message ?? e));
        log(`app-default 失败：${runErrors[0]}`);
        pathUsed = "app-default 失败 → 降级 isolate=true 取诊断产物";
        const fallback = await buildDeckSvgsDetailed(baseDeck, DEFAULT_DESIGN, {
          topic: TOPIC,
          pageCount: PAGE_COUNT,
          isolatePageFailures: true,
          onPlanReady: (pages) => {
            // 诊断产物来自这次隔离重跑，plan 也以其为准（首次 plan 的页面
            // 未全部产出，role/chartType 列若混用两份 plan 会对不上号）
            plan = pages;
          },
          onPageError: (pageIndex, error) => {
            pageErrors.push({ page: pageIndex + 1, error: error.message });
          },
        });
        deck = fallback.deck;
      }
      const elapsed = Date.now() - t0;

      // ---- 产物落盘 ----
      writeFileSync(
        join(outDir, "deck.json"),
        JSON.stringify(deck, null, 2),
        "utf8",
      );
      writeFileSync(
        join(outDir, "plan.json"),
        JSON.stringify(plan, null, 2),
        "utf8",
      );
      deck.slides.forEach((slide, i) => {
        if (slide.svg) {
          writeFileSync(
            join(outDir, `page-${String(i + 1).padStart(2, "0")}.svg`),
            slide.svg,
            "utf8",
          );
        }
      });

      // ---- 逐页体检 ----
      const pages = deck.slides.map((slide, i) => ({
        index: i + 1,
        role: plan[i]?.role ?? "-",
        chartType: plan[i]?.chartType ?? null,
        layout: slide.layout,
        title: slide.title,
        planBullets: plan[i]?.bullets?.length ?? 0,
        planFieldChars: plan[i]
          ? {
              title: plan[i].title.length,
              intent: plan[i].intent.length,
              bullets: (plan[i].bullets ?? []).reduce(
                (s, b) => s + b.length,
                0,
              ),
              quote: (plan[i].quote ?? "").length,
              attribution: (plan[i].attribution ?? "").length,
            }
          : null,
        hasSvg: !!slide.svg,
        svgLength: slide.svg?.length ?? 0,
        notesLength: (slide.notes ?? "").length,
        columns: slide.svg ? columnCount(slide.svg) : 0,
      }));

      // 跨页版式轮换的触发前提：相邻两页都是「参与轮换的正文页」
      // （与 executor 的 ROTATABLE_ROLES 对齐：content / section，图表页不再排除）
      const rotatable = (i: number) =>
        ["content", "section"].includes(plan[i]?.role ?? "");
      // 复刻 executor 的变体分配（顺序生成，逐页可重算）
      const variantOf = (i: number): number => {
        if (!rotatable(i)) return -1;
        const prevSame = i > 0 && rotatable(i - 1);
        return prevSame ? 1 - variantOf(i - 1) : 0;
      };
      const rotationPairs: number[] = [];
      for (let i = 1; i < plan.length; i++) {
        if (rotatable(i) && rotatable(i - 1)) rotationPairs.push(i);
      }

      // ---- 导出锁：质量检查（hard 级阻断导出） ----
      const findings = checkDeckQuality(deck);
      const hard = findings.filter((f) => f.severity === "hard");
      const soft = findings.filter((f) => f.severity === "soft");

      // ---- 导出 pptx（产物是否可编辑由 translator 保证，这里验证不报错且非空） ----
      const blob = await exportDeckToBlob(deck);
      const bytes = await blobToBytes(blob);
      writeFileSync(join(outDir, "deck.pptx"), bytes);

      // 演讲备注是否真的落进 PPTX（notesSlide 部件）
      const zip = await JSZip.loadAsync(bytes);
      const notesSlides = Object.keys(zip.files).filter((n) =>
        n.startsWith("ppt/notesSlides/notesSlide"),
      );
      const notesText: string[] = [];
      for (const name of notesSlides) {
        const xml = await zip.file(name)?.async("string");
        if (!xml) continue;
        notesText.push(
          [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
            .map((m) => m[1])
            .join("")
            .trim(),
        );
      }
      const notesWithContent = notesText.filter((t) => t.length > 0);

      const report = {
        topic: TOPIC,
        pathUsed,
        pageCount: deck.slides.length,
        elapsedMs: elapsed,
        modelPath: MODEL_PATH,
        pages,
        runErrors,
        pageErrors,
        rotationPairs,
        notesSlideCount: notesSlides.length,
        notesSlideWithContent: notesWithContent.length,
        notesSlides: notesText,
        findings: findings.map((f) => ({
          rule: f.rule,
          severity: f.severity,
          message: f.message,
        })),
        hardCount: hard.length,
        softCount: soft.length,
        exportLocked: hasHardError(findings),
        pptxBytes: bytes.length,
        outDir,
      };
      writeFileSync(
        join(outDir, "report.json"),
        JSON.stringify(report, null, 2),
        "utf8",
      );

      console.log(
        `\n===== 端侧实跑报告 =====\n${JSON.stringify(report, null, 2)}\n`,
      );

      // ---- 验收 ----
      expect(deck.slides.length).toBeGreaterThan(0);

      // 生成成功率：端侧小模型并非每页都能一次过（重画 2 轮仍不达标即隔离该页），
      // 这里只要求多数页面成功——失败页本身就是要报告的结论。
      const okPages = pages.filter((p) => p.hasSvg);
      expect(
        okPages.length,
        `所有页面都生成失败：${JSON.stringify(pageErrors)}`,
      ).toBeGreaterThanOrEqual(Math.ceil(pages.length * 0.6));

      // 演讲者备注：应有讲稿（长度另在报告里给，端侧模型常写不满 80 字）
      const withNotes = pages.filter((p) => p.notesLength > 0);
      expect(withNotes.length, "没有任何页面产出演讲者备注").toBeGreaterThan(0);

      // 跨页版式轮换：相邻轮换页对的版式必须不同（变体由 executor 按同一规则分配，
      // 这里验证模型真的服从了骨架：普通页 v1 出双栏、图表页 v1 图表换边）
      const chartSide = (svg: string): "left" | "right" | null => {
        const g = svg.match(/<g\b[^>]*data-chart-type[^>]*>/i)?.[0];
        if (!g) return null;
        const mid = Number(svg.match(/viewBox="0 0 (\d+(?:\.\d+)?)/)?.[1] ?? 1280) / 2;
        const x =
          g.match(/\bx="([\d.]+)"/)?.[1] ??
          g.match(/transform="translate\(([\d.]+)/)?.[1];
        if (x === undefined) return null;
        return Number(x) >= mid ? "right" : "left";
      };
      for (const i of rotationPairs) {
        const prev = pages[i - 2];
        const cur = pages[i - 1];
        if (!prev?.hasSvg || !cur?.hasSvg) continue;
        const prevPlan = plan[i - 1]!;
        const curPlan = plan[i]!;
        if (prevPlan.chartType && curPlan.chartType) {
          // 图表页对：图表必须一左一右（解析不到坐标时跳过，报告里可见）
          const a = chartSide(deck.slides[i - 1]?.svg ?? "");
          const b = chartSide(deck.slides[i]?.svg ?? "");
          if (a && b) {
            expect(
              a,
              `第 ${prev.index}/${cur.index} 页图表都在${a === "left" ? "左" : "右"}侧，跨页版式轮换未生效`,
            ).not.toBe(b);
          }
          continue;
        }
        if (prevPlan.chartType || curPlan.chartType) continue; // 图表页与普通页版式天然不同
        // 普通正文页对：仅当变体确实不同且 v1 页要点 ≥4（双栏骨架生效）时断言列数
        const v0 = variantOf(i - 1);
        const v1 = variantOf(i);
        const v1Plan = v1 === 1 ? curPlan : v0 === 1 ? prevPlan : null;
        if (v1Plan && (v1Plan.bullets?.length ?? 0) >= 4) {
          expect(
            prev.columns,
            `第 ${prev.index}/${cur.index} 页列数相同，跨页版式轮换未生效`,
          ).not.toBe(cur.columns);
        }
      }

      // 导出锁：hard 级检查项存在时必须锁住导出
      expect(hasHardError(findings)).toBe(hard.length > 0);

      // 演讲备注要真的落进 PPTX 备注页
      expect(
        notesSlides.length,
        "导出产物里没有 notesSlide 部件，演讲备注未落 PPTX",
      ).toBeGreaterThan(0);

      // 导出产物非空
      expect(bytes.length).toBeGreaterThan(10_000);
    },
    60 * 60 * 1000,
  );
});
