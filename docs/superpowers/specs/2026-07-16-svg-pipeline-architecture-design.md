# PPT 生成架构重构：SVG 中间层 + 原生 PPTX 翻译（方向 X1）

日期：2026-07-16
状态：已与用户对齐方向，待评审后进入实现规划
参考项目：dashi-ppt（模板编排）、ppt-master（SVG 真相 + 原生翻译，本方案主对齐对象）

## 0. 背景与决策

用户反馈当前 ppt-agent 生成 PPT「视觉丑 / 不像成品」。经对比分析确认根因：
当前渲染层是「几何坐标 + 基础文本/形状」程序化绘制（`build.ts` 产出 `RenderIR`，`render-slide-viewer.tsx` 按坐标绝对定位），本质是信息图骨架，而非设计师精修版面。

用户要求四个硬约束：
1. 生成足够美观、内容质量高
2. 预览与导出样式完全一致
3. 导出的 PPT 文件完全可编辑（不能为纯图片）
4. 参考 dashi-ppt 与 ppt-master 两个高质量项目

### 决策：方向 X1（对齐 ppt-master 范式）

- **核心范式**：引入「SVG 作为页面设计真相中间层」。AI 自由设计每页 SVG（带设计系统约束）→ 预览直接渲染 SVG → 导出时把 SVG 忠实翻译为原生 PPTX（可编辑 DrawingML）。
- **子路线 X1（非 X2）**：SVG 由 **LLM 直接生成**（而非代码程序化生成），最大化设计天花板，对齐 ppt-master 的 Executor 模式。
- **导出翻译器自研**：经核实，ppt-master 的 `svg_to_pptx` 是**自研 Python 代码**（依赖仅 `python-pptx`/`XlsxWriter`，无现成三方 SVG→可编辑PPTX 类库）；前端 JS 生态**没有对标类库**（npm 上的多为栅格化贴图，不可编辑）。本项目是 Tauri 桌面端 + 前端 TS + `pptxgenjs`，**无 Python 运行时**，因此翻译器必须用 **TS 基于 `pptxgenjs` 重写**。

### 为什么 X1 能同时满足四个硬约束

| 约束 | X1 如何满足 |
|---|---|
| 美观 / 内容质量高 | AI 当设计师自由设计，设计天花板高；设计系统契约约束防失控 |
| 预览导出一致 | 共用同一份 SVG 真相，导出是 SVG 的忠实翻译 |
| 导出可编辑 | 翻译器用 `pptxgenjs.addText/addShape/原生图表` 产出原生 DrawingML，非贴图 |
| 参考两项目 | 吸收 dashi 的语义角色化思路 + ppt-master 的 SVG 真相 + 原生翻译 |

## 1. 整体分层架构

```
用户意图 / 文档 / URL
        │
        ▼
┌─────────────────────────────────────────────┐
│ L1 内容理解 & 设计规划 (Strategist)           │
│  - 解析源内容 → 事实/分析                      │
│  - 产出 designSpec + specLock(设计契约 JSON)   │
│  - 产出页面结构规划 pagePlan[]（语义角色清单）  │
└─────────────────────────────────────────────┘
        │  specLock + pagePlan
        ▼
┌─────────────────────────────────────────────┐
│ L2 视觉生成 (Executor, 逐页串行)              │
│  - 逐页读取 specLock（防漂移）                 │
│  - LLM 产出该页 SVG（固定像素 viewBox）        │
│  - 遵守 SVG 兼容契约（shared-standards）       │
└─────────────────────────────────────────────┘
        │  svg_pages[] (每页一个 .svg)
        ▼
┌─────────────────────────────────────────────┐
│ L3 质量闸门 (SVG Quality Gate)  [强制 0-error] │
│  - 越界/溢出/坐标合法性/图表几何校验           │
│  - 失败 → 错误回喂 LLM 重画该页（带重试上限）  │
│  - 无自动修复                                  │
└─────────────────────────────────────────────┘
        │  校验通过的 svg_pages[]
        ▼
   ┌──────────────┬───────────────────────────┐
   │ 预览          │ 导出                       │
   ▼               ▼                           │
 浏览器原生      L4 SVG→PPTX 翻译器(TS)        │
 渲染 SVG        基于 pptxgenjs 产出            │
 (所见即所得)    原生可编辑 PPTX                │
                  文本/形状/图表=原生对象        │
```

