# 设计入口合并（模板 / 主题 / 画廊 / 自定义主题）

- 日期：2026-07-14
- 状态：已确认，待出实施计划
- 关联：2026-07-13-ppt-quality-refactor.md（DesignLock 地基）

## 1. 背景与问题

`ppt-quality-refactor` 已将 deck 的设计状态收敛为 `DesignLock`（mode/visualStyle/palette），但创建/设计入口仍残留四套并行且互相矛盾的概念：

| 入口 | 实际写入 | 问题 |
|---|---|---|
| 编辑页主题下拉 | 仅 `deck.design.palette` | 改不了 mode/visualStyle，残缺 |
| 设置页自定义主题 | 完整 `Theme`（colors/fonts/spacing/layouts）到全局 json | `spacing/layouts` 渲染从不读；自定义 id 让 `getPalette` 崩溃 |
| 首页从模板创建 | 结构 + qualityRules；`suggestedMode/visualStyle` 仅作 prompt 文本 | 模板"设计身份"被架空，与 DEFAULT 矛盾 |
| 首页样例画廊 | 完整 `DesignLock`（唯一全接通入口） | 预置 `slides` 仅作缩略图，未套用 |

概念过载根因：`palette` 有三套需手工同步的注册表（`PALETTES` / `BUILTIN_THEMES` / 自定义主题 json）；`visualStyle` 与 `Theme.fonts/spacing/layouts` 双源；`mode` 与 `TemplatePack.suggestedMode` 双源且矛盾。

## 2. 目标

- 概念从 4 套降到 **2 套**：预设（DeckPreset = 起点）+ 设计（DesignLock = 唯一设计真相）。
- 配色注册表从 3 套降到 **1 套**：统一 `getPalette`（内置 + 自定义）。
- `Theme` 由 `(palette, visualStyle)` **派生**，删除独立 Theme 数据与文件。
- UI 创建入口从 4 个收敛为：首页「示例库」+ 编辑器「设计」面板 + PalettePicker 内联新建。

## 3. 非目标（YAGNI）

- 不迁移旧自定义主题内容（旧 `custom-*` 直接淘汰）。
- 不做自定义字体（字体由 visualStyle 决定，扩展 visualStyle 超出本次）。
- 不改生成/质量门/配图逻辑（仅消费方接口稳定）。

## 4. 目标概念模型

```
首页示例库 ──(DeckPreset: design + slides + qualityRules)──┐
                                                            ├─→ deck.design (唯一设计真相)
编辑器设计面板 ──(ModePicker/StylePicker/PalettePicker)─────┘        │
PalettePicker「＋」──→ 自定义 palette（仅 colors，进统一 registry）   │
                                                                     ▼
                                          resolveTheme(palette, visualStyle) → 渲染外观
```

- **DeckPreset**：创建起点，含完整初始内容。
- **DesignLock**：`{ mode, visualStyle, palette }`，deck 上唯一设计真相，驱动生成 + 渲染。
- **Palette**：唯一颜色源（内置 `PALETTES` + 自定义）。
- **Theme**：纯派生结果，不再持久化。

## 5. 数据模型变更

### 5.1 新增 `DeckPreset`
文件：`src/types/preset.ts`
```ts
export interface DeckPreset {
  id: string;
  name: string;
  design: DesignLock;
  slides: Slide[];
  qualityRules?: QualityRule[];
}
```

### 5.2 合并数据源
- `src/templates/index.ts` + `src/examples/index.ts` → `src/presets/index.ts`
- 导出 `getPresets(): DeckPreset[]`，由现有模板与画廊样例合并构造。
- 删除 `TemplatePack.suggestedMode` / `suggestedVisualStyle`（design 已显式携带）。
- 现有模板的结构骨架 + qualityRules、画廊样例的 design + slides，统一填入 `DeckPreset`。

### 5.3 `resolveTheme` 重写
文件：`src/themes/index.ts`
```ts
export function resolveTheme(
  paletteId: PaletteId,
  visualStyleId: VisualStyleId,
): Theme {
  const palette = getPalette(paletteId);          // 统一 registry（内置+自定义）
  const style = getVisualStyle(visualStyleId);     // VISUAL_STYLES
  return {
    colors: palette.colors,
    fonts: style.fonts,
    fontSize: style.fontSize,
    spacing: style.spacing,
    decoration: style.decoration,
  };
}
```
- `Theme` 类型瘦身：删除 `layouts` 字段；`spacing` 改由 visualStyle 填充（不再从 Theme 文件读取）。
- 删除 `BUILTIN_THEMES` 及其 JSON 镜像。

