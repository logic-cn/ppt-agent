# PPT Agent 设计方案

## 一、产品定位

**一句话**：本地运行的轻量级 AI PPT 工作站，左侧大纲编辑、中间实时预览、右侧 AI 对话，一键导出可编辑的 `.pptx`。

**核心价值**

- 隐私安全：用户自带 API Key，数据不出本地（仅 LLM 调用）
- 高质量产出：原生 pptx + JSON 主题系统，排版可控、视觉专业
- 轻量：Tauri 包体 ~10MB，零运行时依赖
- 开源可控：纯前端可读，主题/布局/提示词全部可定制

## 二、技术架构总览

```
┌─────────────────────────────────────────────────────┐
│  Tauri Window (React + TS + Tailwind)               │
│  ┌──────────┬──────────────────┬─────────────────┐  │
│  │ 大纲编辑器│   实时预览(HTML)  │  AI 对话面板    │  │
│  │ (左栏)   │   16:9 渲染       │  + 属性/模板    │  │
│  └──────────┴──────────────────┴─────────────────┘  │
│            Zustand (单一数据源: Deck JSON)           │
│  ┌──────────────────────────────────────────────┐   │
│  │  业务服务层 (TS modules)                       │   │
│  │  LLMAdapter / OutlineGen / ContentGen /       │   │
│  │  DocImporter / ChartExtractor / ImageService  │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │  PPTX 引擎 (PptxGenJS 封装)                   │   │
│  │  ThemeRenderer / LayoutEngine / Exporter      │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │  Tauri IPC
┌──────────────────────┴──────────────────────────────┐
│  Rust 后端 (极薄)                                    │
│  fs (读写 pptx/导入文件) / config / clipboard / win │
└─────────────────────────────────────────────────────┘
```

**分层要点**

- Rust 后端保持极薄，仅做文件 IO 和系统集成，避免双语言心智负担
- 所有业务逻辑在 TS 层，便于开源贡献和测试
- Deck JSON 是唯一数据源，预览与导出共用同一渲染逻辑，保证「所见即所得」

## 三、目录结构

```
ppt-agent/
├── src-tauri/                  # Rust 后端
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/           # fs、config、dialog 命令
│   │   └── tray.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                        # React 前端
│   ├── main.tsx
│   ├── App.tsx
│   ├── pages/
│   │   ├── Home.tsx            # 项目列表/最近
│   │   └── Editor.tsx          # 主编辑器(三栏)
│   ├── components/
│   │   ├── outline/            # 大纲树编辑器
│   │   ├── preview/            # 幻灯片预览渲染
│   │   ├── chat/               # AI 对话面板
│   │   ├── inspector/          # 属性/模板面板
│   │   └── ui/                 # 通用组件
│   ├── services/
│   │   ├── llm/                # LLM 适配层(多 provider)
│   │   │   ├── providers/      # openai/anthropic/qwen/zhipu
│   │   │   ├── adapter.ts
│   │   │   └── prompts/        # 提示词模板
│   │   ├── outline.ts          # 大纲生成
│   │   ├── content.ts          # 内容填充(流式)
│   │   ├── importer/           # 文档导入
│   │   │   ├── docx.ts         # mammoth
│   │   │   ├── markdown.ts
│   │   │   └── url.ts          # readability
│   │   ├── chart.ts            # 图表数据提取
│   │   └── image.ts            # AI 配图
│   ├── engine/
│   │   ├── pptx/               # PptxGenJS 封装
│   │   │   ├── exporter.ts
│   │   │   ├── theme-renderer.ts
│   │   │   └── layouts/        # 布局渲染器
│   │   └── preview/            # HTML 预览渲染器
│   │       ├── slide-renderer.tsx
│   │       └── shape-renderers/
│   ├── store/                  # Zustand stores
│   │   ├── deck.ts             # Deck 数据
│   │   ├── project.ts
│   │   └── settings.ts         # API Keys、模型选择
│   ├── types/                  # 共享类型(核心数据模型)
│   │   ├── deck.ts
│   │   ├── theme.ts
│   │   └── llm.ts
│   └── themes/                 # 内置主题(JSON)
│       ├── business-blue.json
│       ├── minimal-white.json
│       ├── tech-purple.json
│       └── vibrant-orange.json
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── vite.config.ts
```

## 四、核心数据模型

整个系统的灵魂，预览、导出、LLM 全部围绕它运作。

