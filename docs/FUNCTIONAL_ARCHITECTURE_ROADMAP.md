# PPT Agent 功能与架构落地规划

本文档用于指导后续产品功能开发和架构优化。它面向“交给大模型或开发者逐项实现”的场景，因此每个模块都包含目标、范围、建议实现、验收标准和开发顺序。

> 说明：本文档不包含“LLM Provider 增加能力声明”的规划。

## 0. 现状对照（2026-10 更新）

本文档写于 X1 架构落地之前，个别条目已被后续决策取代。**先看这张对照表再往下读**，
避免照着已被取代的条目重复开发。

| 章节 | 模块 | 现状 | 落点 |
|---|---|---|---|
| §4 | Deck Patch AI 编辑协议 | ✅ 已落地 | `services/deck-patch/{types,schema,apply,summarize,ai,prompts}.ts`；ChatPanel 走 patch 确认流 |
| §5 | 统一长任务系统 | ✅ 已落地 | `store/job.ts` + `services/jobs/`；生成/导入/导出/视觉自检均接入 jobStore |
| §6 | 预览/导出共享渲染 IR | ⚠️ **已被 X1 取代** | X1 定「SVG 为设计真相 + 原生 PPTX 翻译」，`engine/render-ir` 降级为**无 SVG 历史页的回退渲染**（且仅支持 16:9）。**不要再推进「Preview/Exporter 全面迁移到 RenderIR」** |
| §7 | 生成质量控制 | ✅ 已远超初版 | `services/quality/`（deck-quality / auto-fix / visual-review）+ `engine/svg/quality/checker.ts`；55 条结构化诊断、导出锁、修复环、原子修复、跨页一致性门 |
| §8 | 文档导入增强 | ✅ 已落地 | `services/importer/`（pipeline / docx / markdown / pdf / url）；DocumentSource + sections + chunks + keyFacts + sourceRefs |
| §9 | 页面属性检查器 | ✅ 已落地 | `components/inspector/`，5 个 tab：AI / 页面 / 图表 / 图片 / 备注 |
| §10 | Deck schema 迁移与校验 | ✅ 已落地 | `services/storage/{deck-schema,deck-migrations,deck-repair,deck-parse}.ts` |
| §11 | 安全密钥存储 | ✅ 已落地 | `services/secret-store.ts`（Tauri keychain，Web 降级并显式提示） |
| §12 | 模板系统产品化 | 🟡 **部分** | 8 个内置模板包 + `presets/template-context.ts`（角色顺序 + 指令 + 质量规则）已可用；缺 TemplatePack 级的完整绑定（`promptHints` / 推荐图表策略 / 默认 `GenerationOptions`） |
| §13 | 测试与质量门禁 | ✅ 已落地 | 671 个测试 + vitest coverage 阈值 + `scripts/local-e2e/` 端侧无头实跑 harness（不进 CI） |

**因此，当前后续可做的主线只有一条：§12 模板系统产品化的剩余部分**，
其余均为「按需再做」的增强项（见文末「后续方向」）。

## 1. 产品目标

PPT Agent 的下一阶段目标不是继续堆入口，而是从“能生成 PPT 的 MVP”升级为“可靠、可控、可编辑的本地优先 AI PPT 工作台”。

核心体验目标：

- 用户可以从主题、文档、URL 或模板开始生成可编辑 PPT。
- 用户可以通过 AI 对话对 Deck 做可控修改，而不是只能重新生成。
- 预览效果和导出的 `.pptx` 尽可能一致。
- 长任务可取消、可重试、可感知进度。
- 导入资料生成 PPT 时，结果有结构、有证据、有质量控制。
- 项目数据可迁移、可恢复，API Key 等敏感信息尽量安全存储。

## 2. 优先级总览

| 优先级 | 模块 | 价值 | 建议阶段 |
|---|---|---|---|
| P0 | Deck Patch AI 编辑协议 | 让 AI 从“生成器”变成“编辑助手” | 第一阶段 |
| P0 | 统一长任务系统 | 支撑生成、导入、配图、导出的可靠体验 | 第一阶段 |
| P0 | 预览/导出共享渲染 IR | 降低导出错位和视觉不一致风险 | 第一阶段 |
| P0 | 生成质量控制 | 提高大纲质量，减少不可用输出 | 第一阶段 |
| P1 | 文档导入增强 | 提高“资料转 PPT”的上限 | 第二阶段 |
| P1 | 页面属性检查器 | 补齐精细编辑能力 | 第二阶段 |
| P1 | Deck schema 迁移与校验 | 防止版本演进后历史项目损坏 | 第二阶段 |
| P1 | 安全密钥存储 | 提升桌面应用安全性 | 第二阶段 |
| P2 | 模板系统产品化 | 面向场景快速产出专业 Deck | 第三阶段 |
| P2 | 测试与质量门禁 | 保证长期迭代稳定 | 全阶段持续 |

## 3. 当前架构基线

当前项目已经具备以下基础：

- `Deck JSON` 是核心数据源。
- `Zustand` 管理 deck、settings、project、toast 等状态。
- `services/outline.ts`、`services/content.ts` 负责 AI 生成。
- `components/chat/chat-panel.tsx` 提供 AI 对话入口。
- `services/intent-parser.ts` 通过正则做简单本地意图修改。
- `engine/preview` 负责 HTML 预览。
- `engine/pptx` 负责 PptxGenJS 导出。
- `services/importer` 支持 docx、markdown、url。
- `services/storage.ts` 做本地 JSON 存储。

