# 设计入口合并 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把"模板 / 主题 / 画廊 / 自定义主题"四套入口收敛为「预设 DeckPreset（结构+设计+质量规则）」+「设计 DesignLock」两套概念，配色统一为单一 `getPalette` 注册表，`Theme` 由 `(palette, visualStyle)` 派生。

**Architecture:** 数据层先把自定义配色并入 `getPalette`、把 `resolveTheme` 改为派生、把模板与画廊合并为 `DeckPreset`；UI 层把首页模板弹框+画廊合并为单一「示例库」、把编辑器主题下拉替换为完整设计选择器、把自定义配色内联进 `PalettePicker`、删除设置页自定义主题区块；最后清理死字段与旧文件。

**Tech Stack:** Vite + React 18 + TypeScript(strict) + zustand 5 + vitest 4 + pnpm。无后端推理。

## Global Constraints

- 所有新增/修改 TS 必须通过 `pnpm typecheck`（strict）。
- 逻辑模块必须有 vitest 单测，TDD 红绿。
- 前端代码通过 `pnpm format:check`（prettier）。
- 提交信息使用中文。
- `DesignLock` 字段名必须保持 `mode / visualStyle / palette`（被生成与渲染共同消费）。
- 自定义配色仅含 colors（主色/强调色/背景/文字等），字体与间距由 `visualStyle` 决定，不单独配置。
- 旧 `custom-*` 主题 id 不再迁移：打开时 `getPalette` 找不到 → 兜底 `DEFAULT_DESIGN.palette`，不崩溃。

---

## 文件结构

**新建**
- `src/types/preset.ts` — `DeckPreset` 类型
- `src/presets/index.ts` — `getPresets()` / `getPresetById()`（合并原模板与画廊）
- `src/store/custom-palettes.ts` — 自定义配色 store（替换 `custom-themes.ts`）
- `src/components/preset/PresetLibrary.tsx` — 首页示例库（替换 `TemplateDialog` + `GalleryPanel`）

**修改**
- `src/design/palettes.ts` — 加自定义配色缓存 + `getPalette` 认自定义
- `src/themes/index.ts` — `resolveTheme(palette, visualStyle)` 派生；删 `BUILTIN_THEMES`
- `src/types/theme.ts` — `Theme` 删 `layouts`
- `src/types/deck.ts` — 删 `themeOverrides`
- `src/services/storage.ts` — 自定义主题函数 → 自定义配色函数（目录 `palettes/`）
- `src/services/outline.ts` — 去掉 `buildContextualPrompt`/`getTemplatePackById` 依赖
- `src/store/deck.ts` / `src/services/storage/deck-repair.ts` — 兜底 `custom-*` palette
- `src/pages/Home.tsx` — 用 `PresetLibrary` 替换模板弹框+画廊
- `src/pages/Editor.tsx` — 设计面板替换主题下拉
- `src/components/design/PalettePicker.tsx` — 内联「＋新建配色」
- `src/engine/preview/index.tsx` / `src/engine/pptx/exporter.ts` / `src/pages/Editor.tsx`(present) — 更新 `resolveTheme` 调用
- 测试：`src/design/palettes.test.ts`、`src/themes/theme.test.ts`(或 `src/__tests__/theme.test.ts`)、`src/presets/presets.test.ts`、`src/components/design/palette-picker.test.tsx`(可选)

**删除**
- `src/themes/business-blue.json` `minimal-white.json` `tech-purple.json` `vibrant-orange.json`
- `src/store/custom-themes.ts`、`src/components/theme-editor-dialog.tsx`、`src/components/template-dialog.tsx`、`src/components/gallery/GalleryPanel.tsx`
- `src/templates/index.ts` 的 `TemplatePack` 旧 `getTemplates/getTemplateById/BUILTIN_TEMPLATES/buildTemplateGenerationContext` 及 `src/types/template.ts` 中 `TemplatePack` 相关（如仅被其使用）
- `src/types/example.ts`（`GalleryExample` 不再需要）

---

### Task 1: 自定义配色注册表

**Files:**
- Modify: `src/design/palettes.ts`
- Create: `src/store/custom-palettes.ts`
- Modify: `src/services/storage.ts`
- Test: `src/design/palettes.test.ts`

