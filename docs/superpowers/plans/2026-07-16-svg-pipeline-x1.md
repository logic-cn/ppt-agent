# X1 架构重构：SVG 中间层 + 原生 PPTX 翻译 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 ppt-agent 的渲染架构从「几何坐标程序化绘制」重构为「SVG 页面设计真相 + 原生 PPTX 翻译」，使生成的 PPT 美观、预览导出一致、导出完全可编辑。

**Architecture:** 四层管线——L1 Strategist 产出 `specLock` 设计契约 + `pagePlan` 语义角色规划；L2 Executor 逐页串行调用 LLM 产出固定像素 viewBox 的 SVG；L3 Quality Gate 用 TS 校验器强制 0-error 并失败重画；L4 翻译器将 SVG 逐元素翻译为 pptxgenjs 原生可编辑 PPTX。预览直接原生渲染 SVG。

**Tech Stack:** TypeScript + React + Vite + Tailwind；`pptxgenjs`（现有，复用）；LLM 通过 `src/services/llm` 的 `chat()`；SVG 预览用浏览器原生 `<img>`/内联 SVG；测试用 vitest。

## Global Constraints

- 语言：始终用中文回答；Git commit message 使用中文（来自 CLAUDE.md）。
- 前端代码必须通过 prettier 格式检查（前端项目根目录执行 `npx prettier --check`）。
- 数据库设计禁令不适用（本项目无 DB）；主键/外键约束不适用。
- 编写 Java 代码禁令不适用（纯 TS）；能用 stream 处用 stream（本计划以 TS 为主，无此约束）。
- 代码修改后主动触发 code-reviewer agent 审查（工作流要求）。
- 禁止提交 `.env` 等机密文件；提交前验证 `.gitignore`（来自 CLAUDE.md 安全红线）。
- 不引入新的重型三方依赖；SVG→PPTX 翻译器**自研**（已核实无可用 JS 类库），基于现有 `pptxgenjs`。
- SVG 画布使用**固定像素 viewBox**（如 1280×720），不使用百分比坐标（对齐 ppt-master）。
- 新增/修改文件须通过 `npx tsc --noEmit -p tsconfig.json` 与 `npx vitest run`。
- 每个 Task 结束须独立可测并提交。

---

## 文件结构总览

```
src/design/
  spec-lock.ts            (新建) specLock 类型 + 由 visualStyles/palettes 构建
  visual-styles.ts        (改)  保留，作为 specLock 的视觉源
  palettes.ts             (改)  保留，作为 specLock 的配色源
  narrative-modes.ts      (保留) 内容策略
src/engine/
  svg/
    types.ts              (新建) SvgPage / SvgCanvas 等类型
    spec-contract.ts      (新建) SVG 兼容契约（shared-standards 简化版）
    executor.ts           (新建) L2 逐页生成 SVG（调 LLM）
    quality/
      checker.ts          (新建) L3 校验器
      checker.test.ts
  pptx-translator/        (新建目录)
    index.ts              (翻译入口 svgToPptx)
    text.ts               矩形/圆/路径/文本/渐变翻译
    chart.ts              图表翻译
    index.test.ts
src/services/
  outline.ts              (改)  产出 pagePlan 语义角色（替代几何 layout）
  llm/prompts/
    pageplan.ts           (新建) 页面结构规划 prompt
    svg-gen.ts            (新建) SVG 生成 prompt（注入 specLock + 契约）
src/preview/
  SvgViewer.tsx           (新建) 原生渲染 SVG 的预览组件
src/components/
  (改) Editor / presentation-mode 接入 SvgViewer 与 svg pages
src/types/
  deck.ts                 (改) Slide 增加 svg?: string 字段；保留旧字段做兼容
  design.ts               (保留)
```

---

## Phase 0 — 设计契约 specLock

### Task 0.1: 定义 specLock 类型与构建器

**Files:**
- Create: `src/design/spec-lock.ts`
- Test: `src/design/spec-lock.test.ts`

**Interfaces:**
- Produces: `interface SpecLock { canvas: {w:number;h:number}; colors: Record<string,string>; fonts: {title:string;body:string}; style: string; icons: string[] }`
- Produces: `function buildSpecLock(design: DesignLock): SpecLock`
- Consumes: `getVisualStyle`（visual-styles.ts）、`getPalette`（palettes.ts）

- [ ] **Step 1: 写失败测试**