下一步优化应该尽量沿用这些边界，不大改目录结构。新增模块优先放在：

```text
src/
  services/
    deck-patch/
    quality/
    jobs/
    importer/
    storage/
  engine/
    render-ir/
  components/
    inspector/
```

### 3.1 全局实现约束

后续开发应遵守以下技术约束，避免大模型在不同任务中引入不一致实现：

- 继续使用 TypeScript + React + Zustand + zod，不引入大型状态管理或 UI 框架。
- 核心业务逻辑优先写成纯函数，UI 只负责展示和调用。
- 所有 AI 返回的结构化结果必须经过 zod 校验，禁止直接 `JSON.parse` 后写入 deck。
- 所有会修改 deck 的操作都必须进入现有 undo/redo 历史。
- 所有长任务都必须支持错误展示；能取消的任务必须接入 `AbortSignal`。
- 数据模型新增字段时，必须同步更新 `src/types/`、storage migration、测试 fixtures。
- 不要把临时 UI 状态写入 Deck JSON，例如弹窗开关、当前 tab、hover 状态。
- 文件命名沿用当前项目风格：小写短横线或现有目录风格，不新建混乱命名体系。

### 3.2 推荐模块依赖方向

依赖方向应尽量保持单向：

```text
components/*
  -> store/*
  -> services/*
  -> types/*

engine/*
  -> types/*
  -> themes/*

services/*
  -> types/*
  -> store/settings.ts 仅限 LLM/settings 读取场景
```

禁止：

- `services/*` 直接依赖 React component。
- `engine/*` 直接修改 Zustand store。
- `storage` 层依赖 UI toast。
- `deck-patch/apply.ts` 调用 LLM 或读写文件。

### 3.3 Definition of Done

每个功能模块交付时至少满足：

- TypeScript 类型检查通过。
- 新增核心纯函数有单元测试。
- UI 接入有基本空态、加载态、失败态。
- 失败不会导致 deck 被部分修改。
- 新增文档或 README 中的路径、命令、类型名称与实际代码一致。

## 4. P0：Deck Patch AI 编辑协议

### 4.1 问题

当前聊天面板通过正则判断“生成 PPT”或调用本地 `applyUserIntent` 做删页、改布局、加页。这种方式只能覆盖少量命令，无法支持高价值编辑诉求：

- “把第 3 页改成结论先行”
- “保留数据，把表达改得更像咨询公司”
- “把这页拆成两页”
- “给所有图表页加一句洞察”
- “删除重复观点，整体更紧凑”

### 4.2 目标

新增一个结构化 `DeckPatch` 协议，让 AI 输出“可验证、可预览、可撤销”的修改操作。ChatPanel 不直接相信自然语言结果，而是：

1. 将用户意图、当前 Deck 摘要、选中页上下文发给 AI。
2. AI 返回 `DeckPatch[]` JSON。
3. 本地校验 patch 是否安全、是否能应用。
4. UI 展示修改摘要，让用户确认。
5. 应用 patch，并进入 undo 历史。

### 4.3 建议数据模型

```ts
export type DeckPatch =
  | { op: "set_deck_title"; title: string }
  | { op: "insert_slide"; index: number; slide: SlideDraft }
  | { op: "delete_slide"; slideId: string }
  | { op: "move_slide"; slideId: string; toIndex: number }
  | { op: "update_slide"; slideId: string; patch: SlidePatch }
  | { op: "replace_slide"; slideId: string; slide: SlideDraft }
  | { op: "split_slide"; slideId: string; slides: SlideDraft[] }
  | { op: "merge_slides"; slideIds: string[]; slide: SlideDraft };

export interface SlideDraft {
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  body?: string;
  bullets?: Omit<BulletNode, "id">[];
  items?: Omit<SlideContentItem, "id">[];
  chart?: ChartSpec;
  image?: ImageSpec;
  notes?: string;
}

export type SlidePatch = Partial<Omit<Slide, "id">>;
```

### 4.3.1 Patch 执行结果

`applyDeckPatches` 不应只返回 Deck，还应返回执行报告，便于 UI 展示和测试。

```ts
export interface ApplyDeckPatchesResult {
  deck: Deck;
  applied: AppliedPatchSummary[];
  warnings: PatchWarning[];
}

export interface AppliedPatchSummary {
  op: DeckPatch["op"];
  slideId?: string;
  title: string;
  description: string;
}

export interface PatchWarning {
  code:
    | "slide_not_found"
    | "index_out_of_range"
    | "layout_content_mismatch"
    | "destructive_operation"
    | "empty_patch";
  message: string;
  patchIndex: number;
}
```

实现要求：

- patch 应原子应用：任意 patch 校验失败时，默认不修改原 deck。
- 可额外提供 `dryRunDeckPatches(deck, patches)` 只返回 summary 和 warnings。
- 所有新建 slide、bullet、item 必须在本地补 id，AI 不负责生成 id。
- `insert_slide.index` 小于 0 时按 0 处理，大于 slides.length 时追加到末尾，但要给 warning。
- `delete_slide`、`replace_slide`、`merge_slides` 标记为 destructive，UI 必须确认。

