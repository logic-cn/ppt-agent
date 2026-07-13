# PPT Agent 质量提升重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 PPT Agent 的"设计概念模型"与"生成主链路"，把 PPT 生成质量做高、做稳——通过分层原子设计模型、设计规范锁、首屏锚点、质量门分级、设计词表、样例画廊 few-shot、图片一致性锁、失败恢复矩阵八项改造。

**Architecture:** 把当前缠在一起的"主题(Theme，含配色+字体+几何)"与"模板(Template，含结构+绑主题+论证提示)"拆成 5 层原子（叙事模式 / 视觉风格 / 配色 / 版式几何 / 结构模板）+ 1 层组合（画廊预设）。新增 `DesignLock` 作为每 deck 锁定的设计契约，注入到每一次 LLM 调用以杜绝长 deck 风格漂移；质量检查按 hard/soft 分级，hard 阻断导出；样例 deck 同时作为 UI 画廊与 LLM few-shot。

**Tech Stack:** TypeScript 5.7 (strict) + React 18 + Zustand + pptxgenjs 4 + vitest 4。无后端推理（LLM 走 API 适配层）。

## Global Constraints

- 大爆炸迁移：**不保留旧 deck 兼容性**，旧 deck 文件直接删除，无需写迁移逻辑（用户确认：开发阶段）。
- 前端代码必须通过 prettier 格式检查：提交前跑 `pnpm format:check`。
- 所有新增/修改的 TS 必须通过 `pnpm typecheck`（tsc --noEmit, strict 模式）。
- 逻辑模块（类型守卫、模式选择、few-shot 选择、质量分级、恢复决策）必须有 vitest 单测，TDD 红绿循环。
- 设计词表/样例数据必须与 LLM 输出 schema（`Slide`）同构，才能直接做 few-shot。
- 中英文文案：UI 与提示词以中文为主（项目约定）。
- 不引入新运行时依赖（vitest/zod/zustand 已就绪）；如需新依赖须先确认。

---

## File Structure（分解）

**新建**
- `src/types/design.ts` — 核心类型：`NarrativeModeId` / `VisualStyleId` / `PaletteId` / `DesignLock`
- `src/design/narrative-modes.ts` — 5+1 叙事模式定义 + `selectModeByScenario` + 注入用规则文本
- `src/design/visual-styles.ts` — 6 个视觉风格定义（形状/字体性格/留白/装饰，无 HEX）
- `src/design/palettes.ts` — 从 4 主题抽取的颜色方案（仅颜色）
- `src/engine/layout-geometry.ts` — 从主题抽出的版式几何（每 layout 矩形，单一共享）
- `src/types/example.ts` — `GalleryExample` 类型
- `src/examples/index.ts` + `src/examples/*.ts` — 5-8 个内置样例 deck（结构+内容，带 design 标签）
- `src/services/llm/few-shot.ts` — few-shot 选择与 prompt 构建
- `src/services/generation/first-page-gate.ts` — 首屏风格校验
- `src/services/recovery.ts` — 失败恢复决策矩阵
- `src/components/design/` — 模式/风格/配色选择器
- `src/components/gallery/GalleryPanel.tsx` — 画廊 UI

**修改**
- `src/types/theme.ts` — 删除（几何/字体移出），仅保留 `Palette` 兼容导出或整体并入 `palettes.ts`
- `src/types/template.ts` — 去掉 `suggestedTheme`/`promptHints`，加 `suggestedMode?`
- `src/templates/index.ts` + 8 个 `*.ts` — 瘦身为纯结构（章节顺序+layout），去掉配色/提示绑定
- `src/services/llm/prompts/outline.ts` — `buildOutlineSystemPrompt` 接收 `DesignLock` + few-shot
- `src/services/llm/prompts/content.ts` — `buildContentSystemPrompt` 接收 `DesignLock`
- `src/services/outline.ts` — `generateOutline` 签名加 `design: DesignLock`
- `src/services/content.ts` — `generateSlideContent` 签名加 `design: DesignLock`
- `src/services/quality/deck-quality.ts` — 改为 `hard`/`soft` 分级，返回 `QualityFinding[]`
- `src/engine/render-ir/validate.ts` — 与分级对齐（越界/缺图归 hard）
- `src/services/image.ts` — 图片生成注入 `visualStyle.pairedImageRendering` + `palette`
- `src/services/llm/adapter.ts` — 接入 `recovery.ts` 决策
- `src/store/deck.ts` — `themeId` 改为 `design: DesignLock`
- `src/components/chat/chat-panel.tsx` — 接入 DesignLock、首屏锚点、质量门阻断
- 新建/编辑流程 UI（Home/Editor）— 设计选择 + 画廊

---

## Phase 0：核心类型与概念模型（地基）

### Task 0.1：定义 DesignLock 与设计原子类型

**Files:**
- Create: `src/types/design.ts`
- Test: `src/types/design.test.ts`

**Interfaces:** 后续所有模块消费 `DesignLock`。

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from "vitest";
import { isDesignLock, NARRATIVE_MODE_IDS, VISUAL_STYLE_IDS } from "./design";