## 2. 各层职责与现有代码映射

### L1 内容理解 & 设计规划
- **职责**：源内容归一化、产出设计契约 `specLock`、产出页面结构规划 `pagePlan`。
- **复用现有**：
  - `src/design/visual-styles.ts` + `src/design/palettes.ts` → 升级硬化为 **`specLock` 设计契约**（配色/字体/风格母题）。
  - `src/design/narrative-modes.ts` → 保留，作为内容叙事策略。
  - `src/services/outline.ts` 的 LLM 大纲能力 → 改造为「页面结构规划」（产出语义角色清单，而非几何 layout）。
  - `src/services/llm/few-shot` + `src/examples` → 保留作 few-shot。
- **新建**：`specLock` 数据结构与构建逻辑；`pagePlan` 语义角色定义（对齐 dashi 的 layout-roles：cover/metrics/quote/timeline/comparison/process…）。

### L2 视觉生成（Executor）
- **职责**：逐页读取 specLock，调用 LLM 产出单页 SVG；严格遵守 SVG 兼容契约。
- **关键工程约束（照搬 ppt-master）**：
  - **逐页串行生成，禁止并行 sub-agent、禁止一次批量多页**（防跨页视觉漂移）。
  - **SVG 使用固定像素 viewBox**（如 1280×720），消除坐标歧义。
  - 每页生成前重读 specLock。
- **废弃**：`src/engine/render-ir/build.ts`、`src/engine/layout-geometry.ts`（几何程序化绘制不再使用）。
- **废弃**：`src/engine/preview/render-slide-viewer.tsx` 的几何节点 viewer（改为原生渲染 SVG）。

### L3 质量闸门（SVG Quality Gate）
- **职责**：TS 版 SVG 校验器，强制 0-error。
- **校验项**（对齐 ppt-master `svg_quality_checker`）：
  - 元素坐标越界（off-canvas）
  - 文本/容器溢出（字号 × 字数 × 框尺寸）
  - viewBox 尺寸合规
  - 图表几何合法性（柱高/饼角/坐标轴在范围内）
  - specLock 漂移检查（颜色/字体是否来自契约）
- **失败处理**：错误回喂 LLM 重画该页；带重试上限（建议 ≤ 2 轮）；无自动修复。
- **新建**：`src/engine/svg-quality/` 校验器。

### L4 SVG→PPTX 翻译器（核心新建）
- **职责**：把校验通过的 SVG 逐元素翻译为原生 PPTX（DrawingML），保证可编辑。
- **映射规则**（对齐 ppt-master 的 SVG↔DrawingML 概念对应）：
  - `<rect rx>` → `addShape(roundRect)`（可编辑）
  - `<circle>/<ellipse>` → `addShape(ellipse)`
  - `<path d>` → `addShape(custGeom)` 或自定义几何（可编辑）
  - `<text>`/`<tspan>` → `addText`（原生文本框，可编辑，保留段落/run）
  - `linearGradient/radialGradient` → `gradFill`
  - 图标 → 原生形状或矢量媒体
  - 图表 → 原生 pptxgenjs 图表对象（可编辑）
- **复用现有**：`src/engine/pptx/` 的 `pptxgenjs` 基础、图表导出能力、Tauri 写入逻辑。
- **废弃**：`src/engine/pptx/render-slide.ts`（旧几何 RenderIR→PPTX 映射）。

## 3. 现有代码资产取舍总表

