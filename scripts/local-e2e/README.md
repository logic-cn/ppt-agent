# 端侧模型无头实跑

真实加载内置端侧模型（MiniCPM5）跑完整生成管线，验证那些**只在 mock
provider 下测过**的质量能力：跨页版式轮换、演讲者备注、导出锁、可编辑导出。

桌面端里推理走 Tauri IPC（`local_llm_chat` 命令）；这里没有 GUI，于是加一个
无头推理侧 `src-tauri/src/bin/llm_headless.rs`——它复用**同一个**
`generate()` 函数与同一套 grammar 约束，只是把结果以行 JSON 暴露给 Node 侧
的管线脚本。因此实跑路径与桌面端路径的采样行为完全一致。

**取消链路**也与桌面端对齐：provider 在页面超时/用户取消时发起
`local_llm_cancel`，harness 把它转换为 stdio 协议的 `{"cancel":true}`，
推理侧读线程置位取消标记、`generate` 逐 token 检查点尽快收尾——失控生成
不再占住串行队列直到自然结束（第 5 轮实测曾阻塞 25 分钟并顶穿测试总时限）。

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

> **宿主挂起与墙钟时限**：progress.log 的时间戳是墙钟（`Date.now`），而推理侧
> `llm_headless` 的耗时是单调钟（`Instant`）。若宿主在运行中途被挂起（虚拟机/
> 系统睡眠），墙钟会出现大段"空洞"而单调钟连续——诊断停滞问题时先对比两者，
> 不要把挂起误判为管线卡死。默认 60 分钟测试时限按墙钟计，宿主频繁挂起时可用
> `--testTimeout=10800000 --hookTimeout=10800000` 放宽。

## 产物

落在 `dist/local-e2e/<时间戳>/`：

| 文件 | 内容 |
| --- | --- |
| `deck.json` | 生成的完整 deck（含每页 SVG 与备注） |
| `page-NN.svg` | 每页设计真相 SVG |
| `deck.pptx` | 导出的 PPTX（原生可编辑对象） |
| `report.json` | 实跑报告：逐页体检 + 质量 findings（含页归属）+ 导出锁结论 |
| `progress.log` | 每次请求的 prompt/生成 token、耗时与进度流水 |

`report.json` 的结构化度量（2026-11-03 起）：

| 字段 | 内容 |
| --- | --- |
| `requestedPages` / `planPageCount` / `pageCount` | 页数对账三联：请求页数、pagePlan 产出页数、deck 页数（有严格断言，偏差即回归） |
| `requestStats` | 请求数、重画/续写轮数（请求数 − plan 1 次 − 页数）、总 token 与 tok/s |
| `notesStats` | 备注覆盖页数与字数 min/max/avg |
| `contentMissingPages` | 内容必现性 deck 级复核（生成环已逐页强制，此处对账） |
| `findings[].page` | 质量发现项的页码归属（此前只有正文文案，定位问题要翻 deck） |
| `qualityScore` | 0-100 质量分 |

## 验收项

- 每页都产出设计真相 SVG（失败页会被 `isolatePageFailures` 隔离）
- **页数对账：pagePlan 页数与 deck 页数都必须精确等于请求页数**（grammar 锁页数是确定性能力）
- 过半页面带有演讲者备注
- 相邻正文页列数不完全相同（跨页整宽↔双栏轮换生效）
- 导出的 pptx 非空