### 4.4 建议新增文件

```text
src/services/deck-patch/
  types.ts
  schema.ts
  apply.ts
  summarize.ts
  ai.ts
  prompts.ts
```

职责：

- `types.ts`：定义 patch 类型。
- `schema.ts`：zod 校验 AI 返回。
- `apply.ts`：纯函数 `applyDeckPatches(deck, patches)`。
- `summarize.ts`：将 patch 转成用户可读摘要。
- `ai.ts`：调用 LLM，根据用户意图生成 patches。
- `prompts.ts`：集中维护 Deck 编辑提示词。

### 4.4.1 AI 输入输出契约

`generateDeckPatches` 建议签名：

```ts
export async function generateDeckPatches(params: {
  deck: Deck;
  userRequest: string;
  selectedSlideId?: string;
  conversationContext?: string;
  signal?: AbortSignal;
}): Promise<DeckPatch[]>;
```

传给 AI 的 deck 上下文不要直接发送完整大对象。建议先生成摘要：

```ts
export interface DeckContextSummary {
  title: string;
  themeId: string;
  slides: Array<{
    id: string;
    index: number;
    layout: SlideLayout;
    title: string;
    bulletTexts: string[];
    hasChart: boolean;
    hasImage: boolean;
  }>;
}
```

AI 输出必须是：

```json
{
  "patches": []
}
```

禁止让 AI 输出解释性正文和 JSON 混排。如果 provider 不稳定，可以保留代码块提取兜底，但提取后仍必须 zod 校验。

### 4.5 UI 流程

用户在 AI 面板输入修改需求后：

1. 若是明确重新生成请求，仍走现有 `generateOutline`。
2. 若当前已有 deck，优先调用 `generateDeckPatches`。
3. 返回 patch 后，在聊天区显示：
   - 将修改哪些页面。
   - 新增/删除/移动多少页。
   - 是否存在高风险操作，例如删除页面、覆盖整页。
4. 用户点击“应用修改”后才写入 deck。
5. 用户可以点击“取消”丢弃 patch。

### 4.6 验收标准

- 能处理：改标题、改布局、改 bullets、插入页、删除页、移动页。
- AI 返回非法 JSON 时不修改 deck。
- patch 引用不存在的 slideId 时不修改 deck，并给出错误。
- 删除、替换、合并等高风险 patch 必须展示确认。
- 应用 patch 后，现有 undo/redo 可回退。
- 单元测试覆盖每种 patch 的 apply 逻辑。
- patch apply 测试必须验证“失败不修改原 deck”。
- ChatPanel 应保留原本的简单本地 intent-parser 作为无 key 或 AI 失败时的兜底，但优先走 Deck Patch。

## 5. P0：统一长任务系统

### 5.1 问题

当前生成、导入、配图、导出分别维护 `loading`、`importing`、`exporting` 等状态。随着功能增长，会出现：

- 任务无法取消。
- 多任务并发状态混乱。
- 错误信息不可追踪。
- 失败后重试逻辑重复。
- 用户不知道长文档导入或批量生成进行到哪一步。

### 5.2 目标

新增统一 `jobStore` 管理所有长任务。所有异步业务操作都通过 job 包装：

- AI 大纲生成
- 单页内容生成
- 批量内容生成
- 文档导入
- URL 解析
- AI 配图
- PPTX 导出
- 未来的导出质量检查

### 5.3 建议数据模型

```ts
export type JobType =
  | "outline.generate"
  | "content.generate"
  | "content.generate_batch"
  | "document.import"
  | "image.generate"
  | "pptx.export"
  | "deck.patch";

export type JobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface Job {
  id: string;
  type: JobType;
  title: string;
  status: JobStatus;
  progress?: number;
  message?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  canCancel: boolean;
}
```

### 5.3.1 Zustand Store 接口

建议新增：

```ts
interface JobStore {
  jobs: Job[];
  activeJobIds: string[];
  startJob: (input: StartJobInput) => RunningJob;
  updateJob: (id: string, patch: Partial<Job>) => void;
  succeedJob: (id: string, message?: string) => void;
  failJob: (id: string, error: unknown) => void;
  cancelJob: (id: string) => void;
  clearJob: (id: string) => void;
  clearFinishedJobs: () => void;
}

interface RunningJob {
  id: string;
  signal: AbortSignal;
  update: (patch: Partial<Job>) => void;
  succeed: (message?: string) => void;
  fail: (error: unknown) => void;
  cancel: () => void;
}
```

内部维护 `Map<string, AbortController>` 即可，不要把 controller 写入 Zustand 可序列化状态。

### 5.4 建议 API

```ts
const job = jobStore.start({
  type: "outline.generate",
  title: "生成大纲",
  canCancel: true,
});

try {
  job.update({ progress: 0.4, message: "正在校验大纲结构" });
  await doWork({ signal: job.signal });
  job.succeed("大纲生成完成");
} catch (e) {
  if (job.signal.aborted) job.cancel();
  else job.fail(e);
}
```

建议封装 `runJob`，减少各组件重复 try/catch：

