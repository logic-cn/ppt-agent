# i18n 国际化与深色模式 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 PPT Agent 落地可响应的中英文 UI 国际化（含语言切换、持久化），并实现完整的深色模式（含手动切换与跟随系统）。

**Architecture:** i18n 采用「类型安全的英文基准字典 + 中文 `Record<Key,string>` + zustand 持久化的 `lang` 状态」；深色模式采用「CSS 变量化语义色 token + Tailwind `darkMode:"class"` + 根元素 `.dark` class 切换」。两者复用现有 `settings.json` 持久化（AppSettings 增加 `lang`/`theme` 字段），不新建持久化体系。

**Tech Stack:** TypeScript + React 18 + Zustand 5 + Tailwind CSS 3.4 + Vitest。

## Global Constraints

- 继续使用 TypeScript + React + Zustand，不引入 i18next/react-intl 等第三方库。
- `AppSettings.version` 维持 `1`（新增可选字段并向后兼容，旧文件缺省即补默认，无需 bump version）。
- 所有用户可见 UI 文案进入字典；**以下内容不翻译**：LLM 提示词（`services/llm/prompts/*`）、`narrative-modes.ts` 的 `titleRule/structureTendency/notesRegister/pageSkeleton`、`examples/` 与 `presets/` 的内容数据、测试文件、代码注释、console 日志。
- 默认语言为 `zh`，默认主题为 `system`。
- 前端代码必须通过 `pnpm format:check`、`pnpm typecheck`、`pnpm test`。
- 新增纯函数必须有单元测试（TDD）。
- 密钥/凭证不参与本次改动。

## 翻译范围边界（重要）

**需翻译（UI 可见，用户可见字符串）**：
- 全部 `pages/*`、`components/**/*.tsx` 的按钮/标签/标题/占位符/提示/空态/错误文案/toast title。
- `NARRATIVE_MODES[*].name` 与 `bestFor`（经 `mode.<id>` / `mode.<id>.bestFor` 字典 key 映射）。
- `VISUAL_STYLES[*].name`（经 `style.<id>` 映射）。
- 预设 palette 的 `name`（经 `palette.<id>` 映射；用户自定义 palette 保持原样不翻译）。

**不翻译**：见 Global Constraints。

---

## 文件结构

- 新建：`src/types/preferences.ts` — `Lang`、`ThemeMode` 类型。
- 新建：`src/locales/en.ts` — 英文基准字典（`as const`），导出 `TranslationKey`。
- 新建：`src/locales/zh.ts` — 中文 `Record<TranslationKey, string>`。
- 新建：`src/services/i18n.ts` — `translate(lang, key, params?)` 纯函数 + `t` 便捷封装。
- 新建：`src/hooks/use-page-t.ts` — `useT()`（订阅 lang 返回绑定当前语言的 `t`）。
- 新建：`src/hooks/use-theme.ts` — 监听 theme 并切换根元素 `.dark` class（含 system 跟随）。
- 修改：`src/types/llm.ts` — `AppSettings` 增加 `lang?`/`theme?`。
- 修改：`src/store/settings.ts` — 增加 `setLang`/`setTheme`，load 补默认。
- 修改：`src/services/storage.ts` — `loadSettings` 兼容补默认值。
- 修改：`tailwind.config.ts` — `darkMode: "class"`，颜色 token 变量化。
- 修改：`src/styles.css` — 定义 `:root` / `.dark` 两套 CSS 变量。
- 修改：`src/main.tsx` — 挂载 `useTheme` 初始化。
- 修改：各 UI 组件 — 文案替换为 `t(...)`，`bg-white` 替换为 `bg-bg-elevated`。

---

## Task 1: 偏好类型与 i18n 字典 + translate 纯函数

**Files:**
- Create: `src/types/preferences.ts`
- Create: `src/locales/en.ts`
- Create: `src/locales/zh.ts`
- Create: `src/services/i18n.ts`
- Test: `src/services/i18n.test.ts`

