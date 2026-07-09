# PPT Agent

轻量级 AI PPT 工作站 —— 本地运行，一键生成可编辑的 `.pptx`。

## 特性

- 🤖 **AI 生成**：输入主题即可生成完整 PPT 大纲
- 📝 **大纲编辑器**：拖拽排序，嵌套 bullet，实时预览
- 🎨 **4 套内置主题**：商务深蓝 / 极简白 / 科技紫 / 活力橙
- 📊 **原生图表**：支持柱状图/折线图/饼图，可在 PowerPoint 中编辑
- 🖼️ **AI 配图**（可选）：自动生成配图
- 📄 **文档导入**：Word / Markdown / URL → PPT
- 💾 **本地存储**：数据不出本地，隐私安全
- 🔌 **多模型支持**：OpenAI / Claude / 通义千问 / 智谱 GLM

## 截图

_（待补充）_

## 快速开始

```bash
# 依赖
pnpm install

# 开发
pnpm tauri:dev

# 构建
pnpm tauri:build
```

## 使用

1. 打开应用，点击「新建空白项目」
2. 在右侧 AI 面板输入 PPT 主题（如「Q3 业务复盘汇报」）
3. AI 自动生成大纲，在左侧可拖拽排序、调整每页布局
4. 预览满意后，点击「导出 PPT」下载 `.pptx` 文件

## 配置

前往设置页填写 LLM API Key：

| Provider | Base URL | 模型 |
|---|---|---|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o` |
| Anthropic | `https://api.anthropic.com/v1` | `claude-sonnet-4-20250514` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-max` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-plus` |

## 技术栈

- **桌面框架**：Tauri 2 + Rust
- **前端**：React 18 + TypeScript + Tailwind CSS + Vite
- **状态管理**：Zustand
- **PPT 生成**：PptxGenJS
- **LLM 接入**：OpenAI SDK（兼容多 Provider）
- **图表**：PptxGenJS 原生图表

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

## 许可

MIT