describe("isDesignLock", () => {
  it("接受合法 DesignLock", () => {
    const d = { mode: "pyramid", visualStyle: "swiss-minimal", palette: "business-blue" };
    expect(isDesignLock(d)).toBe(true);
  });
  it("拒绝未知 mode", () => {
    const d = { mode: "foo", visualStyle: "swiss-minimal", palette: "business-blue" };
    expect(isDesignLock(d)).toBe(false);
  });
  it("mode 枚举覆盖 5+1", () => {
    expect(NARRATIVE_MODE_IDS).toEqual(
      expect.arrayContaining(["pyramid", "narrative", "instructional", "showcase", "briefing", "custom"]),
    );
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/types/design.test.ts`
Expected: FAIL（模块未导出）

- [ ] **Step 3: 写最小实现**

```ts
import type { SlideLayout } from "./deck";

export type NarrativeModeId =
  | "pyramid"
  | "narrative"
  | "instructional"
  | "showcase"
  | "briefing"
  | "custom";

export type VisualStyleId =
  | "swiss-minimal"
  | "dark-tech"
  | "soft-rounded"
  | "editorial"
  | "blueprint"
  | "glassmorphism";

export type PaletteId = string;

export interface DesignLock {
  mode: NarrativeModeId;
  visualStyle: VisualStyleId;
  palette: PaletteId;
  templateId?: string;
  modeBehavior?: string;
  visualStyleBehavior?: string;
}

export const NARRATIVE_MODE_IDS: NarrativeModeId[] = [
  "pyramid", "narrative", "instructional", "showcase", "briefing", "custom",
];
export const VISUAL_STYLE_IDS: VisualStyleId[] = [
  "swiss-minimal", "dark-tech", "soft-rounded", "editorial", "blueprint", "glassmorphism",
];

export function isDesignLock(v: unknown): v is DesignLock {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    NARRATIVE_MODE_IDS.includes(o.mode as NarrativeModeId) &&
    VISUAL_STYLE_IDS.includes(o.visualStyle as VisualStyleId) &&
    typeof o.palette === "string"
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/types/design.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/types/design.ts src/types/design.test.ts
git commit -m "feat(types): 新增 DesignLock 与设计原子类型"
```

### Task 0.2：抽取版式几何（从 Theme.layouts 移出）

**Files:**
- Create: `src/engine/layout-geometry.ts`
- Modify: `src/engine/render-ir/build.ts`（改用共享几何，不再读 `theme.layouts`）
- Test: `src/engine/layout-geometry.test.ts`

**Interfaces:** `LAYOUT_GEOMETRY: Record<SlideLayout, LayoutSpec>` 被 IR 构建消费。

- [ ] **Step 1: 写测试**

```ts
import { describe, it, expect } from "vitest";
import { getLayoutRects } from "./layout-geometry";
import type { SlideLayout } from "../types/deck";

describe("getLayoutRects", () => {
  it("覆盖所有 layout 且返回 title/body/visual", () => {
    const layouts: SlideLayout[] = ["cover", "section", "content", "two-column", "chart", "closing", "cols-2", "cols-3", "cols-4", "cols-5", "cols-6", "image"];
    for (const l of layouts) {
      const r = getLayoutRects(l);
      expect(r.title).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: 跑测试确认失败** → FAIL

- [ ] **Step 3: 写实现（几何从 business-blue.json 提取，并复核其余 3 主题一致）**

```ts
import type { SlideLayout, LayoutSpec, Rect } from "../types/deck";

const cover: LayoutSpec = {
  title: { x: 0.08, y: 0.32, w: 0.84, h: 0.22 },
  body: { x: 0.08, y: 0.58, w: 0.7, h: 0.14 },
};
const section: LayoutSpec = {
  title: { x: 0.08, y: 0.38, w: 0.84, h: 0.2 },
  body: { x: 0.08, y: 0.62, w: 0.5, h: 0.12 },
};
const content: LayoutSpec = {
  title: { x: 0.1, y: 0.1, w: 0.8, h: 0.1 },
  body: { x: 0.14, y: 0.24, w: 0.72, h: 0.64 },
};
const twoColumn: LayoutSpec = {
  title: { x: 0.08, y: 0.08, w: 0.84, h: 0.12 },
  body: { x: 0.06, y: 0.22, w: 0.42, h: 0.7 },
  visual: { x: 0.52, y: 0.22, w: 0.42, h: 0.7 },
};
const chart: LayoutSpec = {
  title: { x: 0.08, y: 0.08, w: 0.84, h: 0.12 },
  visual: { x: 0.1, y: 0.22, w: 0.8, h: 0.68 },
};
const closing: LayoutSpec = { title: { x: 0.08, y: 0.4, w: 0.84, h: 0.2 } };
const cols = (n: number): LayoutSpec => ({
  title: { x: 0.08, y: 0.08, w: 0.84, h: 0.12 },
  body: { x: 0.06, y: 0.22, w: 0.88, h: 0.7 },
  visual: { x: 0.06, y: 0.22, w: 0.88, h: 0.7 },
});
const image: LayoutSpec = {
  title: { x: 0.08, y: 0.08, w: 0.84, h: 0.12 },
  visual: { x: 0.08, y: 0.22, w: 0.84, h: 0.7 },
};

export const LAYOUT_GEOMETRY: Record<SlideLayout, LayoutSpec> = {
  cover, section, content, "two-column": twoColumn, chart, closing,
  "cols-2": cols(2), "cols-3": cols(3), "cols-4": cols(4), "cols-5": cols(5), "cols-6": cols(6), image,
};

export function getLayoutRects(layout: SlideLayout): LayoutSpec {
  return LAYOUT_GEOMETRY[layout];
}
```

- [ ] **Step 4: 改 `src/engine/render-ir/build.ts`** — 把 `theme.layouts[slide.layout]` 替换为 `getLayoutRects(slide.layout)`，删除对 `theme.layouts` 的引用。

- [ ] **Step 5: 跑测试 + typecheck** → PASS / 无错

- [ ] **Step 6: 提交**

---

## Phase 1：设计系统词表（视觉风格 + 叙事模式 + 配色）

### Task 1.1：配色方案（从 4 主题抽颜色）

**Files:**
- Create: `src/design/palettes.ts`
- Test: `src/design/palettes.test.ts`

- [ ] **Step 1: 写测试**：`getPalette("business-blue")` 返回含 7 个颜色字段的对象；未知 id 返回 undefined。

- [ ] **Step 2: 写实现**（从 `src/themes/*.json` 的 `colors` 提取，仅保留颜色；保留 4 套）

```ts
import type { ThemeColors } from "../types/theme";

export interface Palette { id: string; name: string; colors: ThemeColors; }

export const PALETTES: Palette[] = [
  { id: "business-blue", name: "商务深蓝", colors: { primary: "#60A5FA", secondary: "#3B82F6", accent: "#FBBF24", background: "#0C1929", surface: "#1A2D42", text: "#F1F5F9", textMuted: "#94A3B8" } },
  { id: "minimal-white", name: "极简白", colors: { /* 从 minimal-white.json 提取 */ primary: "#2563EB", secondary: "#1E40AF", accent: "#F59E0B", background: "#FFFFFF", surface: "#F8FAFC", text: "#0F172A", textMuted: "#64748B" } },
  { id: "tech-purple", name: "科技紫", colors: { /* 从 tech-purple.json 提取 */ primary: "#A78BFA", secondary: "#7C3AED", accent: "#22D3EE", background: "#1E1B4B", surface: "#312E81", text: "#F5F3FF", textMuted: "#C4B5FD" } },
  { id: "vibrant-orange", name: "活力橙", colors: { /* 从 vibrant-orange.json 提取 */ primary: "#FB923C", secondary: "#EA580C", accent: "#22D3EE", background: "#1C1917", surface: "#292524", text: "#FAFAF9", textMuted: "#A8A29E" } },
];

export function getPalette(id: string): Palette | undefined {
  return PALETTES.find((p) => p.id === id);
}
```

- [ ] **Step 3: 测试通过 + 提交**

### Task 1.2：视觉风格词表（6 个，无 HEX）

**Files:**
- Create: `src/design/visual-styles.ts`
- Test: `src/design/visual-styles.test.ts`

- [ ] **Step 1: 写测试**：`getVisualStyle("swiss-minimal")` 返回 `decoration.cornerRadius === 0`；`pairedImageRendering` 为字符串；unknown 返回 undefined。

- [ ] **Step 2: 写实现**

```ts
import type { ThemeFonts, ThemeFontSize, Spacing } from "../types/theme";

export interface VisualStyleDef {
  id: string;
  name: string;
  character: string;       // 注入 prompt：形状/装饰/留白/质感，禁止写具体颜色
  fonts: ThemeFonts;
  fontSize: ThemeFontSize;
  spacing: Spacing;
  decoration: { cornerRadius: number; shadows: boolean; density: "sparse" | "supportive" | "core" };
  pairedImageRendering: string;
}

export const VISUAL_STYLES: VisualStyleDef[] = [
  {
    id: "swiss-minimal", name: "瑞士极简",
    character: "严格网格、锐利几何、零装饰、激进留白；形状圆角 rx=0；无渐变无阴影；字重对比(900/300)而非字体对比；主色仅占极小区域。",
    fonts: { title: "'Source Han Sans CN', sans-serif", body: "'Source Han Sans CN', sans-serif" },
    fontSize: { h1: 44, h2: 32, body: 18, caption: 14 }, spacing: "airy",
    decoration: { cornerRadius: 0, shadows: false, density: "sparse" }, pairedImageRendering: "minimalist-swiss",
  },
  {
    id: "dark-tech", name: "暗黑科技",
    character: "深色画布、发光强调色、几何精密；形状圆角小(≤4)；轻微辉光但不滥用阴影；数据感强，多用线条与网格。",
    fonts: { title: "'Source Han Sans CN', sans-serif", body: "'Source Han Sans CN', sans-serif" },
    fontSize: { h1: 42, h2: 30, body: 18, caption: 14 }, spacing: "comfortable",
    decoration: { cornerRadius: 4, shadows: true, density: "sparse" }, pairedImageRendering: "digital-dashboard",
  },
  {
    id: "soft-rounded", name: "柔和圆角",
    character: "圆角卡片(≥12)、轻投影、亲和；留白适中；适合产品/SaaS/培训。",
    fonts: { title: "'Source Han Sans CN', sans-serif", body: "'Source Han Sans CN', sans-serif" },
    fontSize: { h1: 40, h2: 30, body: 18, caption: 14 }, spacing: "comfortable",
    decoration: { cornerRadius: 12, shadows: true, density: "supportive" }, pairedImageRendering: "flat",
  },
  {
    id: "editorial", name: "杂志编辑",
    character: "杂志层级、分栏与分隔线、衬线/无衬线混排；规则感强；留白克制。",
    fonts: { title: "'Noto Serif SC', serif", body: "'Source Han Sans CN', sans-serif" },
    fontSize: { h1: 44, h2: 32, body: 18, caption: 14 }, spacing: "comfortable",
    decoration: { cornerRadius: 0, shadows: false, density: "supportive" }, pairedImageRendering: "editorial",
  },
  {
    id: "blueprint", name: "蓝图工程",
    character: "深色纸上的示意线条、等距图、注释；几何精密；适合技术/架构。",
    fonts: { title: "'Source Han Sans CN', monospace", body: "'Source Han Sans CN', sans-serif" },
    fontSize: { h1: 40, h2: 30, body: 17, caption: 13 }, spacing: "comfortable",
    decoration: { cornerRadius: 2, shadows: false, density: "supportive" }, pairedImageRendering: "blueprint",
  },
  {
    id: "glassmorphism", name: "玻璃拟态",
    character: "半透明玻璃面板、渐变光、悬浮景深；圆角大(≥16)；适合现代 SaaS/发布会。",
    fonts: { title: "'Source Han Sans CN', sans-serif", body: "'Source Han Sans CN', sans-serif" },
    fontSize: { h1: 44, h2: 32, body: 18, caption: 14 }, spacing: "comfortable",
    decoration: { cornerRadius: 16, shadows: true, density: "sparse" }, pairedImageRendering: "glassmorphism",
  },
];

export function getVisualStyle(id: string): VisualStyleDef | undefined {
  return VISUAL_STYLES.find((s) => s.id === id);
}
```

- [ ] **Step 3: 测试通过 + 提交**

### Task 1.3：叙事模式词表 + 场景映射

**Files:**
- Create: `src/design/narrative-modes.ts`
- Test: `src/design/narrative-modes.test.ts`

- [ ] **Step 1: 写测试**：`selectModeByScenario("business_review") === "pyramid"`；`selectModeByScenario("training") === "instructional"`；`getMode("pyramid").titleRule` 含"结论句"。

- [ ] **Step 2: 写实现**

```ts
import type { NarrativeModeId } from "../types/design";

export interface NarrativeModeDef {
  id: NarrativeModeId;
  name: string;
  bestFor: string;
  titleRule: string;       // 注入 prompt：标题写法
  structureTendency: string;
  notesRegister: string;
  pageSkeleton: string;
}

export const NARRATIVE_MODES: Record<NarrativeModeId, NarrativeModeDef> = {
  pyramid: {
    id: "pyramid", name: "结论先行", bestFor: "决策/分析/汇报",
    titleRule: "标题写结论句而非话题词，例如「留存而非拉新驱动增长」而非「用户分析」；每个数字都配对比(同比/环比/标杆)与「所以呢」。",
    structureTendency: "封面/导语→结论→MECE 支撑论点→每页自含一个结论；数据源标注。",
    notesRegister: "首句即要点，随后 2-3 个带比较的事实，权威沉稳。",
    pageSkeleton: "标题(结论) / 一句话要点 / 3 个 MECE 论点(各带对比数据) / 来源",
  },
  narrative: {
    id: "narrative", name: "故事线", bestFor: "路演/案例/品牌",
    titleRule: "标题推动情节，制造张力与转折；用悬念而非标签。",
    structureTendency: "情境→冲突→问题→解答→升华；情绪节奏分明。",
    notesRegister: "口语化、有画面感、像在讲故事。",
    pageSkeleton: "钩子 / 冲突 / 转折 / 高潮 / 收尾",
  },
  instructional: {
    id: "instructional", name: "教学式", bestFor: "培训/教程/科普",
    titleRule: "标题点明本页要教会什么；步骤清晰、并列展开。",
    structureTendency: "目标→概念分解→步骤→示例→练习→回顾；由浅入深。",
    notesRegister: "讲解口吻、循序渐进、配例子。",
    pageSkeleton: "学习目标 / 概念 / 步骤 / 案例 / 练习",
  },
  showcase: {
    id: "showcase", name: "视觉冲击", bestFor: "发布会/品牌露出",
    titleRule: "极简文案，一页一个大写意；让视觉说话。",
    structureTendency: "全幅大图/大数字主导；文字极少；情绪节拍。",
    notesRegister: "简短有力、烘托氛围。",
    pageSkeleton: "主视觉 / 一句话主张 / 大数字",
  },
  briefing: {
    id: "briefing", name: "信息通报", bestFor: "周报/状态/参考",
    titleRule: "标题用话题词、中性、完整；不强行下结论。",
    structureTendency: "主题标题、权重均匀、可扫读；无 thesis。",
    notesRegister: "客观、完整、要点式。",
    pageSkeleton: "主题标题 / 要点列表 / 数据",
  },
  custom: {
    id: "custom", name: "自定义", bestFor: "混合意图",
    titleRule: "由 modeBehavior 具体描述。",
    structureTendency: "由 modeBehavior 具体描述。",
    notesRegister: "由 modeBehavior 具体描述。",
    pageSkeleton: "由 modeBehavior 具体描述。",
  },
};

const SCENARIO_TO_MODE: Record<string, NarrativeModeId> = {
  business_review: "pyramid",
  pitch: "narrative",
  training: "instructional",
  market_analysis: "briefing",
  proposal: "pyramid",
  custom: "briefing",
};

export function selectModeByScenario(scenario?: string): NarrativeModeId {
  return (scenario && SCENARIO_TO_MODE[scenario]) || "briefing";
}
export function getMode(id: NarrativeModeId): NarrativeModeDef {
  return NARRATIVE_MODES[id];
}
```

- [ ] **Step 3: 测试通过 + 提交**

### Task 1.4：模板瘦身为纯结构

**Files:**
- Modify: `src/types/template.ts`
- Modify: `src/templates/index.ts` + 8 个 `*.ts`
- Test: `src/templates/template.test.ts`

- [ ] **Step 1: 写测试**：`getTemplatePackById("quarterly-review").suggestedTheme` 为 undefined；`suggestedMode` 为 "pyramid"；`promptHints` 不存在。

- [ ] **Step 2: 改 `template.ts`**

```ts
export interface TemplatePack {
  id: string;
  name: string;
  description: string;
  scenario: string;
  suggestedMode?: NarrativeModeId;   // 新增，仅推荐不绑定
  suggestedVisualStyle?: VisualStyleId; // 新增，仅推荐
  defaultOptions: GenerationOptions;
  slides: TemplateSlide[];
  qualityRules?: string[];
  // 删除 suggestedTheme / promptHints
}
```

- [ ] **Step 3: 改 `index.ts`** — 每个 pack 去掉 `suggestedTheme`/`promptHints`，加 `suggestedMode`（按 scenario 映射：business_review/proposal→pyramid；pitch→narrative；training→instructional；market_analysis→briefing）。`buildContextualPrompt` 改为只输出"页面顺序+layout"，并附 `suggestedMode` 建议行，不再注入论证提示。

- [ ] **Step 4: 测试通过 + typecheck + 提交**

---

## Phase 2：样例画廊 + few-shot 注入

### Task 2.1：GalleryExample 类型 + 5-8 个内置样例

**Files:**
- Create: `src/types/example.ts`
- Create: `src/examples/index.ts`（内联 5-8 个，或每例一文件）
- Test: `src/examples/examples.test.ts`

- [ ] **Step 1: 写测试**：`getExamples()` 返回 5-8 条；每条 `design` 通过 `isDesignLock`；每条 `slides` 为合法 `Slide[]`（用现有 `slideSchema` 校验）；每条 mode+visualStyle 组合唯一或可重复但覆盖多种。

- [ ] **Step 2: 写类型**

```ts
import type { Slide } from "./deck";
import type { DesignLock } from "./design";

export interface GalleryExample {
  id: string;
  name: string;
  thumbnail?: string;
  design: DesignLock;
  slides: Slide[];   // 同 LLM 输出 schema，可作 few-shot
}
```

- [ ] **Step 3: 写 5-8 个样例**（覆盖金字塔+swiss / 叙事+dark-tech / 教学+soft / 通报+editorial / 复盘+blueprint 等组合；每例 6-10 页，含真实标题/bullet/chart，符合对应 mode 的标题规则）。示例节选：

```ts
export const EXAMPLES: GalleryExample[] = [
  {
    id: "quarterly-pyramid-swiss",
    name: "季度复盘·结论先行·瑞士极简",
    design: { mode: "pyramid", visualStyle: "swiss-minimal", palette: "business-blue" },
    slides: [
      { id: "s1", layout: "cover", title: "Q2 业务复盘", bullets: [] },
      { id: "s2", layout: "section", title: "业绩概览", bullets: [] },
      { id: "s3", layout: "chart", title: "核心指标同比增长 23%，远超行业 12%", chart: { type: "line", title: "月度趋势", data: [{ label: "4月", value: 85 }, { label: "5月", value: 92 }, { label: "6月", value: 110 }] } },
      { id: "s4", layout: "content", title: "留存而非拉新驱动本季增长", bullets: [{ text: "复购贡献 60% 营收增长", level: 0 }, { text: "CAC 同比 +40%，获客效率下降", level: 0 }] },
      { id: "s5", layout: "closing", title: "感谢", bullets: [] },
    ],
  },
  // ... 其余 4-7 个，覆盖不同 mode+visualStyle+palette
];
export function getExamples(): GalleryExample[] { return EXAMPLES; }
```

- [ ] **Step 4: 测试通过 + 提交**

### Task 2.2：few-shot 选择 + prompt 构建

**Files:**
- Create: `src/services/llm/few-shot.ts`
- Test: `src/services/llm/few-shot.test.ts`

- [ ] **Step 1: 写测试**：`selectFewShot({mode:"pyramid",visualStyle:"swiss-minimal",palette:"business-blue"})` 优先返回 `quarterly-pyramid-swiss`；最多 2 条；`buildFewShotPrompt` 输出含 `slides` 的精简 JSON 且不含 full content 长文本。

- [ ] **Step 2: 写实现**

```ts
import type { DesignLock } from "../../types/design";
import type { GalleryExample } from "../../types/example";
import { getExamples } from "../../examples";

function score(ex: GalleryExample, d: DesignLock): number {
  let s = 0;
  if (ex.design.mode === d.mode) s += 2;
  if (ex.design.visualStyle === d.visualStyle) s += 1;
  return s;
}

export function selectFewShot(design: DesignLock, max = 2): GalleryExample[] {
  return getExamples()
    .map((e) => ({ e, s: score(e, design) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, max)
    .map((x) => x.e);
}

export function buildFewShotPrompt(examples: GalleryExample[]): string {
  if (examples.length === 0) return "";
  const body = examples
    .map((e) => `示例(${e.design.mode}/${e.design.visualStyle}):\n` +
      JSON.stringify(e.slides.map((s) => ({ layout: s.layout, title: s.title, bullets: (s.bullets ?? []).slice(0, 2) }))))
    .join("\n\n");
  return `以下是同风格的优质结构范例，请参考其章节编排与标题写法（不要照抄内容）：\n${body}`;
}
```

- [ ] **Step 3: 测试通过 + 提交**

### Task 2.3：DesignLock 注入 outline/content 提示词

**Files:**
- Modify: `src/services/llm/prompts/outline.ts` — `buildOutlineSystemPrompt(ctx)` 接收 `design: DesignLock` + `fewShot?: string`
- Modify: `src/services/llm/prompts/content.ts` — `buildContentSystemPrompt(design)`
- Modify: `src/services/outline.ts` `generateOutline(topic, design, ...)`
- Modify: `src/services/content.ts` `generateSlideContent(slide, design, ...)`
- Test: `src/services/llm/prompts/outline.test.ts`

- [ ] **Step 1: 写测试**：`buildOutlineSystemPrompt({design, fewShot})` 返回的字符串包含 mode 的 `titleRule` 文本、visualStyle 的 `character` 文本、palette 的 7 个颜色 HEX、`fewShot` 文本。

- [ ] **Step 2: 改 `outline.ts` 提示词**

```ts
import { getMode } from "../../../design/narrative-modes";
import { getVisualStyle } from "../../../design/visual-styles";
import { getPalette } from "../../../design/palettes";

export function buildOutlineSystemPrompt(opts: {
  design: DesignLock;
  templateCtx?: string;
  fewShot?: string;
}): string {
  const mode = getMode(opts.design.mode);
  const style = getVisualStyle(opts.design.visualStyle)!;
  const palette = getPalette(opts.design.palette)!;
  const c = palette.colors;
  return [
    "你是资深 PPT 设计顾问。严格按以下锁定设计生成：",
    `【叙事模式:${mode.name}】${mode.titleRule} ${mode.structureTendency}`,
    `【视觉风格:${style.name}】${style.character}`,
    `【配色(仅用这些 HEX)】primary:${c.primary} secondary:${c.secondary} accent:${c.accent} bg:${c.background} surface:${c.surface} text:${c.text} muted:${c.textMuted}`,
    opts.templateCtx ? `【结构模板】\n${opts.templateCtx}` : "",
    opts.fewShot ?? "",
    "输出 JSON 数组，每页含 layout/title/bullets/chart(按需)。",
  ].filter(Boolean).join("\n");
}
```

- [ ] **Step 3: 改 `src/services/outline.ts`** — `generateOutline(topic, design, opts)` 内调用 `buildOutlineSystemPrompt({ design, templateCtx: design.templateId? buildContextualPrompt(getTemplatePackById(design.templateId)!, topic): undefined, fewShot: buildFewShotPrompt(selectFewShot(design)) })`，`temperature` 维持 0.6。

- [ ] **Step 4: 改 `content.ts`** 类似注入 style+palette（不含模板结构）。

- [ ] **Step 5: 测试通过 + typecheck + 提交**

---

## Phase 3：质量门分级 + 首屏锚点（P0 稳）

### Task 3.1：质量检查 hard/soft 分级

**Files:**
- Modify: `src/services/quality/deck-quality.ts`
- Test: `src/services/quality/deck-quality.test.ts`

- [ ] **Step 1: 写测试**：缺封面→`hard`；bullet>7→`soft` 且 `autoFixable`；空 chart(无 data)→`hard`；标题为空泛词("概述")→`soft`。

- [ ] **Step 2: 改类型与实现**

```ts
export type Severity = "hard" | "soft";
export interface QualityFinding {
  rule: string;
  severity: Severity;
  message: string;
  slideId?: string;
  autoFixable: boolean;
}
export function checkDeckQuality(deck: Deck): QualityFinding[] {
  const out: QualityFinding[] = [];
  const hasCover = deck.slides.some((s) => s.layout === "cover");
  if (!hasCover) out.push({ rule: "require_cover", severity: "hard", message: "缺少封面页", autoFixable: false });
  const hasClosing = deck.slides.some((s) => s.layout === "closing");
  if (!hasClosing) out.push({ rule: "require_closing", severity: "hard", message: "缺少结尾页", autoFixable: false });
  for (const s of deck.slides) {
    const bullets = s.bullets ?? [];
    if (bullets.length > 7) out.push({ rule: "bullets_too_many", severity: "soft", message: `「${s.title}」要点超过 7 条`, slideId: s.id, autoFixable: true });
    if (s.layout === "chart" && (!s.chart || !s.chart.data || s.chart.data.length === 0))
      out.push({ rule: "empty_chart", severity: "hard", message: `「${s.title}」图表无数据`, slideId: s.id, autoFixable: false });
    if (s.title && /^(概述|分析|介绍|内容|总结)$/.test(s.title.trim()))
      out.push({ rule: "vague_title", severity: "soft", message: `「${s.title}」标题空泛`, slideId: s.id, autoFixable: false });
  }
  return out;
}
export function hasHardError(findings: QualityFinding[]): boolean {
  return findings.some((f) => f.severity === "hard");
}
```

- [ ] **Step 3: 测试通过 + 提交**

### Task 3.2：校验在 auto-fix 之前跑（不遮丑）

**Files:**
- Modify: `src/services/quality/auto-fix.ts` 调用方（`chat-panel.tsx` 的"一键修复"）
- 确保顺序：`checkDeckQuality` → 仅对 `soft && autoFixable` 应用 `applyAutoFixes`；`hard` 阻断并提示用户重生成对应页。

- [ ] **Step 1: 写测试**：`applyAutoFixes(deck, findings)` 只对 soft+autoFixable 生效；hard 不被修改。

- [ ] **Step 2: 实现**：在 `auto-fix.ts` 增加过滤 `findings.filter(f => f.severity==="soft" && f.autoFixable)` 后再修复；导出 `hardFindings` 供 UI 阻断。

- [ ] **Step 3: 测试通过 + 提交**

### Task 3.3：首屏风格锚点关卡

**Files:**
- Create: `src/services/generation/first-page-gate.ts`
- Modify: `src/components/chat/chat-panel.tsx`
- Test: `src/services/generation/first-page-gate.test.ts`

- [ ] **Step 1: 写测试**：对 `design={mode:"pyramid",...}` 的 deck，首屏标题为话题词("市场概述")→返回 hard finding（违反 pyramid 标题规则）；首屏标题为结论句→通过。

- [ ] **Step 2: 写实现**

```ts
import type { Deck } from "../../types/deck";
import type { DesignLock } from "../../types/design";
import { getMode } from "../../design/narrative-modes";
import { checkDeckQuality } from "../quality/deck-quality";

export function runFirstPageGate(deck: Deck, design: DesignLock): QualityFinding[] {
  const first = deck.slides[0];
  if (!first) return [];
  const findings = checkDeckQuality({ ...deck, slides: [first] });
  // 模式专属首屏规则
  if (design.mode === "pyramid" && first.title && /^(概述|分析|介绍|内容|总结)$/.test(first.title.trim())) {
    findings.push({ rule: "pyramid_title", severity: "hard", message: "结论先行模式要求首屏标题为结论句", slideId: first.id, autoFixable: false });
  }
  return findings;
}
```

- [ ] **Step 3: 改 `chat-panel.tsx`** — `generateOutline` 完成后调用 `runFirstPageGate(deck, design)`，若有 hard → 显示"首屏风格检查"横幅，提供"调整后继续/重新生成首屏"；软提示可忽略。

- [ ] **Step 4: 测试通过 + typecheck + 提交**

---

## Phase 4：图片一致性锁

### Task 4.1：图片生成注入风格/配色

**Files:**
- Modify: `src/services/image.ts` `generateImage(prompt, design)`
- Test: `src/services/image.test.ts`（测 prompt 拼接，不真调 API）

- [ ] **Step 1: 写测试**：`buildImagePrompt("产品图", design)` 含 `pairedImageRendering`(minimalist-swiss) 与 palette 主色 HEX，且不含其他随机风格词。

- [ ] **Step 2: 改 `image.ts`**

```ts
import { getVisualStyle } from "../design/visual-styles";
import { getPalette } from "../design/palettes";

export function buildImagePrompt(subject: string, design: DesignLock): string {
  const style = getVisualStyle(design.visualStyle)!;
  const palette = getPalette(design.palette)!;
  return `为${subject}生成插画，渲染风格=${style.pairedImageRendering}；配色仅用主色${palette.colors.primary}与强调色${palette.colors.accent}，保持与整份演示一致；扁平/无文字。`;
}
```

- [ ] **Step 3: 测试通过 + 提交**

---

## Phase 5：失败恢复矩阵

### Task 5.1：恢复决策 + 接入适配层

**Files:**
- Create: `src/services/recovery.ts`
- Modify: `src/services/llm/adapter.ts`（outline/content/image 调用前包裹决策）
- Test: `src/services/recovery.test.ts`

- [ ] **Step 1: 写测试**：`decideRecovery("outline", 0, err)`→`retry`；第 3 次→`ask-user`；`decideRecovery("image", 0)`→`degrade`（标记 Needs-Manual 继续）；`decideRecovery("content",1)`→`retry`。

- [ ] **Step 2: 写实现**

```ts
export type FailureKind = "outline" | "content" | "image" | "export";
export type RecoveryAction = "retry" | "degrade-rulebased" | "ask-user";

const MAX_RETRY = 2;

export function decideRecovery(kind: FailureKind, attempt: number, _err?: unknown): RecoveryAction {
  if (kind === "image") return attempt < MAX_RETRY ? "retry" : "degrade-rulebased";
  if (attempt >= MAX_RETRY) return "ask-user";
  return "retry";
}
```

- [ ] **Step 3: 改 `adapter.ts`** — 在 `OpenAICompatProvider.chat` / `AnthropicProvider` 调用处用 `decideRecovery` 决定重试/降级/上报；`image` 失败降级为占位图继续；`outline`/`content` 达上限则向上抛"需用户确认"。

- [ ] **Step 4: 测试通过 + typecheck + 提交**

---

## Phase 6：UI 集成（设计选择 + 画廊）

### Task 6.1：Deck store 改用 DesignLock

**Files:**
- Modify: `src/store/deck.ts`（删 `themeId`，加 `design: DesignLock`）
- Modify：所有读取 `themeId` 处改用 `design.palette`/`design.visualStyle`

- [ ] **Step 1: 全局搜索 `themeId`**，`grep -rn "themeId" src` 逐个替换为 `design`。

- [ ] **Step 2: 默认 design**：新建 deck 默认 `{ mode:"briefing", visualStyle:"soft-rounded", palette:"business-blue" }`。

- [ ] **Step 3: typecheck 通过 + 提交**

### Task 6.2：设计选择器组件

**Files:**
- Create: `src/components/design/ModePicker.tsx` / `StylePicker.tsx` / `PalettePicker.tsx`
- 这些组件渲染 `NARRATIVE_MODES` / `VISUAL_STYLES` / `PALETTES`，选中写入 `design`。

- [ ] **Step 1: 实现三个受控选择器**（从对应 design 数据映射，单选高亮）。

- [ ] **Step 2: typecheck + prettier + 提交**

### Task 6.3：画廊 UI + 创建流程串联

**Files:**
- Create: `src/components/gallery/GalleryPanel.tsx`
- Modify：Home/新建流程（如 `src/pages/Home.tsx` 或 Editor 新建入口）

- [ ] **Step 1: 画廊渲染 `getExamples()`**，每张卡片显示 `name` + 缩略（可用首屏 SVG/占位），点击"用此风格"→ 把 `example.design` 写入新 deck 的 `design`，并预选对应模板（若 example.design.templateId）。

- [ ] **Step 2: 创建流程改为两步**：① 选模板/画廊（定 design+结构）② 输入主题 → 调 `generateOutline(topic, design)`（已含 DesignLock+few-shot）。

- [ ] **Step 3: 接首屏锚点**：outline 完成后走 Task 3.3 的横幅。

- [ ] **Step 4: 接质量门阻断**：导出前 `checkDeckQuality`，有 hard → 禁用导出并提示。

- [ ] **Step 5: `pnpm typecheck && pnpm format:check && pnpm test` 全绿 + 提交**

---

## 执行顺序与依赖

```
Phase 0 (地基: 类型+几何) 
  → Phase 1 (词表: palette/style/mode + 模板瘦身)
    → Phase 2 (画廊+few-shot+注入)
      → Phase 3 (质量门+首屏锚点)   [P0, 质量稳]
      → Phase 4 (图片锁)
      → Phase 5 (恢复矩阵)
        → Phase 6 (UI 集成，串联全部)
```

Phase 3/4/5 互不依赖，可在 Phase 2 后并行；Phase 6 必须最后，串联所有。

## 优先级回顾（对应七点提升）

| 提升点 | Phase | 优先级 |
|---|---|---|
| 设计规范锁（DesignLock 注入每次 LLM 调用） | 1-2 | P0 |
| 首屏风格锚点 + 每页关卡 | 3 | P0 |
| 质量门 hard/soft 分级 + 校验先于修复 | 3 | P0 |
| 设计系统词表（mode+visualStyle+palette） | 1 | P1 |
| 样例画廊 + few-shot | 2 | P1 |
| 图片一致性锁 | 4 | P2 |
| 失败恢复矩阵 | 5 | P2 |

## Self-Review 备注

- 概念重叠已消解：主题拆为 palette(颜色)+visualStyle(皮肤)+layoutGeometry(几何)；模板瘦身为纯结构；画廊为原子组合层，四者不同抽象层级，不重叠。
- 所有新增逻辑模块均有 vitest 单测（TDD）。UI 任务以 typecheck/prettier/手动验证为准。
- 注意：Phase 6 的 `themeId` 全局替换需谨慎，grep 后逐文件确认语义。
- 现有 4 主题 JSON 仅颜色被 `palettes.ts` 复用；`layouts` 几何抽到 `layout-geometry.ts`；`theme.ts` 的 `Theme` 类型在 Phase 6 后可删除（仅留 `ThemeColors`/`ThemeFonts` 等被 palette/style 复用）。