**Interfaces:**
- Produces: `type Lang = "en" | "zh"`；`type ThemeMode = "light" | "dark" | "system"`；`type TranslationKey`；`function translate(lang: Lang, key: TranslationKey, params?: Record<string, string | number>): string`。

- [x] **Step 1: 写失败测试**（`src/services/i18n.test.ts`）
  - `translate("zh", "common.cancel")` === `"取消"`
  - `translate("en", "common.cancel")` === `"Cancel"`
  - 带插值：`translate("zh", "editor.pageOf", { n: 3 })` 得到含 `3` 的字符串
  - `en` 与 `zh` 的 key 完全一致（通过 `TranslationKey` 编译期保证 + 运行期断言）

- [x] **Step 2: 运行确认失败**（模块不存在）
- [x] **Step 3: 写实现**：`preferences.ts`、`en.ts`（首批 key，见下方 key 集）、`zh.ts`、`i18n.ts`
- [x] **Step 4: 运行通过**
- [x] **Step 5: 提交** `feat: 新增类型安全的 i18n 字典与 translate 纯函数`

**首批 key 集（Task 1 内建，后续 Task 边翻译边追加）：**
`common.cancel/confirm/save/saving/close/retry/copy/loading/loaded/error/warning/success/info`、`app.name`、`editor.pageOf`。

---

## Task 2: AppSettings 扩展 lang/theme + settings store + 持久化兼容

**Files:**
- Modify: `src/types/preferences.ts`（已建）
- Modify: `src/types/llm.ts`（`AppSettings` 加 `lang?`/`theme?`）
- Modify: `src/services/storage.ts`（loadSettings 补默认）
- Modify: `src/store/settings.ts`（`setLang`/`setTheme` + `defaultSettings` 补默认）
- Test: `src/store/settings.test.ts`

**Interfaces:**
- Consumes: `Lang`/`ThemeMode` from Task 1。
- Produces: `useSettingsStore.setState` 的 `setLang(lang: Lang)` / `setTheme(theme: ThemeMode)`；settings 默认 `{ lang: "zh", theme: "system" }`。

- [x] **Step 1: 写失败测试**：`defaultSettings()` 含 `lang==="zh"`、`theme==="system"`；`setLang("en")` 后 `getState().settings.lang==="en"` 且触发持久化（mock `saveSettings`）。
- [x] **Step 2: 运行确认失败**
- [x] **Step 3: 写实现**：llm.ts 加字段、storage 补默认、settings store 加 action。
- [x] **Step 4: 运行通过 + typecheck**
- [x] **Step 5: 提交** `feat: AppSettings 增加语言/主题偏好并持久化`

---

## Task 3: useT hook + useTheme hook + main.tsx 挂载

**Files:**
- Create: `src/hooks/use-page-t.ts`
- Create: `src/hooks/use-theme.ts`
- Modify: `src/main.tsx`
- Test: `src/hooks/use-theme.test.ts`（jsdom，验证 class 切换）

**Interfaces:**
- Consumes: `useSettingsStore`、`translate`。
- Produces: `useT(): (key, params?) => string`；`useTheme(): void`（副作用挂载）。

- [x] **Step 1: 写失败测试**（use-theme）：`theme==="dark"` 时 `document.documentElement.classList` 含 `dark`；`theme==="system"` 且 `matchMedia` 为暗色时含 `dark`。
- [x] **Step 2: 运行确认失败**
- [x] **Step 3: 写实现**：两个 hook + main.tsx 挂载 `useTheme`（在 App 内根部调用）。
- [x] **Step 4: 运行通过 + typecheck**
- [x] **Step 5: 提交** `feat: 新增 useT/useTheme hook 并接入应用根`

---

## Task 4: Settings 语言 + 主题切换 UI

**Files:**
- Modify: `src/pages/Settings.tsx`
- Test: 复用/新增 Settings 渲染断言（可选）

**Interfaces:**
- Consumes: `useT`、`useSettingsStore.setLang/setTheme`、`useSettingsStore.settings.lang/theme`。

