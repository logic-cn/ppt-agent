# PPT Agent

轻量级 AI PPT 工作站 —— 本地运行，一键生成可编辑的 `.pptx`。

## 特性

- 🤖 **AI 生成**：输入主题即可生成完整 PPT 大纲
- 🎛️ **生成参数控制**：场景 / 语气 / 信息密度 / 目标受众 / 图表倾向 / 页数，生成前精细约束 AI 输出
- 📝 **大纲编辑器**：拖拽排序，嵌套 bullet，实时预览
- 🎨 **设计系统**：12 套内置色板 × 12 种视觉风格，支持自定义色板
- 📊 **原生图表**：支持柱状图/折线图/饼图，可在 PowerPoint 中编辑
- 🖼️ **配图**（可选）：Openverse 开放授权图片搜索，属性检查器内一键应用到页面
- 📄 **文档导入**：Word / Markdown / PDF / URL → PPT
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

## 自动更新与发布

应用已接入 Tauri updater（设置 → 通用 → 关于与更新，可检查并安装更新）。发布由 tag 驱动：

1. **同步版本号**：`package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 三处保持一致。
2. **配置仓库 Secrets**（Settings → Secrets and variables → Actions）：
   - `TAURI_SIGNING_PRIVATE_KEY`：签名私钥文件内容（`src-tauri/updater.key`，已 gitignore）
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`：私钥密码
3. **推送 tag**：`git tag v0.1.0 && git push origin v0.1.0`。
4. **检查 draft release**：`.github/workflows/release.yml` 会构建 macOS（arm64 / x86_64）、Linux、Windows 产物，签名 updater 包，上传 `.sig` 与 `latest.json`，并创建 draft release。确认产物无误后手动发布。

> **签名密钥从哪来**：`src-tauri/updater.key` 的完整内容就是 `TAURI_SIGNING_PRIVATE_KEY`。建议用 `gh secret set TAURI_SIGNING_PRIVATE_KEY < src-tauri/updater.key` 直接写入，避免密钥出现在终端；也可用 `pbcopy < src-tauri/updater.key` 复制后粘贴到 GitHub Secrets。密码是执行 `pnpm tauri signer generate` 时设置的，不会存进密钥文件，需从密码保管处获取；用 `gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 交互式录入。若密码遗失，可在首次正式发布前轮换密钥对：备份旧文件后执行 `pnpm tauri signer generate -w src-tauri/updater.key -f`，把新公钥写入 `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`，再更新两个 Secrets。已发布后轮换密钥会导致旧版本无法验证新更新。

发布后，更新端点为 `https://github.com/logic-cn/ppt-agent/releases/latest/download/latest.json`；其中 `version` 高于当前安装版本时，用户端即可检测到更新。

本地手动签名构建：

```bash
export TAURI_SIGNING_PRIVATE_KEY_PATH=src-tauri/updater.key
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD='<密钥密码>'
pnpm tauri:build
```

> 国内分发可在 `src-tauri/tauri.conf.json` 的 `plugins.updater.endpoints` 中增加指向自有 CDN/OSS 的 `latest.json` 地址；公钥（`pubkey`）不变。

## 使用

1. 打开应用，点击「新建空白项目」
2. 在右侧 AI 面板输入 PPT 主题（如「Q3 业务复盘汇报」）
3. 需要更精细的控制时，点开输入框上方的「选项」面板，设置场景（业务复盘 / 融资路演 / 培训等）、语气（正式 / 咨询风等）、信息密度、目标受众、图表倾向与页数，再发送主题
4. AI 自动生成大纲，在左侧可拖拽排序、调整每页布局
5. 预览满意后，点击「导出 PPT」下载 `.pptx` 文件

## 配置

**默认无需任何配置**：应用内置端侧小模型（见下节「内置端侧小模型」），首次生成时自动下载模型即可离线使用。若要接入更强的云端大模型，前往设置页填写 LLM API Key：

| Provider  | Base URL                                            | 模型                       |
| --------- | --------------------------------------------------- | -------------------------- |
| OpenAI    | `https://api.openai.com/v1`                         | `gpt-4o`                   |
| Anthropic | `https://api.anthropic.com/v1`                      | `claude-sonnet-4-20250514` |
| 通义千问  | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-max`                 |
| 智谱 GLM  | `https://open.bigmodel.cn/api/paas/v4`              | `glm-4-plus`               |