```ts
// src/design/spec-lock.test.ts
import { describe, it, expect } from "vitest";
import { buildSpecLock } from "./spec-lock";
import { DEFAULT_DESIGN } from "@/types/design";

describe("buildSpecLock", () => {
  it("由默认 design 产出画布/配色/字体", () => {
    const lock = buildSpecLock(DEFAULT_DESIGN);
    expect(lock.canvas).toEqual({ w: 1280, h: 720 });
    expect(lock.colors.primary).toMatch(/^#/);
    expect(lock.fonts.title).toContain("Han");
  });
});
```

- [ ] **Step 2: 运行测试验证失败** `npx vitest run src/design/spec-lock.test.ts` → FAIL（模块不存在）

- [ ] **Step 3: 最小实现**

```ts
// src/design/spec-lock.ts
import type { DesignLock } from "@/types/design";
import { getVisualStyle } from "./visual-styles";
import { getPalette } from "./palettes";

export interface SpecLock {
  canvas: { w: number; h: number };
  colors: { primary: string; secondary: string; accent: string; background: string; surface: string; text: string; textMuted: string };
  fonts: { title: string; body: string };
  style: string;
  icons: string[];
}

export function buildSpecLock(design: DesignLock): SpecLock {
  const style = getVisualStyle(design.visualStyle)!;
  const palette = getPalette(design.palette)!;
  const c = palette.colors;
  return {
    canvas: { w: 1280, h: 720 },
    colors: {
      primary: c.primary,
      secondary: c.secondary,
      accent: c.accent,
      background: c.background,
      surface: c.surface,
      text: c.text,
      textMuted: c.textMuted,
    },
    fonts: { title: style.fonts.title, body: style.fonts.body },
    style: design.visualStyle,
    icons: [],
  };
}
```

- [ ] **Step 4: 运行测试通过** `npx vitest run src/design/spec-lock.test.ts` → PASS

- [ ] **Step 5: 提交**
```bash
git add src/design/spec-lock.ts src/design/spec-lock.test.ts
git commit -m "feat: 新增 specLock 设计契约类型与构建器"
```

### Task 0.2: 定义 SVG 兼容契约（shared-standards 简化版）

**Files:**
- Create: `src/engine/svg/spec-contract.ts`
- Test: `src/engine/svg/spec-contract.test.ts`

**Interfaces:**
- Produces: `export const SVG_CONTRACT` 常量（允许的 SVG 元素、属性、viewBox 要求、文本溢出预算）
- Produces: `export function validateSvgContract(svg: string): string[]`（返回错误列表）

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from "vitest";
import { validateSvgContract } from "./spec-contract";

