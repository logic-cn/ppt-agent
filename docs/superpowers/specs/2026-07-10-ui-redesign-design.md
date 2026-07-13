# PPT Agent UI Redesign

- **Date**: 2026-07-10
- **Status**: Draft
- **Product**: PPT Agent — 轻量级 AI PPT 工作站 (Tauri 2 + React + TypeScript)
- **Target Users**: C 端消费者 (Mac + Windows)

## Design Direction

| Dimension | Decision | Rationale |
|-----------|----------|-----------|
| Tone | 专业高效 + 创意活力 | Notion 的干净 + Linear 的精致 + Raycast 的 macOS 原生感 |
| Color Mode | 浅色为主 (暖白) | 当前为纯暗色，切换到奶油白浅色是质的飞跃 |
| Typography | Inter (英文) + PingFang SC (中文) | 干净现代，中英文混排友好 |
| Icon | Lucide (保留现有) 线框风格 | 轻量、一致、开源 |

## Color System

### Background & Surface

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-bg-page` | `#FAF9F6` | 页面背景 (暖白，类 Notion) |
| `--color-bg-surface` | `#F5F4F0` | 面板/卡片背景 |
| `--color-bg-elevated` | `#FFFFFF` | 浮层/白色卡片 |
| `--color-bg-hover` | `#EEEDE8` | 悬浮态 |

### Border

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-border` | `#E8E7E2` | 默认边框 |
| `--color-border-strong` | `#D4D3CE` | 强调边框 |

### Text

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-text-primary` | `#1A1A1E` | 主要文字 |
| `--color-text-secondary` | `#6B6B76` | 次要文字 |
| `--color-text-muted` | `#9A9AA8` | 弱化文字 |

### Accent

| Token | Hex / Gradient | Usage |
|-------|----------------|-------|
| `--color-accent` | `linear-gradient(135deg, #4F6FFF, #8B5CF6)` | 一般主要操作 (靛蓝→紫渐变) |
| `--color-accent-hover` | `#3B5FFF` | 强调色悬浮态 |
| `--color-accent-soft` | `#EEF0FF` | 弱化强调背景 |
| `--color-ai` | `linear-gradient(135deg, #FF6B6B, #FFA94D)` | AI 核心操作 (珊瑚橙渐变) |
| `--color-ai-soft` | `#FFF5F5` | AI 弱化背景 |

### Semantic

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-success` | `#22C55E` | 成功 |
| `--color-warning` | `#F59E0B` | 警告 |
| `--color-error` | `#EF4444` | 错误 |

## Typography

| Usage | Font Stack | Size |
|-------|-----------|------|
| Body / UI | Inter, system-ui, sans-serif | 13px (base) |
| Chinese | PingFang SC, Source Han Sans CN, Microsoft YaHei | (fallback) |
| Mono | JetBrains Mono, SF Mono, Menlo | — |
| Heading | Inter, system-ui, sans-serif | 16-22px |
| Small | Inter | 11-12px |

### Type Scale

| Token | Size | Usage |
|-------|------|-------|
| xs | 11px | 标签、辅助文字、页码 |
| sm | 12px | Tab、描述、按钮内文字 |
| base | 13px | 正文、输入框、列表项 |
| lg | 15px | 小标题 |
| xl | 18px | 页面标题 |
| 2xl | 22px | 首页大标题 |

## Layout

### Home Page

```
┌──────────────────────────────────────────────┐
│  [P] PPT Agent                      [⚙️ 设置] │
├──────────────────────────────────────────────┤
│  开始制作                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ ＋       │ │ 📄      │ │ 📋      │      │
│  │ 新建空白  │ │ 导入文档  │ │ 从模板   │      │
│  │ 项目     │ │          │ │ 创建     │      │
│  └──────────┘ └──────────┘ └──────────┘      │
│                                              │
│  最近项目                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Q3路线图  │ │ 市场分析  │ │ + 新建   │      │
│  │ 12页·15号 │ │ 8页·14号 │ │         │      │
│  └──────────┘ └──────────┘ └──────────┘      │
└──────────────────────────────────────────────┘
```

### Editor (Three-Column)

