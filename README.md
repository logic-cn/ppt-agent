# PPT Agent

轻量级 AI PPT 工作站 —— 本地运行，一键生成可编辑的 `.pptx`。

## 特性

- 🤖 **AI 生成**：输入主题即可生成完整 PPT 大纲
- 🎛️ **生成参数控制**：场景 / 语气 / 信息密度 / 目标受众 / 图表倾向 / 页数，生成前精细约束 AI 输出
- 📝 **大纲编辑器**：拖拽排序，嵌套 bullet，实时预览
- 🎨 **4 套内置主题**：商务深蓝 / 极简白 / 科技紫 / 活力橙
- 📊 **原生图表**：支持柱状图/折线图/饼图，可在 PowerPoint 中编辑
- 🖼️ **AI 配图**（可选）：自动生成配图
- 📄 **文档导入**：Word / Markdown / URL → PPT
- 💾 **本地存储**：数据不出本地，隐私安全
- 🔌 **多模型支持**：OpenAI / Claude / 通义千问 / 智谱 GLM
- 🌐 **多语言**：中英文界面即时切换，偏好持久化
- 🌙 **深色模式**：浅色 / 深色 / 跟随系统

## 截图

| 编辑器：大纲 + 实时预览 + AI 面板 | 首页：新建 / 导入 / 示例库 |
| --- | --- |
| ![编辑器](docs/screenshots/editor.png) | ![首页](docs/screenshots/home.png) |

## 快速开始

```bash
# 依赖
pnpm install

# 开发
pnpm tauri:dev

# 构建
pnpm tauri:build
```

## 自动更新

应用已接入 Tauri updater（设置 → 通用 → 关于与更新，可检查并安装更新）。发布新版本时：

1. 构建时用签名密钥对产物签名（密钥文件 `src-tauri/updater.key` 已 gitignore，密码见密钥保管处）：

   ```bash
   export TAURI_SIGNING_PRIVATE_KEY_PATH=src-tauri/updater.key
   export TAURI_SIGNING_PRIVATE_KEY_PASSWORD='<密钥密码>'
   pnpm tauri:build
   ```

2. 将构建产物（macOS `.app.tar.gz` / Windows `.msi`）、对应的 `.sig` 文件与 `latest.json`（平台更新清单）一起上传到 GitHub Release，端点为 `https://github.com/logic-cn/ppt-agent/releases/latest/download/latest.json`。
3. `latest.json` 中的 `version` 高于当前安装版本时，用户端即可检测到更新。

> 国内分发可在 `src-tauri/tauri.conf.json` 的 `plugins.updater.endpoints` 中增加指向自有 CDN/OSS 的 `latest.json` 地址；公钥（`pubkey`）不变。

## 使用

1. 打开应用，点击「新建空白项目」
2. 在右侧 AI 面板输入 PPT 主题（如「Q3 业务复盘汇报」）
3. 需要更精细的控制时，点开输入框上方的「选项」面板，设置场景（业务复盘 / 融资路演 / 培训等）、语气（正式 / 咨询风等）、信息密度、目标受众、图表倾向与页数，再发送主题
4. AI 自动生成大纲，在左侧可拖拽排序、调整每页布局
5. 预览满意后，点击「导出 PPT」下载 `.pptx` 文件

## 配置

前往设置页填写 LLM API Key：

| Provider  | Base URL                                            | 模型                       |
| --------- | --------------------------------------------------- | -------------------------- |
| OpenAI    | `https://api.openai.com/v1`                         | `gpt-4o`                   |
| Anthropic | `https://api.anthropic.com/v1`                      | `claude-sonnet-4-20250514` |
| 通义千问  | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-max`                 |
| 智谱 GLM  | `https://open.bigmodel.cn/api/paas/v4`              | `glm-4-plus`               |

## 语言与主题