describe("validateSvgContract", () => {
  it("拒绝无 viewBox 的 svg", () => {
    const errs = validateSvgContract(`<svg><rect/></svg>`);
    expect(errs.length).toBeGreaterThan(0);
  });
  it("接受合规 svg", () => {
    const ok = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect x="10" y="10" width="100" height="50" fill="#111"/></svg>`;
    expect(validateSvgContract(ok)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 运行失败**
- [ ] **Step 3: 实现**（解析 SVG 根，检查 viewBox 存在且为 1280×720；检查根元素为 svg；收集未知元素名到错误）

```ts
// src/engine/svg/spec-contract.ts
const ALLOWED = new Set(["svg","g","rect","circle","ellipse","path","text","tspan","line","polygon","polyline","image","linearGradient","radialGradient","stop"]);

export const SVG_CONTRACT = {
  width: 1280,
  height: 720,
  allowedElements: ALLOWED,
};

export function validateSvgContract(svg: string): string[] {
  const errors: string[] = [];
  const rootMatch = svg.match(/<svg[^>]*>/i);
  if (!rootMatch) { errors.push("缺少 <svg> 根元素"); return errors; }
  const vb = rootMatch[0].match(/viewBox=["']([^"']+)["']/i);
  if (!vb) { errors.push("svg 缺少 viewBox"); return errors; }
  const parts = vb[1].trim().split(/[\s,]+/).map(Number);
  if (parts[0] !== 0 || parts[1] !== 0 || parts[2] !== 1280 || parts[3] !== 720) {
    errors.push(`viewBox 必须为 "0 0 1280 720"，实际 "${vb[1]}"`);
  }
  const tags = svg.match(/<([a-zA-Z]+)[\s/>]/g) ?? [];
  for (const t of tags) {
    const name = t.replace(/[<>\s/]/g, "");
    if (name === "svg") continue;
    if (!ALLOWED.has(name)) errors.push(`不支持的 SVG 元素 <${name}>`);
  }
  return errors;
}
```

- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 提交** `git commit -m "feat: 新增 SVG 兼容契约与基础校验"`

---

## Phase 1 — 页面结构规划 pagePlan

### Task 1.1: 语义角色类型与 pagePlan prompt

**Files:**
- Create: `src/types/page-plan.ts`
- Create: `src/services/llm/prompts/pageplan.ts`
- Modify: `src/services/outline.ts`（保留旧 generateOutline 但新增 generatePagePlan）
- Test: `src/services/outline.test.ts`（扩充）

**Interfaces:**
- Produces: `type SemanticRole = "cover"|"section"|"content"|"metrics"|"quote"|"timeline"|"comparison"|"process"|"closing"|...`
- Produces: `interface PagePlanItem { role: SemanticRole; title: string; intent: string }`
- Produces: `async function generatePagePlan(params): Promise<PagePlanItem[]>`
- Consumes: `chat`（src/services/llm）、`buildSpecLock`

- [ ] **Step 1: 写失败测试**（pagePlan 返回语义角色数组，至少含 cover/closing）
- [ ] **Step 2: 运行失败**
- [ ] **Step 3: 实现 generatePagePlan**

```ts
// src/types/page-plan.ts
export type SemanticRole =
  | "cover" | "section" | "content" | "metrics" | "quote"
  | "timeline" | "comparison" | "process" | "closing";

export interface PagePlanItem {
  role: SemanticRole;
  title: string;
  intent: string;
}
```

```ts
// src/services/llm/prompts/pageplan.ts
export function buildPagePlanSystemPrompt(): string {
  return `你是 PPT 结构策划。输出 JSON {"pages":[{"role":SemanticRole,"title":string,"intent":string}]}。
角色从 cover/section/content/metrics/quote/timeline/comparison/process/closing 中选择。
第一页必须为 cover，最后一页必须为 closing。每页只承载一个核心信息角色。`;
}
```

```ts
// 在 src/services/outline.ts 新增
export async function generatePagePlan(params: {
  topic: string; design: DesignLock; audience?: string; pageCount?: number; docContent?: string; signal?: AbortSignal;
}): Promise<PagePlanItem[]> {
  // 调用 chat JSON mode，解析 pages 数组，zod 校验每项的 role∈SemanticRole
  // 复用现有 few-shot / 解析逻辑（参考原 generateOutline 的 JSON 解析与校验）
}
```

- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 提交** `git commit -m "feat: 新增 pagePlan 语义角色页面结构规划"`

---

## Phase 2 — SVG 生成 + 预览

### Task 2.1: L2 Executor 逐页生成 SVG

**Files:**
- Create: `src/engine/svg/types.ts`
- Create: `src/engine/svg/executor.ts`
- Create: `src/services/llm/prompts/svg-gen.ts`
- Test: `src/engine/svg/executor.test.ts`

**Interfaces:**
- Produces: `interface SvgPage { index: number; role: SemanticRole; svg: string }`
- Produces: `async function generateSlideSvg(opts:{ specLock: SpecLock; plan: PagePlanItem; pageIndex: number; totalPages: number; prevSvg?: string; signal?: AbortSignal }): Promise<string>`（返回单页 SVG 字符串）
- Consumes: `chat`、`buildSpecLock`、`validateSvgContract`（先做软校验，Phase 3 硬化）

- [ ] **Step 1: 写失败测试**（mock chat 返回合规 SVG，executor 返回该 SVG 字符串且含 viewBox 1280×720）
- [ ] **Step 2: 运行失败**
- [ ] **Step 3: 实现 generateSlideSvg**

```ts
// src/services/llm/prompts/svg-gen.ts
export function buildSvgGenPrompt(opts: { specLock: SpecLock; plan: PagePlanItem; pageIndex: number; totalPages: number }): string {
  const { specLock, plan, pageIndex, totalPages } = opts;
  return `你是 PPT 视觉设计师。基于以下设计契约，产出第 ${pageIndex + 1}/${totalPages} 页（角色 ${plan.role}，意图：${plan.intent}）的 SVG。
画布：viewBox="0 0 1280 720"，像素坐标。
配色（仅用）：primary ${specLock.colors.primary} / secondary ${specLock.colors.secondary} / accent ${specLock.colors.accent} / bg ${specLock.colors.background} / text ${specLock.colors.text} / muted ${specLock.colors.textMuted}。
字体：title ${specLock.fonts.title}，body ${specLock.fonts.body}。
要求：设计精良、留白充足、有层级；仅使用 rect/circle/ellipse/path/text/tspan/line/linearGradient 等标准元素；文本必须可被选中和编辑（用 <text> 而非转曲）；不要栅格化。只输出 <svg>...</svg>。`;
}
```

```ts
// src/engine/svg/executor.ts
import { chat } from "@/services/llm";
import { buildSvgGenPrompt } from "@/services/llm/prompts/svg-gen";
import type { SpecLock } from "@/design/spec-lock";
import type { PagePlanItem } from "@/types/page-plan";

export async function generateSlideSvg(opts: {
  specLock: SpecLock; plan: PagePlanItem; pageIndex: number; totalPages: number; signal?: AbortSignal;
}): Promise<string> {
  const prompt = buildSvgGenPrompt(opts);
  const res = await chat({ messages: [
    { role: "system", content: "你产出单页 SVG，只返回 <svg> 根元素。" },
    { role: "user", content: prompt },
  ], temperature: 0.7, signal: opts.signal }, "svg");
  const svg = res.content.match(/<svg[\s\S]*<\/svg>/i)?.[0] ?? res.content;
  return svg.trim();
}
```

- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 提交** `git commit -m "feat: 新增 L2 Executor 逐页生成 SVG"`

### Task 2.2: Slide 增加 svg 字段并串联 pagePlan→executor

**Files:**
- Modify: `src/types/deck.ts`（Slide 增加 `svg?: string`）
- Modify: `src/services/generation/first-page-gate.ts`（如适用，保留兼容）
- Create: `src/services/deck-build.ts`（新：pagePlan + 逐页 executor 编排，串行）
- Test: `src/services/deck-build.test.ts`

**Interfaces:**
- Produces: `async function buildDeckSvg(params): Promise<Slide[]>`（每个 Slide 带 svg 字段）
- Consumes: `generatePagePlan`、`generateSlideSvg`、`buildSpecLock`

- [ ] **Step 1: 写失败测试**（mock 两函数，buildDeckSvg 产出 N 页 Slide，每页 svg 非空且含 viewBox）
- [ ] **Step 2: 运行失败**
- [ ] **Step 3: 实现 buildDeckSvg（逐页串行 for 循环，禁止并行）**

```ts
// src/services/deck-build.ts
import type { Deck, Slide } from "@/types/deck";
import type { DesignLock } from "@/types/design";
import { buildSpecLock } from "@/design/spec-lock";
import { generatePagePlan } from "./outline";
import { generateSlideSvg } from "@/engine/svg/executor";

export async function buildDeckSvg(params: {
  topic: string; design: DesignLock; audience?: string; pageCount?: number; docContent?: string; signal?: AbortSignal;
}): Promise<Slide[]> {
  const specLock = buildSpecLock(params.design);
  const plan = await generatePagePlan(params);
  const slides: Slide[] = [];
  for (let i = 0; i < plan.length; i++) {
    const svg = await generateSlideSvg({ specLock, plan: plan[i], pageIndex: i, totalPages: plan.length, signal: params.signal });
    slides.push({ id: `s${i + 1}`, layout: plan[i].role, title: plan[i].title, svg });
  }
  return slides;
}
```

- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 提交** `git commit -m "feat: 串联 pagePlan 与 executor 生成带 svg 的 Slide"`

### Task 2.3: SvgViewer 预览组件接入

**Files:**
- Create: `src/preview/SvgViewer.tsx`
- Modify: `src/components/presentation-mode.tsx`（用 SvgViewer 渲染 slide.svg）

**Interfaces:**
- Produces: `SvgViewer({ svg: string; width: number })` 组件（用 `dangerouslySetInnerHTML` 或解析后渲染 svg 字符串，保留可编辑文本选择）

- [ ] **Step 1: 写组件**
```tsx
// src/preview/SvgViewer.tsx
import { memo } from "react";
export const SvgViewer = memo(function SvgViewer({ svg, width }: { svg: string; width: number }) {
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: "#fff" }}>
      <div style={{ width: "100%", aspectRatio: "16/9" }} dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
});
```

- [ ] **Step 2: 在 presentation-mode.tsx 中，当 slide.svg 存在时用 SvgViewer，否则回退旧渲染**
- [ ] **Step 3: 手动/单元测试验证能渲染一份含 svg 的 fixture**
- [ ] **Step 4: 提交** `git commit -m "feat: 新增 SvgViewer 原生 SVG 预览并接入演示模式"`

---

## Phase 3 — 质量闸门

### Task 3.1: SVG 质量校验器（坐标/溢出/图表几何）

**Files:**
- Create: `src/engine/svg/quality/checker.ts`
- Create: `src/engine/svg/quality/checker.test.ts`

**Interfaces:**
- Produces: `export function checkSvg(svg: string, specLock: SpecLock): SvgIssue[]`（SvgIssue={severity:"error"|"warn"; message:string; location?:string}）
- Consumes: `validateSvgContract`

校验项：
1. 根 viewBox 合规（复用 contract）
2. 所有元素坐标 + 尺寸在 0..1280 / 0..720 内（解析 rect/circle/text 的 x/y/width/height/cx/cy/r）
3. `<text>` 字号 × 估算字数不超出所在容器（基于字号像素粗略预算）
4. 图表元素（如有 `<rect>` 表示柱）高度在画布内

- [ ] **Step 1: 写失败测试**（一个 rect 超出右边界 1280 → 报 error；一个越界 text → error）
- [ ] **Step 2: 运行失败**
- [ ] **Step 3: 实现 checkSvg**（用正则/简单 XML 解析提取几何属性，做边界判断）
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 提交** `git commit -m "feat: 新增 SVG 质量校验器（越界/溢出/几何）"`

### Task 3.2: 失败重画重试编排

**Files:**
- Modify: `src/engine/svg/executor.ts`（generateSlideSvg 内集成 checkSvg，失败回喂重画，≤2 轮）
- Test: `src/engine/svg/executor.test.ts`（扩充：mock chat 首次越界、二次合规 → 最终返回合规）

- [ ] **Step 1: 写失败测试**（断言重试逻辑：当首轮 checkSvg 有 error，调用第二次 chat 并传入错误反馈）
- [ ] **Step 2: 运行失败**
- [ ] **Step 3: 实现重试**

```ts
// 在 generateSlideSvg 内
let svg = await rawGenerate(prompt);
for (let attempt = 1; attempt <= 2; attempt++) {
  const issues = checkSvg(svg, specLock).filter(i => i.severity === "error");
  if (issues.length === 0) return svg;
  const feedback = `你的 SVG 有以下问题，请修正后重新输出完整 SVG：\n` + issues.map(i => "- " + i.message).join("\n");
  svg = await rawGenerate(prompt + "\n\n" + feedback);
}
return svg; // 仍可能含 warn，但不再重试
```

- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 提交** `git commit -m "feat: SVG 生成集成质量闸门与失败重画重试"`

---

## Phase 4 — SVG→PPTX 翻译器（核心）

### Task 4.1: 翻译基础元素（rect/circle/ellipse/line/text/tspan）

**Files:**
- Create: `src/engine/pptx-translator/index.ts`
- Create: `src/engine/pptx-translator/elements.ts`
- Create: `src/engine/pptx-translator/index.test.ts`

**Interfaces:**
- Produces: `export async function svgToPptx(slides: Slide[], design: DesignLock): Promise<Blob>`（复用现有 exporter 的 pptxgenjs 初始化与 Tauri 写入）
- Produces: `function translateSvgToSlide(svg: string, pptxSlide: PptxSlide): void`（解析 SVG，逐元素调用 pptxgenjs addText/addShape）
- Consumes: `pptxgenjs` API（addText/addShape/addImage，参考现有 render-slide.ts）

映射：
- `<rect rx>` → `pptx.addShape("roundRect", {x,y,w,h, fill, rectRadius})`
- `<circle>`/`<ellipse>` → `addShape("ellipse"/"oval")`
- `<line>` → `addShape("line")`
- `<text>`/`<tspan>` → `addText`（保留 x/y、font-size、fill、font-family、text-anchor→align）
- 坐标换算：SVG 像素 / 1280 * SLIDE_W(13.333)、/720*SLIDE_H(7.5)

- [ ] **Step 1: 写失败测试**（输入含 rect+text 的 SVG，翻译后 pptx 含对应 shape 与 text；用内存 pptxgenjs 验证元素数）
- [ ] **Step 2: 运行失败**
- [ ] **Step 3: 实现 elements.ts（SVG 字符串解析 + 逐元素翻译）**
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 提交** `git commit -m "feat: 新增 SVG→PPTX 翻译器（基础元素）"`

### Task 4.2: 渐变与路径翻译

**Files:**
- Modify: `src/engine/pptx-translator/elements.ts`
- Create: `src/engine/pptx-translator/gradient.ts`
- Test: `src/engine/pptx-translator/index.test.ts`（扩充）

- [ ] **Step 1: 写失败测试**（含 linearGradient 的 rect 翻译后保留渐变填充）
- [ ] **Step 2: 运行失败**
- [ ] **Step 3: 实现 gradient 翻译（linearGradient→pptx genFill/gradient；path→custGeom 或降级为自由形状）**
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 提交** `git commit -m "feat: 翻译器支持渐变与路径"`

### Task 4.3: 图表翻译（bars/pie/line 原生图表）

**Files:**
- Create: `src/engine/pptx-translator/chart.ts`
- Test: `src/engine/pptx-translator/index.test.ts`（扩充）

- [ ] **Step 1: 写失败测试**（SVG 中若含结构化图表标记如 `data-chart="bar"` 的 group，翻译为 pptxgenjs addChart 原生图表）
- [ ] **Step 2: 运行失败**
- [ ] **Step 3: 实现 chart 翻译（约定 SVG 内图表用 `<g data-chart-type="bar" data-chart-data='[...]'>`，翻译器读 data 生成原生 chart）**
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 提交** `git commit -m "feat: 翻译器支持原生图表"`

### Task 4.4: 接入导出入口并废弃旧 render-slide.ts

**Files:**
- Modify: `src/engine/pptx/exporter.ts`（当 Slide 含 svg 时走 svgToPptx，否则回退旧路径）
- Deprecate: `src/engine/pptx/render-slide.ts`（保留旧函数作 fallback，标记 deprecated）

- [ ] **Step 1: 在 exporter 中优先调用 svgToPptx（slide.svg 存在时）**
- [ ] **Step 2: 端到端测试：生成带 svg 的 deck → 导出 blob → 断言 blob.size>1000 且含文本**
- [ ] **Step 3: 提交** `git commit -m "feat: 导出入口接入 SVG 翻译器，保留旧路径 fallback"`

---

## Phase 5 — 逐页重画 UI（稳定性兜底）

### Task 5.1: 单页重生成动作

**Files:**
- Modify: `src/store/deck.ts`（新增 regenerateSlide(slideId) action，调用 generateSlideSvg 并重写该 Slide.svg）
- Create: `src/components/slide-redraw.tsx`（预览页上的「重画此页」按钮）
- Test: `src/store/deck.test.ts`（扩充）

- [ ] **Step 1: 写失败测试**（regenerateSlide 调用 executor 并更新 store 中该 slide.svg）
- [ ] **Step 2: 运行失败**
- [ ] **Step 3: 实现 action + UI 按钮（调用 buildSpecLock + generateSlideSvg，替换 svg）**
- [ ] **Step 4: 运行通过**
- [ ] **Step 5: 提交** `git commit -m "feat: 新增单页重画动作与 UI 按钮"`

### Task 5.2: 端到端联调与文档

**Files:**
- Modify: `README.md`（新增 X1 架构使用说明）
- Test: 手动生成一份 8–10 页 deck，验证预览=导出、可编辑

- [ ] **Step 1: 端到端跑通（mock 或真实 LLM）生成→预览→导出**
- [ ] **Step 2: 打开导出 PPTX 确认文本/形状可编辑**
- [ ] **Step 3: 更新 README**
- [ ] **Step 4: 提交** `git commit -m "docs: 补充 X1 架构使用说明并端到端联调"`

---

## 自我审查（Spec 覆盖对照）

- [x] L1 specLock + pagePlan → Phase 0 / Phase 1
- [x] L2 逐页串行 SVG 生成 → Phase 2（executor 用 for 循环串行）
- [x] L3 质量闸门 0-error + 重画 → Phase 3
- [x] L4 SVG→PPTX 原生翻译（rect/text/circle/path/渐变/图表）→ Phase 4
- [x] 预览原生渲染 SVG → Phase 2.3
- [x] 逐页重画兜底 → Phase 5
- [x] 现有代码取舍（visual-styles/palettes 硬化、layout-geometry/build 废弃由新链路替代）→ 各 Phase 明确
- [x] 像素 viewBox 1280×720 → spec-contract 强制

## 开放风险（计划中已含应对）

- 翻译器路径/复杂 SVG 保真度：Phase 4.2 降级策略（path 转自由形状）。
- 串行速度：Phase 2.2 串行实现，后续可优化为结构并行+视觉串行（超出本计划范围）。
- LLM SVG 质量波动：Phase 3 质量闸门 + Phase 5 重画兜底。