## 内置端侧小模型

不配置任何 API Key，应用默认使用进程内嵌的 llama.cpp（CPU 推理）驱动 **MiniCPM5** 端侧模型，端到端生成 PPT；效果不满意时可随时切换外部大模型。

- **档位**：
  | 档位 | 模型 | 量化 | 体积 | 建议物理内存 | 上下文 |
  | --- | --- | --- | --- | --- | --- |
  | 标准（推荐） | MiniCPM5-2B | Q4_K_M | ~1.45 GB | ≥ 8 GB | 16K |
  | 极速（低配） | MiniCPM5-1B | Q4_K_M | ~0.64 GB | ≥ 4 GB | 8K |
- **分发**：首次使用时按需下载（ModelScope 主源、hf-mirror 备源，自动故障切换），支持断点续传与 sha256 完整性校验；模型存放于应用数据目录 `models/`，可在设置页「本地模型」中下载 / 删除 / 切换档位。安装包不携带模型权重。
- **链路**：本地模型走与云端完全相同的生成管线（pagePlan → 逐页 SVG 直出 → 原生 PPTX 翻译）；结构化环节（页面规划）使用 llama.cpp **grammar 约束解码**保证 JSON 100% 合法；本地档自动启用精简提示词（单例 few-shot、截断形状/图标词汇表）降低 prefill 开销，单页软超时放宽到 5 分钟。
- **性能参考**：Apple Silicon 实测 MiniCPM5-2B 约 40–45 tok/s（限 2 线程几乎无差，小模型受内存带宽约束）；一页 SVG（约 2–3K token）约 1 分钟，10 页 deck 约 10–15 分钟。低端 x86 笔记本预计 1.5–5 分钟/页，建议用极速档。
- **许可与署名**：MiniCPM5 采用 Apache-2.0（© OpenBMB）；推理引擎 llama.cpp / ggml 采用 MIT。模型下载完成后完整许可声明写入模型目录 `<文件名>.LICENSE.txt`，设置页「关于」含第三方清单。
- **调试旋钮**：环境变量 `PPT_LOCAL_THREADS` 可限定推理线程数（基准测试模拟低配机用）。
- **限制**：本地档为非多模态模型，视觉自检自动跳过；图片搜索、联网补料等依赖网络的功能不受影响但非必需。
- **无头实跑**：`scripts/local-e2e/` 提供无 GUI 的端到端实跑（真实加载模型 → 真实生成多页 deck → 导出 pptx → 输出验收报告），用于验证端侧小模型下的质量能力（版式轮换 / 演讲备注 / 导出锁）。模型需先下载好，用法见该目录说明；该链路为分钟级手动工具，不进 CI。

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
pnpm test             # 全量测试 + 覆盖率阈值
pnpm typecheck        # 类型检查
pnpm format:check     # 格式检查
pnpm build            # 前端构建
```

## 持续集成

`.github/workflows/ci.yml` 在推送到 `main` 和 Pull Request 时依次执行 `format:check`、`typecheck`、`test`（含覆盖率阈值）与前端构建；发布流程见上文「自动更新与发布」。

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

- **渐变近似**：`linearGradient` / `radialGradient` 因 pptxgenjs 限制，翻译为分段色块/平均色近似（见 `gradient.ts` 的 `resolveFill`）。
- **path 优先原生形状**：可识别的 circle / ellipse / 圆角矩形 / line 映射为 pptx 原生形状；无法识别的闭合 `<path>` 降级为 bounding box 矩形，保证不丢失占位。
- **图表约定**：SVG 内图表使用 `<g data-chart-type="bar|pie|line" data-chart-data='[...]'>`，翻译器读取 `data-chart-data` 生成 pptxgenjs 原生可编辑图表。
- **固定像素 viewBox**：所有 SVG 强制 `viewBox="0 0 1280 720"`，坐标换算为 `/1280*13.333`、 `/720*7.5` 映射到 13.333×7.5 英寸幻灯片。

## 许可

MIT