| 现有资产 | X1 命运 | 处理 |
|---|---|---|
| `presets/TEMPLATE_PACKS`（结构骨架） | 改造 | 改为「页面结构规划清单」（语义角色），不再对应几何框 |
| `layout-geometry.ts` | 废弃 | 几何模板在 X1 无意义 |
| `render-ir/build.ts` | 废弃 | 被 L2 SVG 生成替代 |
| `visual-styles.ts` + `palettes.ts` | 升级硬化 | 成为 `specLock` 设计契约 |
| `narrative-modes.ts` | 保留 | 内容策略 |
| `render-slide-viewer.tsx` | 废弃/简化 | 改为原生渲染 SVG |
| `pptx/render-slide.ts` | 废弃 | 被 L4 翻译器替代 |
| `pptx/exporter.ts` + pptxgenjs 基础 | 复用 | L4 翻译器底座 |
| `examples/` + few-shot | 保留 | few-shot 参考 |
| `services/outline.ts` | 改造 | 大纲 → 页面结构规划 |
| dashi 风格图 `/assets/theme-style-grid.png` | 可选复用 | 风格选择 UI 展示 |

**关键结论**：版式几何模板库（layout-geometry/build）死亡；设计系统/风格契约库（visual-styles/palettes）+ 叙事/结构规划不仅存活，且被硬化为质量基石。

## 4. 稳定性机制（X1 成败关键）

AI 自由设计**不能 100% 保证每次完美**，ppt-master 亦自承产出为「design draft」。稳定性来自工程闸门而非模型强度：

1. **specLock 硬化契约**：生成前锁定设计系统，逐页重读防漂移。
2. **逐页串行 + 禁止批量**：单 Agent 串行生成，不可并行吐整 deck。
3. **强制质量闸门**：TS 版校验器 0-error 才能导出；失败回喂 LLM 重画。
4. **像素 viewBox**：固定像素画布降坐标歧义。
5. **无自动修复 + AI 回改**：逼模型修自己的产出。

**产品风险与兜底**：偶发丑页仍可能。需在产品中提供「逐页重画/微调」能力（用户在预览里对单页发起重生成），作为人类兜底，对齐 ppt-master「最后 10% 精修」。

## 5. 分阶段实现路线（建议）

- **Phase 0 设计契约**：定义 `specLock` 结构、像素画布规范、SVG 兼容契约（shared-standards）；硬化现有 visual-styles/palettes。
- **Phase 1 页面结构规划**：改造 `outline.ts` 产出 `pagePlan`（语义角色），替代几何 layout。
- **Phase 2 SVG 生成 + 预览**：L2 Executor 逐页生成 SVG；预览改为原生渲染 SVG（先不做质量闸门，能看见即可）。
- **Phase 3 质量闸门**：TS 版 SVG 校验器 + 失败重画重试。
- **Phase 4 SVG→PPTX 翻译器**：L4 基于 pptxgenjs 的逐元素原生翻译（先支持 rect/text/circle/path/渐变/基础图表）。
- **Phase 5 逐页重画/微调 UI**：用户可对单页发起重生成，作为稳定性兜底。

## 6. 风险与开放问题

- **翻译器工作量最大**：SVG→原生 PPTX 的忠实翻译是 ppt-master 自研核心，TS 重写需覆盖文本/形状/路径/渐变/图表/图标，建议 Phase 4 分批（先矩形/文本/圆，后路径/渐变/图表）。
- **逐页串行速度**：单 Agent 逐页生成 20 页可能慢；需评估并可能引入「结构规划并行、视觉生成串行」的折中。
- **LLM SVG 能力依赖**：依赖模型写出合规 SVG；需 chosen model 的 SVG 训练充分（Claude/GPT 类可接受）。
- **specLock 漂移**：长 deck 需严格逐页重读契约。

## 7. 验证标准

- 预览 SVG 与导出 PPTX 视觉一致（逐元素对照）。
- 导出 PPTX 在 PowerPoint 中每个文本框/形状/图表可点选编辑、可改字。
- SVG 质量闸门能拦截越界/溢出页并触发重画。
- 端到端生成一份 8-10 页 deck，人工评估美观度明显优于当前几何渲染。