### 5.4 自定义 palette
- 类型 `CustomPalette = { id: PaletteId; name: string; colors: PaletteColors }`
- store：`src/store/custom-palettes.ts`（替换 `src/store/custom-themes.ts`），持久化到 `palettes/<id>.json`
- `getPalette(id)`：`PALETTES` 查不到再查自定义 registry；都查不到抛出/由调用方兜底（见 §7）。

### 5.5 删除清单
- 类型/数据：`BUILTIN_THEMES`、`Theme.layouts`、`Deck.themeOverrides`（死字段）、旧 `Template`/`GalleryExample`、`getTemplates`/`getTemplateById`/`BUILTIN_TEMPLATES`、`buildTemplateGenerationContext`
- UI：`ThemeEditorDialog`、设置页「自定义主题」区块、`useCustomThemeStore` 旧 Theme 形态

## 6. UI 入口（终态）

1. **首页「示例库」**：单一列表渲染 `getPresets()`。卡片 = 名称 + 缩略（用 preset.design 着色）+「用此预设」→ `createDeck({ slides: preset.slides, design: preset.design })` 并跳编辑器。（合并原 `TemplateDialog` 与 `GalleryPanel`）
2. **编辑器「设计」面板**：复用 6.2 组件 `ModePicker`/`StylePicker`/`PalettePicker`（`src/components/design/*`）写 `setDesign`；改 design 即时反映到预览（渲染读 `deck.design`）。替换现仅 palette 的下拉。
3. **`PalettePicker` 内联「＋新建配色」**：小表单仅填 colors（主色/强调色/背景/文字），存入自定义 palette registry，立即可选。
4. **删除**：设置页「自定义主题」区块及 `ThemeEditorDialog`/`useCustomThemeStore` 旧逻辑。

## 7. 迁移与向后兼容

- 旧 deck `design.palette === "custom-*"`：`getPalette` 找不到 → `deck-repair.ts` / `resolveTheme` 兜底为 `DEFAULT_DESIGN.palette`，不崩溃。
- 旧 `themes/<custom-...>.json`：本次不读取、不迁移；文件可保留无害（或顺手清理目录，非必须）。
- `deck.design.palette` 为内置 id（business-blue 等）的旧 deck：继续经 `PALETTES` 解析，无影响。

## 8. 测试

- `presets` 合并测试：模板与画廊样例均产出合法 `DeckPreset`（design 完整、slides 非空）。
- `resolveTheme` 派生测试：给定 (palette, visualStyle) 返回 colors 来自 palette、fonts/spacing 来自 visualStyle；无 `layouts`。
- `getPalette` 自定义测试：内置 + 自定义均能解析；未知 id 触发兜底。
- 编辑器 design 写入测试：ModePicker/StylePicker/PalettePicker 改动落到 `deck.design`。
- 回归：现有 173 测试全绿（`pnpm test`）；`pnpm typecheck` / `pnpm format:check` 干净。

## 9. 风险

- `resolveTheme` 现依赖 `visualStyle`，渲染路径（preview / exporter / present）须保证 `deck.design.visualStyle` 始终存在（`DEFAULT_DESIGN` 已保证，旧 deck 经 deck-repair 补）。
- 自定义 palette 仅 colors，字体跟随 visualStyle——若要自定义字体需扩展 visualStyle（超出本次）。

## 10. 验收标准

- 首页仅一个「示例库」入口；选任一 preset 后新 deck 含其完整 slides 与 design。
- 编辑器可改 mode/visualStyle/palette 三者，预览即时更新。
- PalettePicker 可内联新建自定义配色并立即选用；自定义配色仅含 colors。
- 设置页不再有「自定义主题」区块。
- `getPalette` 为唯一配色入口；`BUILTIN_THEMES` / `Theme.layouts` / `Deck.themeOverrides` 已删除，无残留引用。
- `pnpm typecheck && pnpm test && pnpm format:check` 全绿。