```typescript
// types/deck.ts
interface Deck {
  id: string
  title: string
  themeId: string
  themeOverrides?: Partial<Theme>
  slides: Slide[]
  createdAt: number
  updatedAt: number
  source?: { type: 'topic' | 'doc' | 'url'; ref: string }
}

interface Slide {
  id: string
  layout: SlideLayout  // 'cover' | 'section' | 'content' | 'two-column' | 'chart' | 'image' | 'closing'
  title: string
  subtitle?: string
  body?: string                    // markdown 片段
  bullets?: BulletNode[]           // 支持嵌套
  elements?: SlideElement[]        // 自由布局元素
  chart?: ChartSpec
  image?: ImageSpec
  notes?: string
}

interface BulletNode {
  id: string
  text: string
  level: 0 | 1 | 2
  children?: BulletNode[]
}

interface ChartSpec {
  type: 'bar' | 'pie' | 'line' | 'doughnut'
  title?: string
  data: { label: string; value: number }[]
}

interface ImageSpec {
  type: 'ai' | 'icon' | 'url'
  prompt?: string                  // ai 生成时的 prompt
  url?: string
  alt: string
  position?: 'full' | 'right' | 'background'
}
```

```typescript
// types/theme.ts
interface Theme {
  id: string
  name: string
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    surface: string     // 卡片背景
    text: string
    textMuted: string
  }
  fonts: {
    title: string       // CSS font-family
    body: string
  }
  fontSize: {
    h1: number; h2: number; body: number; caption: number
  }
  spacing: 'compact' | 'comfortable' | 'airy'
  layouts: Record<SlideLayout, LayoutSpec>  // 每种布局的几何参数
}

interface LayoutSpec {
  // 相对 16:9 画布的比例坐标 (0~1)
  title?:  { x: number; y: number; w: number; h: number }
  body?:   { x: number; y: number; w: number; h: number }
  visual?: { x: number; y: number; w: number; h: number }  // 图/表区域
}
```

**设计要点**

- 所有坐标用比例 (0~1)，预览和导出按实际像素缩放，一套布局两处复用
- `bullets` 支持嵌套树，比扁平数组更贴近真实大纲
- 主题用 JSON 定义而非 pptx 模板文件，便于版本管理和用户自定义

## 五、关键模块设计

### 1. LLM 适配层

```typescript
// services/llm/adapter.ts
interface LLMProvider {
  id: string                       // 'openai' | 'anthropic' | 'qwen' | 'zhipu' | 'custom'
  chat(req: ChatRequest): Promise<ChatResponse>
  chatStream(req: ChatRequest): AsyncIterable<string>
  jsonMode?: boolean
}

interface ChatRequest {
  model: string
  messages: { role: 'system'|'user'|'assistant'; content: string }[]
  temperature?: number
  responseFormat?: 'text' | 'json'  // 支持 strict JSON
}
```

- 统一接口，每个 provider 一个文件，遵循 OpenAI 兼容协议（通义/智谱均提供兼容端点）
- 设置页让用户填 baseUrl + apiKey + model，默认提供几套预设
- **JSON 模式强制**：大纲生成走 `responseFormat: 'json'`，配合 schema 校验 + 重试

### 2. 提示词工程（核心质量保障）

提示词放在 `services/llm/prompts/`，分四类：

| 文件 | 作用 | 输入 → 输出 |
|---|---|---|
| `outline.ts` | 主题/文档 → 大纲 JSON | 主题+受众+页数 → `Slide[]` 骨架 |
| `content.ts` | 单页大纲 → 详细内容 | 一页骨架 → 填充 body/bullets |
| `chart.ts` | 上下文 → 图表数据 | 文档片段 → `ChartSpec` |
| `image.ts` | 页面内容 → 配图 prompt | slide → ImageSpec.prompt |

**大纲提示词关键策略**（直接决定产出质量）：

- System prompt 注入角色「资深咨询顾问/汇报设计师」
- 强约束 JSON Schema，附带 3~5 个 few-shot 优质范例
- 要求 AI 主动建议 `layout` 类型和是否需要图表
- 注入主题信息，让大纲与视觉风格匹配

### 3. 文档导入器

```
docx → mammoth.js → HTML → 提取标题层级 + 正文 → 结构化文本
md   → marked.lexer → tokens → 结构化文本
url  → @mozilla/readability + DOM 解析 → 结构化文本
```

统一输出 `StructuredDoc { title, sections[] }`，再喂给大纲生成器。

