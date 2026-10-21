# 端侧模型无头实跑

真实加载内置端侧模型（MiniCPM5）跑完整生成管线，验证那些**只在 mock
provider 下测过**的质量能力：跨页版式轮换、演讲者备注、导出锁、可编辑导出。

桌面端里推理走 Tauri IPC（`local_llm_chat` 命令）；这里没有 GUI，于是加一个
无头推理侧 `src-tauri/src/bin/llm_headless.rs`——它复用**同一个**
`generate()` 函数与同一套 grammar 约束，只是把结果以行 JSON 暴露给 Node 侧
的管线脚本。因此实跑路径与桌面端路径的采样行为完全一致。

## 用法

前置：模型已下载（应用数据目录 `models/`，或用 `PPT_LOCAL_MODEL` 指定 `.gguf`）。

```bash
# 默认 6 页，主题为内置默认
npx vitest run --config vitest.local.config.ts

# 指定页数 / 主题 / 模型 / 上下文
PPT_LOCAL_PAGES=8 \
PPT_LOCAL_TOPIC="2026 年企业级 AI 落地进展与下一步规划" \
PPT_LOCAL_MODEL=~/Library/Application\ Support/com.pptagent.app/models/MiniCPM5-2B-Q4_K_M.gguf \
PPT_LOCAL_CTX=8192 \
npx vitest run --config vitest.local.config.ts
```

链路是分钟级（2B 模型约 1 分钟/页），因此**不进 CI**：主 `vitest.config.ts`
已把 `scripts/**` 排除，用独立的 `vitest.local.config.ts` 运行。

## 产物

落在 `dist/local-e2e/<时间戳>/`：

| 文件 | 内容 |
| --- | --- |
| `deck.json` | 生成的完整 deck（含每页 SVG 与备注） |
| `page-NN.svg` | 每页设计真相 SVG |
| `deck.pptx` | 导出的 PPTX（原生可编辑对象） |
| `report.json` | 实跑报告：逐页体检 + 质量 findings + 导出锁结论 |

## 验收项

- 每页都产出设计真相 SVG（失败页会被 `isolatePageFailures` 隔离）
- 过半页面带有演讲者备注
- 相邻正文页列数不完全相同（跨页整宽↔双栏轮换生效）
- 导出的 pptx 非空
