# PPT Agent 架构与质量审查发现（2026-08）

本文档记录 2026-08 架构审查中发现的问题，按优先级排列，并跟踪修复状态。
定位：从"架构合理"走向"稳定生成高质量 PPT"必须处理的工程债清单。

## 现状基线

- 全部 265 个测试通过、`tsc --noEmit` 干净。
- 架构决策方向正确：X1「SVG 设计真相 + 原生 PPTX 翻译」。
- 距离目标的主要缺口在：**鲁棒性、导出保真度、内容可信度**。

## 审查结论摘要

| 维度 | 现状 | 差距 |
|---|---|---|
| 排版视觉 | 预览高、导出是底线 | 渐变/光影风格导出明显降级 |
| 内容质量 | prompt+few-shot 有效，但无必现性校验 | 内容可信度无法保证 |
| 稳定性 | cancel/超时/失败隔离三处短板 | 慢模型或长 deck 易出问题 |
| 可编辑性 | 原生文字/形状/图表 | shape 大量降级 rect、文本单行 |
| 安全 | API Key 明文存储 | 未达"隐私安全"承诺 |

---

## P0：数据正确性与安全（必须最先修）

### P0-1 布局（layout）枚举四处重复定义，已产生数据丢失 bug

**问题**：`SlideLayout` 在 `types/deck.ts:3-20`、`services/storage/deck-schema.ts:77-93`、
`services/outline.ts`、`services/deck-patch/schema.ts:36-49`、`services/storage/deck-repair.ts:61-74`
各手写一份，且定义不一致：

- `deck-repair.ts` 的 `validLayouts` 缺少 `metrics/quote/timeline`，命中即回退 content 且丢弃字段
  → **存量 deck 数据被静默破坏**。
- `deck-patch/schema.ts` 缺少 `metrics/quote/timeline`，AI 无法通过 patch 创建这类布局。
- 每加新布局必然漏改某处。

**方案**：抽取 `LAYOUTS` 单一事实源（`src/types/layouts.ts`），zod schema 与 repair 白名单都由它派生；
补齐 repair 与 patch schema 缺失布局；补数据丢失回归测试。

**状态**：⬜ 待修

### P0-2 `SemanticRole.comparison/process` 无对应 layout，靠类型断言硬塞

**问题**：`src/types/page-plan.ts` 的 `SemanticRole` 含 `comparison/process`，而 `SlideLayout` 不含，
`src/engine/svg/pipeline.ts:57` 用 `pages[i].role as Slide["layout"]` 硬转写回 slide，产生运行时非法枚举值；
渲染/质量/导出层对非法值无法处理。

**方案**：在 pipeline 中加入 role→layout 显式映射表（`comparison→two-column`、`process→timeline/content` 等），
非法 role 降级 `content`；写回前经 schema 保证合法值。

**测试**：pipeline 单测断言生成的 slide 一律为合法 layout 且不出现非法枚举值。

### P0-3 API Key 明文存储（安全红线）

**问题**：`src/store/settings.ts` 把含 `apiKey` 的整个 `settings.json` 以 JSON.stringify 明文落盘；
`FUNCTIONAL_ARCHITECTURE_ROADMAP.md` 的 P1 项「安全密钥存储」未实施。

**方案**：引入 `SecretStore` 接口；Tauri 环境走系统 keychain（或平台安全存储），Web 降级 localStorage
但必须显式提示。settings.json 与 apiKey 拆分。

---

## P0（续）：生成鲁棒性

### P0-4 AbortSignal 未贯穿逐页 SVG 生成

**问题**：`src/engine/svg/pipeline.ts:45` 将 signal 只传给 `generatePagePlan`，未传给 `generateDeckSvgs`；
`executor.ts` 的 `generateDeckSvgs` 签名无 `signal` 参数，用户取消 job 后 / D 请求仍发出，白费 token。

**方案**：为 `generateDeckSvgs` 增加 per-page AbortSignal 透传，逐页检查 `signal.aborted` 后抛 AbortError。

### P0-5 文本溢出检测过弱（中文低估、缺下越界、多行、transform）