```
┌────────────────────────────────────────────────────┐
│ ← Q3 产品路线图 · 12页  [任务] [◧][◨] │ 🗑 │ 🎨主题 │ 📥导入 │ 🖥演示 │ 📥导出PPT │
├──────────┬──────────────────────────┬──────────────┤
│ 大纲     │     幻灯片预览            │ AI │ 页面 │
│ (280px)   │     (flex:1)             │ 图表│ 配图│备注│
│ 可折叠    │     16:9 渲染             │ (280px)       │
│ →36px     │     padding 16-24px      │ 可折叠        │
│          │                          │ →36px        │
└──────────┴──────────────────────────┴──────────────┘
```

### Collapsed State

当侧栏折叠时，预览区从约 540px 扩大到填充全部剩余宽度（宽约 30%），两侧仅保留 36px 图标条。

## Component Design

### Buttons (5 Levels)

| Level | Style | Scene |
|-------|-------|-------|
| AI (最高) | 珊瑚橙渐变 + 微发光阴影 | AI 发送、AI 生成内容、AI 生成配图 |
| Primary | 靛蓝→紫渐变 | 导出 PPT、确认、保存 |
| Secondary | 白底 + #E8E7E2 边框 | 导入、演示、取消 |
| Ghost | 透明 + #6B6B76 文字 | 管理主题、查看全部 |
| Danger | #FEE2E2 边框 + #EF4444 文字 | 删除项目、删除配图 |

### Inputs (4 States)

| State | Style |
|-------|-------|
| Normal | 白底 + #E8E7E2 1px 边框 + 8px 圆角 |
| Focus | 同上 + #4F6FFF 边框 + 3px rgba(79,111,255,0.1) 光晕 |
| Disabled | #FAF9F6 底 + #9A9AA8 文字 |
| Error | #FFF5F5 底 + #FEE2E2 边框 + #EF4444 提示文字 |

### Tabs

- **Inspector 下划线**: 等分 5 栏，选中项底部 2px 蓝色线 + 蓝色文字
- **分段胶囊**: 灰色底胶囊容器，选中项白色底 + 灰色边框

### Dialogs

- 遮罩: `rgba(0,0,0,0.3) + backdrop-blur-sm`
- 卡片: 白色底 + 14px 圆角 + 8px shadow
- 标题: 16px 600 weight
- 内容: 13px secondary text
- 底部: 右对齐双按钮

### Toasts

- 白底卡片 + 10px 圆角 + 弱阴影
- 左侧 20px 语义色圆点 (绿/红/黄)
- 自动消失 (3s)

### Dropdown (Theme Switcher)

- 白色底 + 10px 圆角 + 4px 20px shadow
- 每项: 色点 + 名称 + 选中标记 ✓
- 分隔线区分内置/自定义主题

### Cards

- Home 项目卡片: 白底 + 12px 圆角 + 1px 边框 + hover 高亮
- 快捷入口: 同项目卡片，内容居中

## Inspector Tab Order

1. **AI** (Core — ChatPanel + 模板 + 质量报告)
2. **页面** (Slide properties)
3. **图表** (Chart editor)
4. **配图** (Image settings + AI generate)
5. **备注** (Speaker notes)

## Editor Toolbar (10 Items)

```
← Back | Title (editable) · PageCount | [TaskIndicator] | ◧ ◨ | 🗑 | 🎨Theme▾ | 📥Import | 🖥Present | 📥Export
```

## Accessibility

- All interactive elements: `cursor-pointer`
- Hover states: smooth 150-300ms transitions
- Text contrast: ≥4.5:1 for primary, ≥3:1 for secondary
- Focus states visible for keyboard navigation
- `prefers-reduced-motion` respected
- Font rendering: `-webkit-font-smoothing: antialiased`

## Anti-patterns (Avoid)

- 使用 Emoji 作为结构性图标 (使用 Lucide SVG)
- 布局偏移的 hover 效果
- 过低对比度的灰色文字
- 覆盖所有功能前的视觉简化（确保实现时功能完整）

## 平台适配

- **macOS**: Tauri 原生窗口装饰 (`decorations: true`) 自带三色圆点，工具栏在标题栏下方
- **Windows**: Tauri 原生窗口装饰，工具栏居中在标题栏下方
- 无需自定义标题栏，Tauri 自动处理平台差异