- **语言**：设置页「通用」区块可选择中文 / English，切换即时生效并持久化到 `settings.json`；AI 生成的内容语言也会跟随界面语言（中文界面生成中文 PPT）。
- **主题**：浅色 / 深色 / 跟随系统三种模式；「深色」与「跟随系统」会为根元素挂载 `.dark`，全部语义色 token（背景/边框/文字/强调色）随之切换。

## 技术栈

- **桌面框架**：Tauri 2 + Rust
- **前端**：React 18 + TypeScript + Tailwind CSS + Vite
- **状态管理**：Zustand
- **PPT 生成**：PptxGenJS
- **LLM 接入**：OpenAI SDK（兼容多 Provider）
- **图表**：PptxGenJS 原生图表
- （近期优化：svgStale 同步机制、图表质量闸门、单页重画 Toast 提示）

## 项目结构

```
src/
├── types/          # 核心数据模型
├── store/          # Zustand stores
├── services/       # LLM 适配、大纲生成、文档导入
├── engine/         # 预览渲染器、PPTX 导出引擎
├── components/     # 大纲编辑器、AI 对话面板
├── themes/         # 内置主题（JSON）
└── pages/          # Home、Editor、Settings
```

## 开发

```bash
pnpm dev              # 仅前端
pnpm tauri:dev        # Tauri 应用
pnpm typecheck        # 类型检查
pnpm format           # 格式化
pnpm build            # 前端构建
```

## X1 架构：SVG 设计真相管线

X1 将渲染架构从「几何坐标程序化绘制」重构为「SVG 页面设计真相 + 原生 PPTX 翻译」，使生成的 PPT 美观、预览导出一致、导出完全可编辑。

### 管线流程

1. **设计锁（specLock）**：由 `visualStyles` / `palettes` 硬化出画布（1280×720 像素 viewBox）、配色、字体等设计契约。
2. **页面规划（pagePlan）**：`generatePagePlan` 调用 LLM 产出每页语义角色（cover / content / metrics / …）与内容规划，不含像素坐标。
3. **逐页串行生成 SVG（executor）**：编排入口 `buildDeckSvgs`（pipeline.ts）先产出 pagePlan，其内部的 `generateDeckSvgs` 按页顺序（禁止并行）调用 `generateSlideSvg`，注入 specLock + pagePlan 产出单页 `<svg viewBox="0 0 1280 720">` 设计真相。
4. **质量闸门（checkSvg + 重画）**：`generateSlideSvg` 集成 `checkSvg` 越界/溢出校验，首轮若报 error 则回喂问题重画，最多 2 轮；末道 `validateSvgContract` 契约兜底，非法则抛错。
5. **SvgViewer 预览**：预览原生内联渲染 `slide.svg`，预览即导出结果。
6. **SVG → PPTX 原生翻译（svgToPptx）**：`translateSvgToSlide` 逐元素翻译为 pptxgenjs 原生 `addText` / `addShape` / `addChart`，**导出为可编辑对象而非图片**。
7. **单页重画**：预览底部「重画此页」按钮调用 `regenerateSlide` 重新生成该页 SVG，作为稳定性兜底。

### 技术边界

- **渐变降级为 solid**：`linearGradient` / `radialGradient` 因 pptxgenjs 限制，翻译时取首末 stop 平均色（见 `gradient.ts` 的 `resolveFill`）。
- **path 降级为包围盒矩形**：闭合带 fill 的 `<path>` 翻译为覆盖其 bounding box 的 `rect`，保证不丢失形状占位。
- **图表约定**：SVG 内图表使用 `<g data-chart-type="bar|pie|line" data-chart-data='[...]'>`，翻译器读取 `data-chart-data` 生成 pptxgenjs 原生可编辑图表。
- **固定像素 viewBox**：所有 SVG 强制 `viewBox="0 0 1280 720"`，坐标换算为 `/1280*13.333`、 `/720*7.5` 映射到 13.333×7.5 英寸幻灯片。

## 许可

MIT