### 4. 实时预览渲染器

```tsx
// engine/preview/slide-renderer.tsx
function SlidePreview({ slide, theme, scale }: Props) {
  // 16:9 画布, scale 控制缩放
  return (
    <div style={{ aspectRatio: '16/9', background: theme.colors.background }}>
      <LayoutRenderer layout={theme.layouts[slide.layout]} slide={slide} theme={theme} />
    </div>
  )
}
```

- 用 CSS 绝对定位 + 比例坐标渲染，与 PptxGenJS 导出逻辑一一对应
- 图表用 `chart.js` 渲染到 canvas（导出时截图嵌入 pptx）
- 缩略图模式（左侧大纲每页带小预览）+ 聚焦模式（当前页大图）

### 5. PPTX 导出引擎

```typescript
// engine/pptx/exporter.ts
import PptxGenJS from 'pptxgenjs'

async function exportDeck(deck: Deck, path: string) {
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'CUSTOM', width: 13.333, height: 7.5 })  // 16:9
  pptx.layout = 'CUSTOM'

  // 注入主题为 master
  const theme = resolveTheme(deck)
  pptx.defineSlideMaster(buildMaster(theme))

  for (const slide of deck.slides) {
    const s = pptx.addSlide({ masterName: theme.id })
    const layout = theme.layouts[slide.layout]
    renderSlide(s, slide, layout, theme)  // 按 layout 几何参数填充
  }

  await pptx.writeFile({ fileName: path })
}
```

**质量保障要点**：

- 文本框用 `valign` + `autoFit` 防溢出
- 字号、行距、段前段后严格按 theme 映射
- 图表用 PptxGenJS 原生 `addChart`（可编辑，非图片）
- AI 配图通过 `addImage` 嵌入

## 六、交互流程

```
用户进入
  │
  ├─ 新建项目: 输入主题 → 选受众/页数/风格 → [生成大纲]
  │
  └─ 导入文档: 拖入 docx/md 或粘贴 URL → AI 提炼 → [生成大纲]
                                          │
                          AI 流式返回大纲 JSON (左栏实时填充)
                                          │
                              用户在大纲编辑器调整:
                              - 拖拽排序 / 增删页
                              - 编辑标题/bullets
                              - 标记某页加图表/配图
                                          │
              ┌───────────────────────────┴───────────────────┐
              │                                                 │
        [生成当前页内容]                                [AI 对话修改]
        AI 流式填充 body                                  "把第3页改成双栏"
              │                                         "加一页对比图表"
        预览自动更新                                        │
              │                                         AI 直接改 Deck JSON
        [一键生成所有页]                                        │
              │                                                 │
              └───────────────► 选中模板  ◄─────────────────────┘
                                  │
                          预览整体重渲染
                                  │
                          [导出 .pptx]
```

## 七、模板/主题系统

轻量 JSON 主题包，而非二进制 pptx 模板。

```json
// themes/business-blue.json
{
  "id": "business-blue",
  "name": "商务深蓝",
  "colors": {
    "primary": "#1E3A5F", "secondary": "#3B6EA5",
    "accent": "#F4B860", "background": "#FFFFFF",
    "surface": "#F8FAFC", "text": "#1A202C", "textMuted": "#64748B"
  },
  "fonts": { "title": "'Source Han Sans', sans-serif", "body": "'Source Han Sans', sans-serif" },
  "fontSize": { "h1": 44, "h2": 32, "body": 18, "caption": 14 },
  "spacing": "comfortable",
  "layouts": {
    "cover":     { "title":  { "x": 0.08, "y": 0.35, "w": 0.7, "h": 0.2 },
                   "body":   { "x": 0.08, "y": 0.6,  "w": 0.6, "h": 0.15 } },
    "content":   { "title":  { "x": 0.08, "y": 0.08, "w": 0.84, "h": 0.12 },
                   "body":   { "x": 0.08, "y": 0.22, "w": 0.84, "h": 0.7 } },
    "two-column":{ "title":  { "x": 0.08, "y": 0.08, "w": 0.84, "h": 0.12 },
                   "body":   { "x": 0.08, "y": 0.22, "w": 0.42, "h": 0.7 },
                   "visual": { "x": 0.54, "y": 0.22, "w": 0.38, "h": 0.7 } },
    "chart":     { "title":  { "x": 0.08, "y": 0.08, "w": 0.84, "h": 0.12 },
                   "visual": { "x": 0.1,  "y": 0.22, "w": 0.8,  "h": 0.7 } }
  }
}
```