```ts
export async function runJob<T>(
  input: StartJobInput,
  fn: (job: RunningJob) => Promise<T>,
): Promise<T> {
  const job = useJobStore.getState().startJob(input);
  try {
    const result = await fn(job);
    job.succeed();
    return result;
  } catch (error) {
    if (job.signal.aborted) job.cancel();
    else job.fail(error);
    throw error;
  }
}
```

### 5.5 UI 建议

新增全局任务入口：

- 编辑器顶部显示当前任务状态。
- 任务可展开查看详细步骤。
- 可取消任务显示“停止”按钮。
- 失败任务显示“重试”和“复制错误”。

### 5.6 验收标准

- 同一时间可追踪多个 job。
- 支持 AbortController 取消 AI 请求和导入请求。
- 失败错误保留在 job 中，不只显示 toast。
- ChatPanel、ImportDialog、Export、ImageGenerate 至少接入 jobStore。
- 长任务状态在组件卸载后不丢失。
- 取消任务后，不应再把异步返回结果写入 deck。
- job 错误信息需要区分用户取消、网络错误、模型错误、解析错误和未知错误。

## 6. P0：预览/导出共享渲染 IR

### 6.1 问题

当前 HTML 预览和 PPTX 导出共用 theme layout 坐标，但各自实现渲染逻辑。随着后续支持富文本、表格、形状、图片裁切，二者容易分叉。

### 6.2 目标

新增一个中间渲染表示 `RenderIR`。Deck + Theme 先解析成稳定的渲染树，然后：

- HTML Preview Renderer 消费 RenderIR。
- PPTX Export Renderer 消费 RenderIR。

这样布局计算、字号、颜色、文本块、图表区域等规则只有一份。

### 6.3 建议数据模型

```ts
export interface RenderSlide {
  id: string;
  background: string;
  nodes: RenderNode[];
  notes?: string;
}

export type RenderNode =
  | RenderTextNode
  | RenderShapeNode
  | RenderImageNode
  | RenderChartNode
  | RenderGroupNode;

export interface RenderBaseNode {
  id: string;
  rect: Rect;
  zIndex?: number;
}

export interface RenderTextNode extends RenderBaseNode {
  type: "text";
  text: string | RichTextRun[];
  style: TextStyle;
  overflow: "fit" | "clip" | "shrink";
}

export interface RenderShapeNode extends RenderBaseNode {
  type: "shape";
  shape: "rect" | "line" | "circle";
  fill?: string;
  stroke?: string;
  radius?: number;
}

export interface RenderImageNode extends RenderBaseNode {
  type: "image";
  src?: string;
  alt: string;
  fit: "cover" | "contain" | "fill";
}

export interface RenderChartNode extends RenderBaseNode {
  type: "chart";
  chart: ChartSpec;
  style: ChartStyle;
}
```

### 6.3.1 坐标和单位约定

RenderIR 内部统一使用相对坐标：

- `rect.x/y/w/h` 范围为 `0..1`，相对于 16:9 slide。
- 字号使用设计单位 `pt`，由 renderer 转换为 px 或 pptx point。
- 颜色统一使用不带 alpha 的 hex 或显式 rgba 字符串。
- 节点顺序和 `zIndex` 必须稳定，保证 snapshot 测试不抖动。

Renderer 转换规则：

```ts
const PPTX_W = 13.333;
const PPTX_H = 7.5;

function rectToPptx(rect: Rect) {
  return {
    x: rect.x * PPTX_W,
    y: rect.y * PPTX_H,
    w: rect.w * PPTX_W,
    h: rect.h * PPTX_H,
  };
}

function rectToCss(rect: Rect) {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.w * 100}%`,
    height: `${rect.h * 100}%`,
  };
}
```

### 6.3.2 文本溢出策略

RenderIR 构建阶段不做精确排版测量，但必须给出 overflow 策略：

- 标题默认 `shrink`，最低不小于主题字号的 70%。
- 正文默认 `fit`，导出时使用 PptxGenJS `autoFit`。
- 多列内容默认 `clip`，同时生成 quality warning。
- 备注不参与视觉布局。

### 6.4 建议新增文件

```text
src/engine/render-ir/
  types.ts
  build.ts
  text.ts
  layout.ts
  validate.ts