- [x] **Step 1:** 在 Settings 顶部新增「通用」区块：语言选择（zh/en）、主题选择（light/dark/system），绑定 store，立即生效并持久化。
- [x] **Step 2:** 替换 Settings 页全部硬编码中文为 `t(...)`，`bg-white` → `bg-bg-elevated`。
- [x] **Step 3: typecheck + prettier + 提交** `feat: Settings 增加语言与主题切换并接入 i18n`

---

## Task 5: 深色模式 token 变量化 + 全局背景

**Files:**
- Modify: `tailwind.config.ts` → `darkMode: "class"`；`colors` 改为 `rgb(var(--...) / <alpha-value>)`。
- Modify: `src/styles.css` → 定义 `:root`（浅）与 `.dark`（深）变量；`body` 背景/文字基础色。

- [x] **Step 1:** 改 tailwind config（bg/border/text/accent/ai/success/warning/danger 全部变量化，保留原浅色值到 `:root`）。
- [x] **Step 2:** styles.css 写入两套变量 + `body { @apply bg-bg-base text-text-primary; }` + 深色滚动条。
- [x] **Step 3: typecheck + 手动 dev 验证深浅切换 + 提交** `feat: 深色模式 token 变量化与全局底色`

---

## Task 6: 全组件 `bg-white` → `bg-bg-elevated` + 内联色清理

**Files（按目录 sweep）:**
- `src/pages/Home.tsx`、`src/pages/Editor.tsx`、`src/pages/Settings.tsx`
- `src/components/**/*.tsx`（chat-panel、import-dialog、confirm-dialog、design/*、inspector/*、outline/*、preset/*、presentation-mode、quality-report、slide-redraw、ui/toast-container、SvgViewer、App.tsx）

- [x] **Step 1:** 全局替换 `bg-white` → `bg-bg-elevated`（组件 className）。
- [x] **Step 2:** `SvgViewer` 内联 `#f5f5f5`/`#fff` 改为跟随 theme（改用 `bg-bg-surface`/`bg-bg-elevated` 或 CSS 变量）。
- [x] **Step 3:** `presentation-mode.tsx` 的深色演示 UI 保持固定（演示模式本就全屏深色），不套 `.dark`。
- [x] **Step 4: typecheck + prettier + 提交** `refactor: 组件背景色统一走语义 token 以支持深色`

---

## Task 7-10: 逐组文案提取（i18n 覆盖）

> 每个 Task 一个文件/目录簇，遵循 TDD「先补字典 key → 替换组件硬编码 → 测试/typecheck → 提交」。

- **Task 7:** `src/pages/Home.tsx` 文案提取。
- **Task 8:** `src/pages/Editor.tsx` 文案提取（含 job 面板、工具栏、侧栏 tab）。
- **Task 9:** `src/components/chat/chat-panel.tsx` + `src/components/import-dialog.tsx` + `confirm-dialog.tsx`。
- **Task 10:** `src/components/design/*`（mode/style/palette 名称映射）+ `inspector/*` + `outline/*` + `preset/*` + `presentation-mode` + `quality-report` + `slide-redraw` + `ui/toast-container` + `App.tsx` 的「加载中…」。

每个 Task 结束：`pnpm typecheck && pnpm format:check && pnpm test` 全绿后提交，`commit message` 标注 `i18n: <scope> 文案提取`。

---

## Task 11: 端到端验收 + README

- [x] **Step 1:** `pnpm build`（tsc + vite）通过。
- [x] **Step 2:** 手动 dev 验证：切换语言/主题即时生效且刷新后保持；深色下各页面文字可读。
- [x] **Step 3:** 更新 `README.md` 增补「语言与深色模式」说明。
- [x] **Step 4: 提交** `docs: README 补充国际化与深色模式说明`

---

## Self-Review 备注

- spec 即本计划（无外部 PRD）；翻译边界已在「Global Constraints / 翻译范围边界」明确，presets/examples/LLM 提示词不纳入，避免范围失控。
- 类型一致性：`Lang`/`ThemeMode` 出自 `src/types/preferences.ts`，全计划唯一来源；`TranslationKey` 出自 `src/locales/en.ts`。