**问题**：`src/engine/svg/quality/checker.ts:103` 用 `content.length * fontSize * 0.6` 估宽，中文（≈1.0）严重低估；
只查 `y<0` 上越界，无 `y+行高>720` 下越界；多行文本高度未建模；`transform` 偏移不参与检测。

**方案**：按字符类型区分估宽（CJK=1.0、ASCII=0.55），文本局捕获 y/x 求行数与下边界；考虑 top-level `transform=translate` 对 bbox 的影响。

**测试**：中文长句 IPv6、多行 text、translate 偏移三组。

### P0-6 内容必现性无校验（最易被忽视，最易出错的疏漏）

**问题**：质量闸门只查几何越界，不校验目标标题/要点/数据事实是否真的出现在 SVG文本中，出现LLM跳过/改写原文内容。

**方案**：在 `checkSvg` 中新增 `ensureContent` 校验：将 plan 的 `title`/`bullets`/`chartData` 视为硬性内容。
缺则 issue error → 触发重画（已有机制）。

### P0-7 单页失败即中断全程

**位置**：`executor.ts:94-100` 两次重画失败直接 throw → 整份 deck 生成中断，无“保留旧 SVG 占位”的降级策略。

**修复**：`buildDeckSvgs` 逐页捕获错误：若某页失败，保留原 slide 的 `svg`（若有）并给 warning，继续其他页；全部失败才抛错。

---

## P1：导出保真度与体验

### P1-1 pptx-translator 忽略 `transform`

**位置**：`src/engine/pptx-translator/elements.ts:116-121` log 分支直接跳；rotate/scale/skew 静默丢弃。

**修复**：为 g/形状读出 `transform`，translate 影响 x/y，rotate 施加近似上界 bbox 扩大的 rect。

### P1-2 path 一律降为 bbox 矩形

**修复**：识别常见路径（circle/ellipse/roundedRect/line），映射到 pptx 原生 shape；无法识别的保留包围盒。

### P1-3 渐变降级取首末平均色

**修复**：对多 stop 渐变进行等分分段近似（2 个或 4 个色块的纵向分段），视觉效果更接近。

### P1-4 缺少预览 vs 导出像素对比的回归验收

**修复**：新增 golden SVG fixture，选下载导出结果并做视觉差分（轻量：元素级覆盖/越界断言），
在 `golden-deck` 中把关进 CI。

### P1-5 jobs/integrations 死代码

**计数**：`services/jobs/integrations.ts` 的 `runOutlineGeneration` 等 3 个封装器无引用；每个组件手写 job 样板 5 份。

**修复**：把样板收敛进 `runJob` 上层，ChatPanel/Inspector/Import/Editor 统一复用，并补 onProgress 接入。

### P1-6 auto-fix 悬空一半

**计数**：`deck-quality.ts` 的 `generateAutoFixes` 输出 4 类 action，但 `applyAutoFixes` 只实现 bullets 截断。

**修复**：补齐 `set_title`/`remove_empty_bullet`/`change_layout`/`append_closing` 的执行器并与 UI 接入。

---

## P2：测试与打磨

### P2-1 关键 UI 路径无测试

- `ChatPanel`（572 行）主题正则分支、patch 确认流、first-page gate 全无测试。
- `Editor`（590 行）导出质量门、Tauri 回退、任务面板状态机无测试。
- `deck store` 仅测得一处 action，undo/redo/history（50 条截断）无测试。
- vitest 无覆盖率门槛。

### P2-2 少量杂项

- `services/recovery.ts:13` `degrade-rulebased` 占位无调用。
- `svgStale` 死字段（类型/schema 声明、无置 true 处）。

---

## 修复顺序

1. P0-1 ~ P0-7（数据正确性 → 鲁棒性 → 安全）
2. P1-1 ~ P1-6（保真度 + 体验）
3. P2-1 ~ P2-2（测试）
4. 收尾：typecheck + 全量测试 + code-review + 提交

每个 P0 完成即运行 `pnpm typecheck` + `pnpm test`，修复期间不允许让测试长时间红线。