```

职责：

- `build.ts`：`buildRenderSlides(deck, theme)`。
- `layout.ts`：将 `SlideLayout`、`Theme.layouts`、`items` 转成节点 rect。
- `text.ts`：统一文本字号、行高、bullet 样式。
- `validate.ts`：检测节点越界、文本过多、图片缺失。

### 6.5 迁移策略

第一步不要一次性重写所有渲染：

1. 先为现有布局生成 RenderIR。
2. Preview Renderer 先消费 RenderIR。
3. PPTX Exporter 再消费 RenderIR。
4. 保留原有渲染器一段时间，便于对比。

### 6.6 验收标准

- 同一个 deck 在预览和导出中使用同一份 RenderIR。
- 支持现有布局：cover、section、content、two-column、chart、image、closing、cols-2 到 cols-6。
- RenderIR validate 能发现缺 layout、节点越界、图片 URL 缺失。
- 至少有一个 golden deck 测试，确保 RenderIR 节点数量和关键 rect 稳定。
- RenderIR builder 必须是纯函数，不能读写 store、localStorage 或 DOM。
- Preview 和 PPTX 迁移期间，应允许通过 feature flag 临时切回旧 renderer。

## 7. P0：生成质量控制

### 7.1 问题

大纲生成目前主要依赖提示词和 zod 校验。即使 JSON 合法，也可能存在：

- 页面逻辑重复。
- 缺少结论页。
- 页数不符合期望。
- 标题空泛。
- bullets 太多导致页面拥挤。
- 图表页没有数据。

### 7.2 目标

在生成前增加参数控制，在生成后增加质量检查。

### 7.3 生成前参数

建议在 Home 或 ChatPanel 中逐步支持：

```ts
export interface GenerationOptions {
  topic: string;
  audience?: string;
  scenario?: "business_review" | "pitch" | "training" | "market_analysis" | "proposal" | "custom";
  pageCount?: number;
  tone?: "formal" | "consulting" | "concise" | "storytelling";
  density?: "low" | "medium" | "high";
  includeCharts?: boolean;
  includeImages?: boolean;
  language?: "zh-CN" | "en-US";
}
```

### 7.4 生成后质量检查

新增 `services/quality/deck-quality.ts`：

```ts
export interface DeckQualityReport {
  score: number;
  issues: DeckQualityIssue[];
  suggestions: string[];
}

export interface DeckQualityIssue {
  severity: "error" | "warning" | "info";
  slideId?: string;
  code:
    | "missing_cover"
    | "missing_closing"
    | "duplicate_title"
    | "too_many_bullets"
    | "empty_chart"
    | "layout_content_mismatch"
    | "title_too_generic"
    | "page_count_mismatch";
  message: string;
}
```

### 7.4.1 默认质量规则

第一版建议只做确定性规则，不调用 LLM：

| 规则 | 阈值 |
|---|---|
| `missing_cover` | 第一页不是 `cover` 或标题为空 |
| `missing_closing` | 最后一页不是 `closing`，仅 warning |
| `duplicate_title` | 标题 trim 后完全相同 |
| `too_many_bullets` | 单页一级 bullets 超过 7 条 |
| `empty_chart` | layout 为 `chart` 但无 chart 或 data 为空 |
| `layout_content_mismatch` | `image`/`two-column` 布局无 visual 内容 |
| `title_too_generic` | 标题命中“概述/介绍/总结/分析”等泛词且无副标题 |
| `page_count_mismatch` | 实际页数与期望页数偏差超过 2 页 |

评分建议：

```ts
score = 100
score -= errorCount * 15
score -= warningCount * 6
score -= infoCount * 2
score = Math.max(0, Math.min(100, score))
```

### 7.4.2 自动修复边界

第一版自动修复只做低风险操作：

- 给空标题生成占位标题。
- 删除空 bullet。
- 将无 chart 数据的 chart layout 改成 content。
- 为缺失 closing 的 deck 追加一页 closing。

不要自动删除用户已有页面；删除类修复必须走 Deck Patch 确认。

### 7.5 UI 建议

- 大纲生成完成后显示“质量检查”摘要。
- 左侧大纲中对有问题的页显示轻量标记。
- 用户可点击“自动修复”触发 Deck Patch。

### 7.6 验收标准

- 能检查空标题、重复标题、过多 bullets、图表无数据、布局与内容不匹配。
- 质量检查是纯函数，不依赖 LLM。
- AI 生成完成后自动跑一次质量检查。
- 报告不阻塞用户继续编辑。
- 质量报告应能基于 `GenerationOptions.pageCount` 检查页数偏差。
- 自动修复必须通过 Deck Patch 或 deck store action，不能直接修改对象引用。

## 8. P1：文档导入增强

### 8.1 问题

当前导入器主要完成文本抽取和基础切段。对于真实业务文档，还需要：

- 识别章节层级。
- 提取关键结论和数字。
- 保留来源引用。
- 长文档分块摘要。
- 根据文档结构生成 PPT，而不是简单把全文塞给 LLM。

### 8.2 目标

将导入流程升级为：

```text
原始文件/URL
  -> 文本抽取
  -> 结构化章节
  -> 分块与摘要
  -> 关键事实/数字/引用提取
  -> 生成 Deck Outline
  -> 保留 sourceRefs
```

### 8.3 建议数据模型

```ts
export interface DocumentSource {
  id: string;
  type: "docx" | "markdown" | "url" | "text";
  title: string;
  ref: string;
  importedAt: number;
}

export interface DocumentSection {
  id: string;
  heading: string;
  level: number;
  content: string;
  order: number;
}

export interface DocumentChunk {
  id: string;
  sectionId: string;
  text: string;
  tokenEstimate: number;
  summary?: string;
  keyFacts?: KeyFact[];
}

export interface KeyFact {
  id: string;
  text: string;
  value?: number;
  unit?: string;
  sourceChunkId: string;
}

export interface SlideSourceRef {
  sourceId: string;
  sectionId?: string;
  chunkId?: string;
  quote?: string;
}
```

建议给 `Slide` 增加：

```ts
sourceRefs?: SlideSourceRef[];
```

### 8.3.1 Import Pipeline 接口

建议新增统一管线：

```ts
export async function parseDocument(input: ImportInput): Promise<ParsedDocument>;