- 内置 4 套主题覆盖主流场景
- 切换主题 = 改 `deck.themeId`，预览即时重渲染（无网络调用）
- 支持用户自定义主题（JSON 编辑器 + 实时预览），可导出分享

## 八、依赖清单（精选）

| 用途 | 库 | 体积 |
|---|---|---|
| 桌面框架 | `@tauri-apps/api` `@tauri-apps/cli` | - |
| UI 构建 | `react` `react-dom` `typescript` `tailwindcss` | - |
| 状态 | `zustand` | ~3KB |
| PPTX 生成 | `pptxgenjs` | ~500KB |
| 图表 | `chart.js` `react-chartjs-2` | ~200KB |
| LLM | `openai` SDK（兼容多 provider） | ~200KB |
| 文档导入 | `mammoth` `marked` `@mozilla/readability` | - |
| 拖拽排序 | `@dnd-kit/core` | ~30KB |
| 图标 | `lucide-react` | tree-shake |
| Markdown 渲染 | `react-markdown` | - |
| 工具库 | `zod`（schema 校验）`nanoid` `lodash-es` | - |

**刻意不引入**：Electron、重型 UI 库（用 Tailwind 自建组件，保证轻量和定制性）、Redux（Zustand 足够）。

## 九、实施里程碑（全量交付，内部仍有顺序）

| 阶段 | 内容 | 产出 |
|---|---|---|
| **M1 骨架** | Tauri + React + Tailwind + 路由 + Zustand + 类型定义 | 可运行的空壳 |
| **M2 数据模型** | Deck/Slide/Theme 类型 + 默认主题 + 本地持久化 | 能存取项目 |
| **M3 预览引擎** | HTML SlideRenderer + 7 种布局 + 主题应用 | 静态预览可用 |
| **M4 LLM 接入** | Provider 适配 + 设置页(填 Key) + 大纲生成提示词 | 输入主题→生成大纲 |
| **M5 大纲编辑器** | 树形编辑 + 拖拽排序 + 增删改 + 联动预览 | 完整编辑闭环 |
| **M6 PPTX 导出** | PptxGenJS 封装 + 主题渲染 + 导出文件 | 端到端可用 |
| **M7 内容生成** | 单页内容流式生成 + 批量生成 + AI 对话改写 | 质量提升 |
| **M8 文档导入** | docx/md/url 三路导入 + 结构化提取 | 导入转 PPT |
| **M9 图表系统** | ChartSpec 提取 + 预览渲染 + pptx 原生图表 | 数据可视化 |
| **M10 AI 配图** | 文生图 API 集成(DALL-E/通义万相) + 图位布局 | 视觉增强 |
| **M11 打磨** | 4 套主题精修 + 错误处理 + 快捷键 + 引导页 | 发布就绪 |

## 十、风险与对策

| 风险 | 对策 |
|---|---|
| **PPTX 排版与预览不一致** | 预览和导出共用同一 LayoutSpec 几何参数；导出前跑一遍 `validateLayout` 检测溢出 |
| **LLM 返回 JSON 不合规** | 严格 zod schema 校验 + 最多 2 次自动修复重试 + 兜底降级为纯文本大纲 |
| **中文排版字体缺失** | 主题默认思源黑体；导出时 pptx 字体回退栈 `思源黑体, 微软雅黑, PingFang SC, sans-serif` |
| **AI 配图成本/合规** | 默认关闭，用户在设置页显式开启并填图模型 Key；提供「图标占位」免费替代方案 |
| **Tauri npm 包兼容性** | 文档导入等纯 JS 库在 webview 中运行无问题；仅文件 IO 走 Rust command |
| **大文档导入慢** | 超过 2 万字自动分段，大纲生成走「先摘要再分页」两阶段策略 |

## 十一、工程约定

- 前端代码必须通过 `prettier` 格式检查（在项目根目录执行 `pnpm format`）
- 所有核心类型集中在 `src/types/`，避免散落
- 提示词独立到 `services/llm/prompts/`，便于调优和社区贡献
- Rust 后端只做 fs/dialog/config/clipboard，业务逻辑全在 TS 层
- 数据库表主键 id 字段必须为 bigint（如后续引入本地数据库）
- 禁止硬编码凭证或密钥；禁止提交 `.env*` 文件