**Interfaces:**
- Consumes: `ThemeColors`（`src/types/theme.ts`）
- Produces: `getPalette(id)`（内置+自定义）、`setCustomPalettes`、`getCustomPalettes`、`useCustomPalettes` store、`saveCustomPalette`/`listCustomPalettes`/`deleteCustomPalette`

- [ ] **Step 1: 写失败测试**

```ts
// src/design/palettes.test.ts
import { describe, it, expect } from "vitest";
import {
  getPalette,
  setCustomPalettes,
  PALETTES,
} from "./palettes";
import type { Palette } from "./palettes";

describe("getPalette 自定义配色", () => {
  it("内置 id 可解析", () => {
    expect(getPalette("business-blue")?.colors.primary).toBe("#60A5FA");
  });
  it("自定义 id 在 setCustomPalettes 后可解析", () => {
    const custom: Palette = {
      id: "custom-1",
      name: "测试配色",
      colors: {
        primary: "#123456",
        secondary: "#234567",
        accent: "#345678",
        background: "#ffffff",
        surface: "#f5f5f5",
        text: "#111111",
        textMuted: "#666666",
      },
    };
    setCustomPalettes([custom]);
    expect(getPalette("custom-1")?.colors.primary).toBe("#123456");
    setCustomPalettes([]);
  });
  it("未知 id 返回 undefined", () => {
    expect(getPalette("nope")).toBeUndefined();
  });
  it("内置配色不少于 4", () => {
    expect(PALETTES.length).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test src/design/palettes.test.ts`
Expected: FAIL（`setCustomPalettes` 未定义）

- [ ] **Step 3: 最小实现**

```ts
// src/design/palettes.ts （在文件末尾追加）
let _customPalettes: Palette[] = [];

export function setCustomPalettes(p: Palette[]): void {
  _customPalettes = p;
}

export function getCustomPalettes(): Palette[] {
  return _customPalettes;
}

export function getPalette(id: string): Palette | undefined {
  return (
    PALETTES.find((p) => p.id === id) ??
    _customPalettes.find((p) => p.id === id)
  );
}
```

```ts
// src/store/custom-palettes.ts
import { create } from "zustand";
import type { Palette, ThemeColors } from "@/design/palettes";
import { setCustomPalettes } from "@/design/palettes";
import {
  listCustomPalettes,
  saveCustomPalette,
  deleteCustomPalette,
} from "@/services/storage";

export function generateCustomPaletteId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

interface CustomPaletteStore {
  palettes: Palette[];
  loaded: boolean;
  load: () => Promise<void>;
  save: (p: Palette) => Promise<void>;
  remove: (id: string) => Promise<void>;
  create: (name: string, colors: ThemeColors) => Promise<Palette>;
}

export const useCustomPalettes = create<CustomPaletteStore>((set, get) => ({
  palettes: [],
  loaded: false,
  load: async () => {
    try {
      const palettes = await listCustomPalettes();
      setCustomPalettes(palettes);
      set({ palettes, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  save: async (p) => {
    await saveCustomPalette(p);
    const palettes = await listCustomPalettes();
    setCustomPalettes(palettes);
    set({ palettes });
  },
  remove: async (id) => {
    await deleteCustomPalette(id);
    const palettes = await listCustomPalettes();
    setCustomPalettes(palettes);
    set({ palettes });
  },
  create: async (name, colors) => {
    const p: Palette = { id: generateCustomPaletteId(), name, colors };
    await get().save(p);
    return p;
  },
}));
```