export async function prepareDocumentForOutline(
  doc: ParsedDocument,
  options: DocumentPrepareOptions,
): Promise<DocumentOutlineContext>;

export async function generateOutlineFromDocument(
  context: DocumentOutlineContext,
  options: GenerationOptions,
): Promise<Slide[]>;
```

```ts
export interface ParsedDocument {
  source: DocumentSource;
  sections: DocumentSection[];
  rawText: string;
  warnings: string[];
}

export interface DocumentOutlineContext {
  source: DocumentSource;
  selectedSectionIds: string[];
  chunks: DocumentChunk[];
  summary: string;
  keyFacts: KeyFact[];
}
```

`parseDocument` 只负责解析，不调用 LLM。`prepareDocumentForOutline` 可以调用 LLM 做摘要，但必须接入 jobStore。

### 8.4 长文档策略

当文档超过阈值时，不直接传全文给 `generateOutline`：

1. 按章节和 token 预算切块。
2. 对每个 chunk 做局部摘要。
3. 汇总摘要生成 deck outline。
4. 对每页保留相关 chunk 引用。

建议阈值：

- 低于 8,000 字：直接生成。
- 8,000 到 30,000 字：chunk 摘要后生成。
- 高于 30,000 字：先生成文档目录和摘要，让用户选择重点章节。

### 8.5 UI 建议

导入弹窗增加解析结果预览：

- 文档标题。
- 章节列表。
- 字数/估算 token。
- 推荐页数。
- 可选择“生成完整汇报”或“只基于选中章节生成”。

### 8.6 验收标准

- docx、markdown、url 都输出统一 `DocumentSource + sections + chunks`。
- 长文档不会一次性把全文塞给 LLM。
- 生成的 slide 可以追溯 sourceRefs。
- 导入失败时保留解析错误和重试入口。
- 用户取消导入后，不应替换当前 deck slides。
- 解析警告需要展示，例如“部分图片/表格未被解析”。

## 9. P1：页面属性检查器

### 9.1 问题

当前右侧主要是 AI 聊天。用户能编辑大纲，但缺少对单页内容、图表、图片、备注、布局的精细控制。

### 9.2 目标

右侧面板从单一 ChatPanel 升级为多 tab：

```text
AI | 页面 | 图表 | 图片 | 备注
```

或者：

```text
AI | 属性 | 素材 | 检查
```

### 9.3 页面属性能力

基础字段：

- 标题
- 副标题
- 布局
- 正文
- bullets
- items
- notes

图表字段：

- chart type
- chart title
- data rows
- label/value 编辑

图片字段：

- 图片 URL
- alt
- position
- 重新生成 AI 配图
- 删除图片

### 9.4 建议文件

```text
src/components/inspector/
  inspector-panel.tsx
  slide-tab.tsx
  chart-tab.tsx
  image-tab.tsx
  notes-tab.tsx
```

### 9.4.1 状态接入建议

当前 `selectedIndex` 在 `Editor.tsx` 本地维护。属性检查器上线后，建议抽成轻量 store 或继续由 Editor 作为 props 下发，二选一即可：

方案 A：保持简单 props。

```tsx
<InspectorPanel
  deck={deck}
  selectedIndex={selectedIndex}
  onSelectIndex={setSelectedIndex}
/>
```

方案 B：新增 `editor-ui` store，管理选中页、右侧 tab、面板开关。

不要把选中页写入 Deck JSON。

### 9.4.2 编辑提交策略

- 文本输入使用本地 draft state，`onBlur` 或 300ms debounce 后写入 deck。
- select、checkbox、增删行可以立即写入 deck。
- 图表数据编辑应提供“新增行/删除行”，空 label 允许但导出前 quality warning。
- 删除图片或 chart 前需要轻量确认，避免误删。

### 9.5 验收标准

- 选中页变化时，属性面板同步展示当前页。
- 修改字段后预览立即更新，并自动保存。
- 图表数据可以增删改。
- notes 可以导出到 PPTX speaker notes。
- 属性编辑进入 undo/redo 历史。
- 快速连续输入不应生成过多 history 记录；建议按一次字段编辑合并为一次历史。

## 10. P1：Deck Schema 迁移与校验

### 10.1 问题

当前 Deck 有 `version` 字段，但加载时只补 version，不做严格校验和迁移。后续增加 `sourceRefs`、RenderIR 相关字段、模板元数据后，历史项目可能出现兼容问题。

### 10.2 目标

新增 schema 校验和迁移机制：

```text
load raw json
  -> parse unknown
  -> migrate to latest Deck
  -> zod validate
  -> repair minor issues
  -> return Deck
```

### 10.3 建议文件

```text
src/services/storage/
  deck-schema.ts
  deck-migrations.ts
  deck-repair.ts
```

### 10.3.1 Schema 版本策略

建议将 Deck 版本常量集中到 schema 文件：

```ts
export const CURRENT_DECK_VERSION = 2;
```

迁移函数按版本递增：

```ts
type DeckMigration = (input: unknown) => unknown;

