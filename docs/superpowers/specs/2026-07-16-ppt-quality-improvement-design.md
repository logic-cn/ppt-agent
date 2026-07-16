# PPT 质量提升改造设计（参考 dashi-ppt）

日期：2026-07-16
状态：已确认，待实现

## 背景

对比 `dashi-ppt-skill` 项目后，发现 ppt-agent 当前生成的 PPT 质量偏弱的核心原因：

1. **页面形态单一**：`SlideLayout` 仅有 13 个抽象布局（cover/section/content/cols-N/chart/image），所有主题共用同一套几何与装饰，缺乏语义化的专业页面形态（数据指标页、时间线、对比表、金句引述等）。
2. **生成期无文案预算约束**：`outline.ts` 只要求"充实饱满"，LLM 易产出过长内容，导致 `build.ts` 中 `getOverflow` 溢出、排版崩坏。
3. **主题层过薄**：`Theme` 只有色板/字体，缺乏页面级视觉差异化，"成套感"弱。

dashi-ppt 的优势来自「预置精装页面组件库 + 锁模板填文案 + fillPlan 预算约束」，但其重模板库路线对通用 agent 过重，故采用**轻量借鉴**策略。

## 目标

- 让每页内容按语义选用更合适的专业布局，提升设计感与信息层次。
- 在生成阶段约束文案长度/数量，从源头避免排版溢出。
- 让不同主题在装饰层呈现差异化，增强成套感。

## 非目标（YAGNI）

- 不引入 dashi 式的上千个手写页面组件库（维护成本过高）。
- 不改变现有「LLM 生成内容 + 程序化渲染」的整体架构。
- 不改动导出 PPTX 管线。

## 方向 1：语义化页面模板库

### 现状
- `src/types/deck.ts` 的 `SlideLayout` 枚举定义可用布局。
- `src/engine/layout-geometry.ts` 的 `LAYOUT_GEOMETRY` 定义各布局几何（title/body/visual 三框）。
- `src/engine/render-ir/build.ts` 的 `buildRenderSlide` 程序化构建节点（标题/装饰/正文/图表/图片）。
- `src/engine/preview/render-slide-viewer.tsx` 消费 RenderIR 渲染。

### 方案
新增三类最能体现质感的语义化布局（分批，先落这三个）：

| 新布局 | 语义 | 几何与渲染要点 |
|---|---|---|
| `metrics` | 核心数字海报 | 大数字 + 单位 + 一句说明；中央偏上的超大字号数值区，下方说明条 |
| `quote` | 金句/核心论点 | 超大字号引述文本居中，可选出处/署名小字 |
| `timeline` | 时间线/阶段走势 | 横向时间轴节点 + 每节点标题与短描述 |

实现要点：
1. `SlideLayout` 枚举扩展 `metrics` | `quote` | `timeline`。
2. `LAYOUT_GEOMETRY` 为三布局定义专属几何（不止 title/body/visual，可按需扩展字段）。
3. `Slide` 类型补充这些布局所需字段（如 `metrics` 用 `chart`-类或新增 `metric` 字段；`timeline` 用 `items` 承载节点）。
4. `build.ts` 中为三布局写专属 `buildXxxSlide` 节点构建逻辑（含专属装饰）。
5. `render-slide-viewer.tsx` 无需大改——仍消费 RenderIR，新布局自然渲染。
6. `outline.ts` 的 prompt 更新布局说明表，引导 LLM 按语义选用（涉及数据结论→metrics，核心论点→quote，阶段/历程→timeline）。
7. 配套 few-shot / 边界处理：未知布局回退到 `content`。

## 方向 2：生成阶段文案预算约束

### 现状
- `src/services/outline.ts` 调用 LLM JSON mode 产出 Slide[]，schema 在 `slideSchema` 校验。
- 文案溢出靠 `src/engine/render-ir/text.ts` 的 `getOverflow` 事后检测。

### 方案
1. **prompt 注入预算规则**：在 `buildOutlineSystemPrompt` 中按布局追加预算约束：
   - `content`: bullets ≤ 6 条，每条 ≤ 28 字
   - `cols-N`: 每 item bullets ≤ 3 条、每条 ≤ 20 字；N 越大字数越短
   - `cover`/`closing`: 标题 ≤ 16 字、副标题 ≤ 30 字
   - `chart`: data ≤ 8 项
   - `section`: subtitle ≤ 40 字
2. **预算后处理**：在 `outline.ts` 校验通过后，增加 `enforceBudget(slides)` 函数，对超限文本做软截断（bullet 按字数截断、items 超限裁剪），并标记被截断页供 `quality-report` 提示。
3. 预算配置集中定义，便于调参。

## 方向 3：主题下沉页面级装饰差异化

### 现状
- `src/types/theme.ts` 的 `Theme` 仅含 `colors/fonts/fontSize/spacing`。
- `build.ts` 的 `buildTopBar`/`buildSideBar`/`buildSeparator` 对所有主题输出相同装饰。

### 方案
1. 扩展 `Theme` 类型，增加可选 `decor` 字段：`{ accentShape: "bar"|"line"|"dot"|"none", coverStyle: "top-bar"|"side-bar"|"centered", grid?: boolean }`。
2. `build.ts` 的装饰节点函数读取 `theme.decor`，按主题输出差异化装饰（如 dark-tech 主题显示网格背景、swiss-minimal 用细线分隔）。
3. 现有视觉风格（`visual-styles.ts`）映射到默认 `decor`，保证向后兼容（未配置时用现有行为）。

## 执行顺序

方向 2（快赢）→ 方向 1（核心质变，先三布局）→ 方向 3（配套差异化）。

## 验证

- 运行现有 vitest 套件（`pnpm test`）。
- 手动生成一份 deck，确认：新布局正确渲染、文案无溢出、不同主题装饰有差异。
- 前端 prettier 检查（`pnpm prettier`）。