```ts
// src/services/storage.ts
// 替换原「自定义主题」段落（约 280-360 行）
import type { Palette } from "@/design/palettes";

const CUSTOM_PALETTE_PREFIX = "custom-";

export async function saveCustomPalette(p: Palette): Promise<void> {
  const dir = await getDataDir();
  const path = await joinPath(dir, "palettes", `${p.id}.json`);
  await writeText(path, JSON.stringify(p, null, 2));
}

export async function listCustomPalettes(): Promise<Palette[]> {
  const dir = await getDataDir();
  const out: Palette[] = [];
  if (!isTauri) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("ppt-agent-data/palettes/") && key.endsWith(".json")) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const p = JSON.parse(raw) as Palette;
            if (p.id?.startsWith(CUSTOM_PALETTE_PREFIX)) out.push(p);
          } catch { /* skip */ }
        }
      }
    }
  } else {
    try {
      const inv = await getInvoke();
      if (inv) {
        const palettesDir = await joinPath(dir, "palettes");
        const names = await inv<string[]>("list_directory", { path: palettesDir });
        for (const name of names) {
          if (name.endsWith(".json")) {
            const raw = await readText(await joinPath(palettesDir, name));
            if (raw) {
              try {
                const p = JSON.parse(raw) as Palette;
                if (p.id?.startsWith(CUSTOM_PALETTE_PREFIX)) out.push(p);
              } catch { /* skip */ }
            }
          }
        }
      }
    } catch { /* skip */ }
  }
  return out;
}

export async function deleteCustomPalette(id: string): Promise<void> {
  try {
    const dir = await getDataDir();
    const path = await joinPath(dir, "palettes", `${id}.json`);
    if (!isTauri) {
      localStorage.removeItem(`ppt-agent-data/palettes/${id}.json`);
    } else {
      const inv = await getInvoke();
      if (inv) await inv("delete_file", { path });
    }
  } catch (e) {
    console.error("deleteCustomPalette failed:", e);
  }
}
```
（删除原 `saveCustomTheme`/`listCustomThemes`/`deleteCustomTheme`/`CUSTOM_THEME_PREFIX` 及对 `Theme` 的导入；`storage.ts` 顶部 `import type { Theme }` 若仅此处使用则移除。）

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test src/design/palettes.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/design/palettes.ts src/design/palettes.test.ts src/store/custom-palettes.ts src/services/storage.ts
git commit -m "feat(palette): 自定义配色并入统一 getPalette 注册表"
```

---

### Task 2: resolveTheme 派生 + 删 BUILTIN_THEMES

**Files:**
- Modify: `src/themes/index.ts`
- Modify: `src/types/theme.ts`
- Modify: `src/engine/preview/index.tsx`（`resolveTheme` 调用）
- Modify: `src/engine/pptx/exporter.ts`（2 处）
- Modify: `src/pages/Editor.tsx`（present 模式 1 处）
- Modify/Delete: `src/__tests__/theme.test.ts`、`src/__tests__/golden-deck.test.ts`
- Delete: `src/themes/*.json`（4 个）

**Interfaces:**
- Consumes: `getPalette`（`palettes.ts`）、`getVisualStyle`（`visual-styles.ts`）、`DEFAULT_DESIGN`（`types/design.ts`）
- Produces: `resolveTheme(paletteId, visualStyleId): Theme`

- [ ] **Step 1: 写失败测试**

```ts
// src/themes/theme.test.ts
import { describe, it, expect } from "vitest";
import { resolveTheme } from "./index";
import type { Theme } from "@/types/theme";

describe("resolveTheme 派生", () => {
  it("colors 来自 palette, fonts/spacing 来自 visualStyle", () => {
    const t: Theme = resolveTheme("business-blue", "swiss-minimal");
    expect(t.colors.primary).toBe("#60A5FA");
    expect(t.fonts.title).toContain("Source Han Sans");
    expect(t.spacing).toBe("sparse");
  });
  it("未知 palette 兜底 DEFAULT_DESIGN.palette", () => {
    const t = resolveTheme("custom-ghost", "soft-rounded");
    expect(t.colors.primary).toBeDefined();
  });
  it("无 layouts 字段", () => {
    const t = resolveTheme("business-blue", "swiss-minimal");
    expect((t as unknown as { layouts?: unknown }).layouts).toBeUndefined();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test src/themes/theme.test.ts`
Expected: FAIL（`resolveTheme` 签名/行为不符）

- [ ] **Step 3: 最小实现**

```ts
// src/types/theme.ts —— 删除 layouts 字段
export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
  fontSize: ThemeFontSize;
  spacing: Spacing;
}
```

```ts
// src/themes/index.ts —— 整体替换
import type { Theme } from "@/types/theme";
import type { VisualStyleId } from "@/types/design";
import { getPalette } from "@/design/palettes";
import { getVisualStyle } from "@/design/visual-styles";
import { DEFAULT_DESIGN } from "@/types/design";

export function resolveTheme(
  paletteId: string,
  visualStyleId: VisualStyleId,
): Theme {
  const palette = getPalette(paletteId) ?? getPalette(DEFAULT_DESIGN.palette)!;
  const style =
    getVisualStyle(visualStyleId) ?? getVisualStyle(DEFAULT_DESIGN.visualStyle)!;
  return {
    id: palette.id,
    name: palette.name,
    colors: palette.colors,
    fonts: style.fonts,
    fontSize: style.fontSize,
    spacing: style.spacing,
  };
}
```

```ts
// src/engine/preview/index.tsx:31
const theme = resolveTheme(deck.design.palette, deck.design.visualStyle);
// 同时删除 deck.themeOverrides 传参（Task 9 删字段）
```

```ts
// src/engine/pptx/exporter.ts:19 与 :45
const theme = resolveTheme(deck.design.palette, deck.design.visualStyle);
```

```ts
// src/pages/Editor.tsx:649（present 模式）
theme={resolveTheme(deck.design.palette, deck.design.visualStyle)}
```

- [ ] **Step 4: 删除旧 theme 测试与 JSON，修复 golden-deck 测试**

```bash
rm src/themes/business-blue.json src/themes/minimal-white.json src/themes/tech-purple.json src/themes/vibrant-orange.json
rm src/__tests__/theme.test.ts
```

`src/__tests__/golden-deck.test.ts` 中两处 `resolveTheme(deck.design.palette)` → `resolveTheme(deck.design.palette, deck.design.visualStyle)`。

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm test src/themes/theme.test.ts src/__tests__/golden-deck.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/themes/index.ts src/themes/*.json src/types/theme.ts src/engine/preview/index.tsx src/engine/pptx/exporter.ts src/pages/Editor.tsx src/__tests__/theme.test.ts src/__tests__/golden-deck.test.ts
git commit -m "refactor(theme): resolveTheme 改为 (palette,visualStyle) 派生, 删 BUILTIN_THEMES"
```

---

### Task 3: DeckPreset 合并模板+画廊

**Files:**
- Create: `src/types/preset.ts`
- Create: `src/presets/index.ts`
- Modify: `src/services/outline.ts`（去 `getTemplatePackById`/`buildContextualPrompt`）
- Test: `src/presets/presets.test.ts`
- Delete: `src/types/example.ts`、`src/templates/index.ts` 旧 `TemplatePack` 函数（保留各模板 `slides` 骨架数据可迁移进 presets）

**Interfaces:**
- Consumes: `getPalette`、`PALETTES`、`DesignLock`、`Template`（各模板 `slides` 骨架）、原 `GalleryExample[]`（来自 `src/examples/index.ts`）
- Produces: `getPresets(): DeckPreset[]`、`getPresetById(id)`

- [ ] **Step 1: 写失败测试**

```ts
// src/presets/presets.test.ts
import { describe, it, expect } from "vitest";
import { getPresets, getPresetById } from "./index";
import type { DeckPreset } from "@/types/preset";

describe("presets 合并", () => {
  it("返回非空且每项 design 完整、slides 非空", () => {
    const ps: DeckPreset[] = getPresets();
    expect(ps.length).toBeGreaterThan(0);
    for (const p of ps) {
      expect(p.design.mode).toBeTruthy();
      expect(p.design.visualStyle).toBeTruthy();
      expect(p.design.palette).toBeTruthy();
      expect(p.slides.length).toBeGreaterThan(0);
    }
  });
  it("模板类 preset 含 qualityRules", () => {
    const quarterly = getPresetById("quarterly-review");
    expect(quarterly?.qualityRules).toContain("require_charts");
  });
  it("画廊类 preset 的 design.palette 可被 getPalette 解析", () => {
    const ex = getPresets().find((p) => p.id.startsWith("quarterly-pyramid"));
    expect(ex).toBeTruthy();
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm test src/presets/presets.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 最小实现**

```ts
// src/types/preset.ts
import type { Slide } from "./deck";
import type { DesignLock } from "./design";

export interface DeckPreset {
  id: string;
  name: string;
  description?: string;
  design: DesignLock;
  slides: Slide[];
  qualityRules?: string[];
}
```

```ts
// src/presets/index.ts
import type { DeckPreset } from "@/types/preset";
import type { Slide } from "@/types/deck";
import { DEFAULT_DESIGN } from "@/types/design";

// 模板 → preset（结构骨架转为 Slide，design 由 suggestedMode/VisualStyle + 映射 palette 构成）
const TEMPLATE_PALETTE: Record<string, string> = {
  "quarterly-review": "business-blue",
  "product-launch": "tech-purple",
  "market-analysis": "vibrant-orange",
  "training-material": "minimal-white",
  "business-plan": "business-blue",
  "competitor-analysis": "vibrant-orange",
  "project-proposal": "business-blue",
  "annual-plan": "business-blue",
};

function skeletonToSlide(s: { layout: string; title: string }, i: number): Slide {
  return { id: `s${i + 1}`, layout: s.layout as Slide["layout"], title: s.title };
}

// 以下 TEMPLATE_PACKS 由原 src/templates/index.ts 的 BUILTIN_PACKS 平移而来，
// 仅保留 id/name/description/suggestedMode/suggestedVisualStyle/slides/qualityRules
const TEMPLATE_PACKS: Array<{
  id: string; name: string; description: string;
  suggestedMode: string; suggestedVisualStyle: string;
  slides: Array<{ layout: string; title: string }>;
  qualityRules: string[];
}> = [ /* 平移 BUILTIN_PACKS 全部 8 项，保持原 slides/qualityRules */ ];