const migrations: Record<number, DeckMigration> = {
  1: migrateV1ToV2,
};
```

加载流程：

```ts
export function parseStoredDeck(raw: string): DeckParseResult {
  const parsed = JSON.parse(raw) as unknown;
  const migrated = migrateToCurrentDeck(parsed);
  const repaired = repairDeck(migrated);
  return deckSchema.safeParse(repaired);
}
```

迁移只负责版本结构变化，repair 负责轻微数据修复，两者不要混在一起。

### 10.4 建议能力

- 对缺失 `id` 的 slide 补 id。
- 对未知 layout 回退到 `content`。
- 对缺失 themeId 回退默认主题。
- 对坏 chart 数据移除 chart 并记录 warning。
- 对旧版本执行明确迁移函数。

### 10.5 验收标准

- `loadDeck` 不直接 `JSON.parse as Deck`。
- 每个 schema 版本有迁移测试。
- 坏项目文件不导致应用崩溃。
- 修复后的 deck 会在下次保存时写回最新版本。
- migration 测试必须包含“未知未来版本”场景；遇到未来版本应拒绝写入并提示用户升级应用。

## 11. P1：安全密钥存储

### 11.1 问题

当前 API Key 随 settings JSON 一起保存。桌面应用更推荐将敏感信息放到系统安全存储。

### 11.2 目标

将 API Key 从普通 settings 中拆出：

- settings.json 保存 provider、baseUrl、model 等非敏感配置。
- API Key 保存到系统 keychain 或 Tauri 安全插件。
- 读取 settings 时再合并。

### 11.3 迁移策略

1. 启动时检测旧 settings 中是否有 apiKey。
2. 若存在，写入安全存储。
3. 清空 settings.json 中的 apiKey。
4. 给用户提示“已迁移密钥存储”。

### 11.3.1 实现边界

安全密钥存储可以独立成 service，先定义接口再选择具体 Tauri 插件或系统 keychain 实现：

```ts
export interface SecretStore {
  getSecret(key: string): Promise<string | null>;
  setSecret(key: string, value: string): Promise<void>;
  deleteSecret(key: string): Promise<void>;
}
```

业务层只依赖 `SecretStore`，不要在 Settings 页面直接调用 Tauri API。

建议 secret key 命名：

```text
ppt-agent/provider/openai/api-key
ppt-agent/provider/anthropic/api-key
ppt-agent/provider/qwen/api-key
ppt-agent/provider/zhipu/api-key
ppt-agent/provider/custom/api-key
ppt-agent/image/api-key
```

如果安全存储不可用，允许降级到当前 settings.json，但必须明确提示“密钥将以本地明文保存”。

### 11.4 验收标准

- 新保存的 settings.json 不包含明文 API Key。
- 老版本 settings 可以自动迁移。
- 安全存储失败时给出明确错误。
- 用户可以删除或更新 key。
- settings 导出或日志中不得包含 API Key。

## 12. P2：模板系统产品化

### 12.1 目标

将模板从“预置 slides”升级为“场景化生成策略”。

模板应该包含：

- 场景名称。
- 目标受众。
- 推荐页数。
- 默认主题。
- slides skeleton。
- 生成提示词补充。
- 推荐图表策略。
- 推荐质量检查规则。

### 12.2 建议数据模型

```ts
export interface TemplatePack {
  id: string;
  name: string;
  description: string;
  scenario: string;
  suggestedTheme: string;
  defaultOptions: GenerationOptions;
  slides: TemplateSlide[];
  promptHints?: string[];
  qualityRules?: string[];
}
```

### 12.2.1 模板与 AI 生成关系

模板不应只是创建静态 Deck，还应能约束 AI 生成：

```ts
export interface TemplateGenerationContext {
  templateId: string;
  defaultOptions: GenerationOptions;
  slidePlan: Array<{
    role: "cover" | "agenda" | "insight" | "analysis" | "chart" | "summary" | "closing";
    suggestedLayout: SlideLayout;
    instruction: string;
  }>;
  promptHints: string[];
}
```

当用户选择模板后：

1. 创建初始 deck skeleton。
2. 将 `TemplateGenerationContext` 传给 outline prompt。
3. 生成结果必须尽量保持模板页角色顺序。
4. 生成后跑质量检查。

### 12.3 推荐内置模板

- 季度业务复盘
- 产品发布会
- 融资 BP
- 市场分析报告
- 竞品分析
- 培训课件
- 项目立项汇报
- 年度规划

### 12.4 验收标准

- 模板可以直接创建 deck。
- 模板可以作为 AI 生成约束。
- 模板选择页展示场景、页数、适用对象。
- 模板输出仍通过质量检查。
- 模板文件应保持纯数据，避免在模板里写业务逻辑。

## 13. 测试与质量门禁

### 13.1 建议测试分层

单元测试：

- Deck Patch apply。
- Deck schema migrate。
- RenderIR build。
- Quality check。
- Importer section/chunk。

集成测试：

- sample deck -> export pptx 不报错。
- sample docx/markdown -> structured document。
- AI mock response -> generate outline -> deck quality report。

回归测试：

- golden deck 的 RenderIR 快照。
- 典型模板的 Deck JSON 快照。

### 13.2 建议 fixtures

```text
src/__fixtures__/
  decks/
    simple-business-review.json
    chart-heavy.json
    long-bullets.json
  documents/
    market-analysis.md
    quarterly-review.md
  llm/
    outline-valid.json
    outline-invalid.json
    deck-patch-valid.json
```

### 13.3 验收标准

- 新增核心服务必须有单元测试。
- Exporter 至少有 smoke test。
- Deck schema migration 必须覆盖旧版本样本。
- PR 合并前运行 `pnpm typecheck` 和 `pnpm test`。

### 13.4 建议测试命名

测试文件与被测模块靠近或统一放在 `src/__tests__` 均可，但命名要稳定：

```text
deck-patch.apply.test.ts
jobs.store.test.ts
render-ir.build.test.ts
quality.deck.test.ts
importer.pipeline.test.ts
storage.migration.test.ts
```

测试优先覆盖纯函数，UI 测试可后置。

### 13.5 Mock 原则

- LLM 调用必须 mock，不在测试中访问真实网络。
- 文件导入测试使用 fixture，不依赖本机真实文件路径。
- PPTX export smoke test 只验证不抛错和输出非空，不做复杂视觉断言。
- RenderIR snapshot 只快照关键字段，避免因为 id 或顺序无关字段导致测试脆弱。

## 14. 推荐开发顺序

### 第一阶段：可靠可控的 MVP

1. 新增 `services/jobs` 和 `jobStore`。
2. 将大纲生成、导入、导出、AI 配图接入 jobStore。
3. 新增 Deck Patch 类型、schema、apply、summarize。
4. ChatPanel 支持 AI 生成 patch 和用户确认应用。
5. 新增基础 DeckQualityReport。

第一阶段完成后，用户应该能稳定完成：

```text
生成大纲 -> AI 修改局部 -> 质量检查 -> 导出 PPT
```

### 第二阶段：资料转 PPT 和专业编辑

1. 新增 DocumentSource、sections、chunks。
2. 导入器统一输出结构化文档。
3. 长文档走分块摘要。
4. Slide 支持 sourceRefs。
5. 新增 InspectorPanel。
6. 新增 Deck schema migration。
7. 迁移 API Key 到安全存储。

第二阶段完成后，用户应该能稳定完成：

```text
导入长文档 -> 选择章节 -> 生成 PPT -> 查看来源 -> 精细调整页面
```

### 第三阶段：场景化生产力

1. 模板升级为 TemplatePack。
2. 模板绑定 GenerationOptions 和 promptHints。
3. 新增更多专业模板。
4. 引入 RenderIR，并逐步迁移 Preview 和 PPTX Export。
5. 增加 golden deck 回归测试。

第三阶段完成后，产品会从“AI PPT 工具”更接近“本地优先的 PPT 生产系统”。

## 15. 给后续大模型开发的执行原则

后续让大模型开发时，建议每次只给一个模块，并要求它遵守：

- 不一次性重构全项目。
- 优先新增纯函数服务，再接 UI。
- 每个新增核心服务必须配测试。
- 修改 Deck 数据结构时必须同步 schema migration。
- 涉及 AI 输出时必须先做 zod schema 校验。
- 涉及长任务时必须接入 jobStore。
- 涉及导出或预览时优先考虑 RenderIR 兼容。
- 不删除现有功能，除非有明确迁移路径。

推荐任务拆法：

```text
任务 1：实现 DeckPatch types/schema/apply/summarize，并加单元测试。
任务 2：将 ChatPanel 的本地 intent-parser 升级为 AI DeckPatch 确认流。
任务 3：实现 jobStore，并接入 outline generate 和 import。
任务 4：实现 DeckQualityReport，并在大纲生成后展示。
任务 5：实现 RenderIR build，不迁移 UI，只加测试。
任务 6：让 PreviewRenderer 消费 RenderIR。
任务 7：让 PPTX Exporter 消费 RenderIR。
任务 8：实现结构化文档导入和 sourceRefs。
任务 9：实现 InspectorPanel。
任务 10：实现 Deck schema migration。
```

> 任务 5–7 已被 X1 取代（SVG 为设计真相，RenderIR 降级为回退渲染），**不要执行**；
> 任务 1–4、8–10 均已完成。

## 16. 后续方向（2026-10 补充）

按「收益 / 成本 / 风险」排序，供后续排期参考：

| 方向 | 内容 | 备注 |
|---|---|---|
| 模板产品化收尾 | TemplatePack 级绑定：默认 `GenerationOptions`、`promptHints`、推荐图表策略；模板选择页展示场景/页数/适用对象 | 路线图 §12 的剩余部分，是当前唯一的主线 |
| 端侧质量继续打磨 | 实跑已暴露：端侧模型倾向给每个正文页配 `chartType`，导致「无图表连续正文页」稀少 → 跨页版式轮换难以触发 | 见 `scripts/local-e2e/` 报告；可选解法是提示词侧约束图表使用，或给图表页也下发非图表部分骨架 |
| 母版与版式原生化 | 导出具 `p:sldMaster` / `p:sldLayout`（当前仅 `PPT_AGENT_MASTER` 部分字段） | 对标 PPT Master v4 |
| 富媒体扩展 | 旁白音频 / 视频导出、LaTeX 公式渲染、超链接创作 | 对标 PPT Master；工程量大，按需 |
| 跨渲染器保真 | 图表默认 SVG vs PowerPoint 原生图表的路线取舍 | 当前选「可编辑优先」（原生图表默认开启），与 PPT Master 相反，是明确的产品决策 |