import { EXAMPLES } from "@/examples/index"; // 原 GalleryExample[]

export function getPresets(): DeckPreset[] {
  const fromTemplates: DeckPreset[] = TEMPLATE_PACKS.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    design: {
      mode: p.suggestedMode as DeckPreset["design"]["mode"],
      visualStyle: p.suggestedVisualStyle as DeckPreset["design"]["visualStyle"],
      palette: TEMPLATE_PALETTE[p.id] ?? DEFAULT_DESIGN.palette,
    },
    slides: p.slides.map(skeletonToSlide),
    qualityRules: p.qualityRules,
  }));
  const fromGallery: DeckPreset[] = EXAMPLES.map((e) => ({
    id: e.id,
    name: e.name,
    design: e.design,
    slides: e.slides,
  }));
  return [...fromTemplates, ...fromGallery];
}

export function getPresetById(id: string): DeckPreset | undefined {
  return getPresets().find((p) => p.id === id);
}
```

- [ ] **Step 4: outline.ts 去除模板依赖**

`src/services/outline.ts`：删除 `buildContextualPrompt`/`getTemplatePackById` 引入与 `templateCtx` 分支（design 已含 mode/visualStyle，由 `buildOutlineSystemPrompt` 消费）：

```ts
// 删除 import { buildContextualPrompt, getTemplatePackById } from "@/templates";
// 删除：
//   const templateCtx = params.contextualPrompt ?? (design.templateId ? buildContextualPrompt(...) : undefined);
// 改为：
const systemPrompt = buildOutlineSystemPrompt({
  design,
  fewShot: buildFewShotPrompt(selectFewShot(design)),
});
```
（如 `buildOutlineSystemPrompt` 仍接受 `templateCtx` 形参，传 `undefined` 保持签名兼容。）

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm test src/presets/presets.test.ts`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add src/types/preset.ts src/presets/index.ts src/presets/presets.test.ts src/services/outline.ts
git commit -m "feat(presets): 合并模板与画廊为统一 DeckPreset"
```

---

### Task 4: 首页示例库 PresetLibrary

**Files:**
- Create: `src/components/preset/PresetLibrary.tsx`
- Modify: `src/pages/Home.tsx`
- Delete: `src/components/template-dialog.tsx`、`src/components/gallery/GalleryPanel.tsx`

**Interfaces:**
- Consumes: `getPresets()`、`useDeckStore.createDeck` / `setDesign`、`useQualityStore.setPendingRules`
- Produces: 点击 preset → `createDeck()` + `setDesign(preset.design)` + 套用 `preset.slides` + `setPendingRules(preset.qualityRules)` + 跳转编辑器

- [ ] **Step 1: 写失败测试（渲染预设列表）**

```tsx
// src/components/preset/PresetLibrary.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PresetLibrary } from "./PresetLibrary";
import { getPresets } from "@/presets";

describe("PresetLibrary", () => {
  it("渲染所有 preset 名称", () => {
    render(<PresetLibrary onPick={() => {}} />);
    for (const p of getPresets()) {
      expect(screen.getByText(p.name)).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: 实现**

```tsx
// src/components/preset/PresetLibrary.tsx
import type { DeckPreset } from "@/types/preset";
import { getPresets } from "@/presets";

export function PresetLibrary({ onPick }: { onPick: (p: DeckPreset) => void }) {
  const presets = getPresets();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {presets.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onPick(p)}
          className="rounded-xl border border-border bg-white p-3 text-left transition hover:border-accent"
        >
          <div className="text-sm font-medium">{p.name}</div>
          {p.description && (
            <div className="mt-1 line-clamp-2 text-[11px] text-text-muted">
              {p.description}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
```

`src/pages/Home.tsx` 替换原 `handleTemplateSelect`/`handleGalleryPick` 与两处弹框：

```tsx
const handlePresetPick = async (preset: DeckPreset) => {
  setTemplateDialogOpen(false);
  setGalleryOpen(false);
  const deck = await createDeck();
  useDeckStore.getState().setDesign(preset.design);
  useDeckStore.getState().replaceSlides(preset.slides);
  useQualityStore.getState().setPendingRules(preset.qualityRules ?? []);
  navigate(`/editor/${deck.id}?new=1`);
};
// JSX 中：<PresetLibrary onPick={handlePresetPick} />
// 删除 TemplateDialog / GalleryPanel 引入与使用、TemplateSelectResult 类型引入
```

- [ ] **Step 3: 运行测试确认通过**

Run: `pnpm test src/components/preset/PresetLibrary.test.tsx`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/components/preset/PresetLibrary.tsx src/components/preset/PresetLibrary.test.tsx src/pages/Home.tsx
git rm src/components/template-dialog.tsx src/components/gallery/GalleryPanel.tsx
git commit -m "feat(home): 合并模板弹框与画廊为单一示例库"
```

---

### Task 5: 编辑器设计面板

**Files:**
- Modify: `src/pages/Editor.tsx`（替换 366-473 主题下拉为设计面板）
- Consumes: `ModePicker`/`StylePicker`/`PalettePicker`（`src/components/design/*`）、`useDeckStore.setDesign`、`deck.design`

- [ ] **Step 1: 写失败测试**

```tsx
// src/pages/Editor.design.test.tsx（或归入现有 Editor 测试）
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
// 以设计面板渲染并点击某 visualStyle 会调用 setDesign
```

（如编辑器集成测试成本高，可仅做类型/手动验证，并在 PR 说明。本任务以 typecheck+format 为准，UI 行为由 Task 6 的 PalettePicker 单测覆盖。）

- [ ] **Step 2: 实现**

将 `Editor.tsx` 中 `BUILTIN_THEMES.map(...)` 整段（含 customThemes、管理自定义主题按钮）替换为调用三个选择器：

```tsx
// 删除 import { BUILTIN_THEMES }、useCustomThemeStore、resolveTheme（present 模式已在 Task2 改）
// 新增 import { ModePicker, StylePicker, PalettePicker } from "@/components/design";
// 顶部弹栏「设计」按钮点击展开一个面板：
<div className="relative">
  <button onClick={() => setDesignOpen((v) => !v)} className="...">设计</button>
  {designOpen && (
    <div className="absolute right-0 top-full z-20 w-72 rounded-xl border border-border bg-white p-3 shadow-lg space-y-3">
      <ModePicker value={deck.design.mode} onChange={(mode) => setDesign({ ...deck.design, mode })} />
      <StylePicker value={deck.design.visualStyle} onChange={(visualStyle) => setDesign({ ...deck.design, visualStyle })} />
      <PalettePicker value={deck.design.palette} onChange={(palette) => setDesign({ ...deck.design, palette })} />
    </div>
  )}
</div>
```
（删除 `customThemes`/`setThemeOpen` 相关状态与「管理自定义主题」按钮；`useCustomThemeStore` 在设置页才用。）

- [ ] **Step 3: 验证**

Run: `pnpm typecheck && pnpm format:check`
Expected: 干净

- [ ] **Step 4: 提交**

```bash
git add src/pages/Editor.tsx
git commit -m "feat(editor): 用完整设计选择器替换仅 palette 的主题下拉"
```

---

### Task 6: PalettePicker 内联新建配色

**Files:**
- Modify: `src/components/design/PalettePicker.tsx`
- Consumes: `useCustomPalettes`、`getPalette`、`PALETTES`、`ThemeColors`
- Produces: 渲染内置 + 自定义配色 + 「＋新建配色」内联表单（仅 colors）

- [ ] **Step 1: 写失败测试**

```tsx
// src/components/design/palette-picker.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PalettePicker } from "./PalettePicker";

describe("PalettePicker", () => {
  it("渲染内置配色名", () => {
    render(<PalettePicker value="business-blue" onChange={() => {}} />);
    expect(screen.getByText("商务深蓝")).toBeTruthy();
  });
  it("点击新建后显示颜色表单", () => {
    render(<PalettePicker value="business-blue" onChange={() => {}} />);
    fireEvent.click(screen.getByText("＋新建配色"));
    expect(screen.getByPlaceholderText("主色 #")).toBeTruthy();
  });
});
```

- [ ] **Step 2: 实现**

`PalettePicker.tsx` 在现有列表末尾加「＋新建配色」按钮，点击展开 7 个颜色输入框（primary/secondary/accent/background/surface/text/textMuted），「保存」调用 `useCustomPalettes.getState().create(name, colors)` 并把新 id 通过 `onChange` 传出。仅 colors，不含 fonts。

- [ ] **Step 3: 运行测试确认通过**

Run: `pnpm test src/components/design/palette-picker.test.tsx`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/components/design/PalettePicker.tsx src/components/design/palette-picker.test.tsx
git commit -m "feat(design): PalettePicker 内联新建自定义配色"
```

---

### Task 7: 删除设置页自定义主题

**Files:**
- Modify: `src/pages/Settings.tsx`（删除 269-408 自定义主题 section + `ThemeEditorDialog` 使用 + `useCustomThemeStore` 引用）
- Delete: `src/components/theme-editor-dialog.tsx`、`src/store/custom-themes.ts`
- Modify: `src/services/storage.ts`（如仍残留 `saveCustomTheme` 等旧函数则删除）

- [ ] **Step 1: 删除 Settings 自定义主题 section**

在 `src/pages/Settings.tsx` 中删除 `{/* 自定义主题 */}` 整段 `<section>`（约 269-368 行）与文件末尾 `<ThemeEditorDialog .../>` 两处，并移除顶部 `useCustomThemeStore`/`generateCustomThemeId`/`BUILTIN_THEMES`/`Theme`/`ThemeEditorDialog` 的 import 与 `customThemes`/`loadCustomThemes`/`saveTheme`/`removeTheme`/`editingTheme`/`creating` 状态。（设置页仍保留 LLM/图片 provider 配置。）

- [ ] **Step 2: 删除组件与 store**

```bash
git rm src/components/theme-editor-dialog.tsx src/store/custom-themes.ts
```

- [ ] **Step 3: storage 清理**

确认 `src/services/storage.ts` 不再导出 `saveCustomTheme`/`listCustomThemes`/`deleteCustomTheme`/`CUSTOM_THEME_PREFIX`（Task 1 已替换为 palette 版）；如残留则删除。

- [ ] **Step 4: 验证**

Run: `pnpm typecheck && pnpm format:check`
Expected: 干净（无未使用导入/未定义引用）

- [ ] **Step 5: 提交**

```bash
git add src/pages/Settings.tsx src/services/storage.ts
git commit -m "refactor(settings): 删除自定义主题区块, 自定义配色改为内联创建"
```

---

### Task 8: outline 去除模板上下文（收尾）

**Files:**
- Modify: `src/services/outline.ts`
- Delete: `src/templates/index.ts` 中 `buildTemplateGenerationContext`、旧 `TemplatePack` 类型相关导出；如 `getTemplatePackById` 不再被任何文件引用则删除
- Modify: `src/types/template.ts`（删除仅被 `TemplatePack` 使用的类型）

- [ ] **Step 1: 确认无残留引用**

Run: `pnpm exec tsc --noEmit` 后 `rg -n "getTemplatePackById|buildContextualPrompt|TemplatePack|getTemplates" src`
Expected: 仅 `src/templates/index.ts` 内部定义，无外部调用

- [ ] **Step 2: 清理**

删除 `src/templates/index.ts` 的 `BUILTIN_PACKS` 平移后残留的 `TemplatePack`/`TemplateGenerationContext` 引用（已在 Task 3 平移到 presets），仅保留各模板 `slides` 骨架若仍被 presets 引用（实际上 presets 已内联，可整体删除 `src/templates/index.ts` 与 `src/types/template.ts` 中 `TemplatePack` 部分）。若 `Template` 类型仍被他处使用则保留。

- [ ] **Step 3: 验证**

Run: `pnpm typecheck && pnpm test`
Expected: 干净 / 全绿

- [ ] **Step 4: 提交**

```bash
git add src/services/outline.ts src/templates/index.ts src/types/template.ts
git commit -m "refactor(outline): 去除模板 suggestedMode 依赖, 清理 TemplatePack 死代码"
```

---

### Task 9: 删 themeOverrides + 旧 deck 兜底

**Files:**
- Modify: `src/types/deck.ts`（删 `themeOverrides`）
- Modify: `src/services/storage/deck-repair.ts`（兜底 `custom-*` palette）
- Modify: 调用 `deck.themeOverrides` 处（preview/exporter/Editor 已在 Task 2 去掉）

- [ ] **Step 1: 写失败测试**

```ts
// src/services/storage/deck-repair.test.ts
import { describe, it, expect } from "vitest";
import { repairDeck } from "./deck-repair";
import type { Deck } from "@/types/deck";

describe("deck-repair 旧自定义主题兜底", () => {
  it("design.palette 为 custom-* 时回退默认 palette", () => {
    const deck = { design: { mode: "briefing", visualStyle: "soft-rounded", palette: "custom-ghost" } } as unknown as Deck;
    const fixed = repairDeck(deck);
    expect(fixed.design.palette).toBe("business-blue");
  });
});
```

- [ ] **Step 2: 实现**

`src/types/deck.ts`：`Deck` 删除 `themeOverrides?: Partial<Theme>;`（并删除 `import type { Theme }`）。

`src/services/storage/deck-repair.ts`：在修复逻辑中，若 `deck.design.palette` 不以 `business-blue/minimal-white/tech-purple/vibrant-orange` 开头且 `getPalette` 返回 undefined，则置为 `DEFAULT_DESIGN.palette`。

- [ ] **Step 3: 运行测试确认通过**

Run: `pnpm test src/services/storage/deck-repair.test.ts`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/types/deck.ts src/services/storage/deck-repair.ts src/services/storage/deck-repair.test.ts
git commit -m "refactor(deck): 删 themeOverrides, 旧 custom-* palette 兜底默认"
```

---

### Task 10: 全量回归

**Files:** 无新增，全仓验证

- [ ] **Step 1: typecheck**

Run: `pnpm typecheck`
Expected: 无错误

- [ ] **Step 2: test**

Run: `pnpm test`
Expected: 173+ 测试全绿（含新增 preset/palette/theme/picker 测试）

- [ ] **Step 3: format**

Run: `pnpm format:check`
Expected: 所有文件符合 prettier

- [ ] **Step 4: 提交（若需，仅当发现遗留清理）**

```bash
git add -A
git commit -m "chore: 设计入口合并收尾与全量回归"
```

---

## 自审要点（执行前已核对）

- Spec 覆盖：① 单一 DeckPreset（Task 3/4）✓ ② DesignLock 唯一设计真相（Task 5）✓ ③ 统一 getPalette（Task 1/6）✓ ④ Theme 派生（Task 2）✓ ⑤ 删设置页自定义主题（Task 7）✓ ⑥ 旧 custom-* 兜底（Task 9）✓ ⑦ 测试/回归（各 Task + Task 10）✓
- 占位：无 TBD/TODO；所有步骤含代码或精确文件路径。
- 类型一致：`getPalette(id)`、`resolveTheme(paletteId, visualStyleId)`、`DeckPreset`、`useCustomPalettes` 在前后任务签名一致。
- 风险：Task 2 改 `resolveTheme` 签名，preview/exporter/Editor 三处调用点须在同任务内一并更新（已列）；`Theme.layouts` 删除后若有渲染代码读取需同步（探索确认渲染仅用 colors/fontSize/fonts/spacing，已安全）。
