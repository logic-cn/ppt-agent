# PowerPoint ↔ SVG 映射指南

本指南逐条记录 ppt-agent 的 X1 管线今天把「项目规范化 SVG」翻译为 PowerPoint
原生对象的真实能力边界——哪些是 1:1 原生映射、哪些是确定性近似、哪些是
**有意的排除**。这里的空白是已定的决定或已知的近似，不是被遗忘的欠账。
参照 [PPT Master 的同名文档](https://github.com/hugohe3/ppt-master/blob/main/docs/zh/powerpoint-svg-mapping.md)的诚实记录方式。

管线：Deck JSON + DesignLock → `pagePlan` → 逐页 SVG（设计真相）→
`svg_to_pptx`（PptxGenJS 翻译）→ 原生 DrawingML。预览与导出消费同一份 SVG，
预览即所得（近似处除外，逐条列于下表）。

## 原生映射（1:1，PowerPoint 内完全可编辑）

| SVG | PPTX | 备注 |
|---|---|---|
| `<rect>` | 形状 | `rx>0` 映射 roundRect + rectRadius |
| `<circle>` / `<ellipse>` | 椭圆 | 含 path 识别出的圆/椭圆 |
| `<line>` | 直线 | |
| `<text>` / `<tspan>` | 文本框 | 逐样式段一个 run，同框内联混排；`text-anchor` 对齐映射 |
| `<g data-chart-type data-chart-data>` | **原生数据图表** | addChart 生成带数据源的 Chart 对象，PowerPoint 里可「编辑数据」——默认开启，与 PPT Master 的 opt-in 路线相反（换取可编辑性，接受跨渲染器布局差异） |
| `<rect\|path data-prst>` | 原生预设形状 | 13 种：chevron / homePlate / 四向箭头 / triangle / diamond / hexagon / trapezoid / parallelogram / star5 / flowChartTerminator |
| `<image href="data:...">` | 内嵌图片 | 仅接受 data URL（见有意排除） |
| 纯色 fill / stroke | 填充 / 描边 | 含 `fill-opacity` / `opacity` → transparency |
| 线性渐变（矩形） | 纵向分段色块近似 | 每 stop 一段插值色 + 描边线框叠加 |
| `translate` / `rotate` | 位移 / 包围盒旋转近似 | 旋转取轴对齐上界 |

## 确定性近似（导出可用，视觉与浏览器渲染存在已知偏差）

| SVG | 处理方式 | 偏差说明 |
|---|---|---|
| 非线性渐变 / 渐变+圆角矩形 | 取 stop 中点插值色作纯色 | 渐变观感降级为单色 |
| 无法识别的 `<path>` | 包围盒矩形降级 | 建议改用 data-prst 词表；`classifyPath` 已识别圆/椭圆/圆角矩形/直线 |
| `polygon` / `polyline` | 包围盒矩形 / 折线 | 多边形顶点形状丢失 |
| `scale` / `matrix` / `skew` | 忽略（仅 translate/rotate 参与换算） | 变换后的形状按原尺寸落位 |
| 文本基线 → 文本框 | 0.78 上伸比例换算框顶 | 单行 wrap:false；与浏览器排版存在 ±像素级差异 |
| 字号 | px × 0.75 → pt | 字号锚点（±2px 容差）由生成端约束、检查器校验 |
| 字体 | fontFace 透传 | 不嵌入字体文件（PptxGenJS 限制）：目标机器需装有对应字体，否则回退系统字体 |

## 有意的排除（不是缺口，是决定）

| 能力 | 状态 | 理由 |
|---|---|---|
| 外部图片 URL | 排除 | 导出必须离线、确定、可复现；网络图片经搜图面板内嵌为 data URL |
| `<a>` 超链接 | 未实现 | 当前用户画像无此诉求；SVG 契约同步禁止 |
| 转场 / 对象动画 | 未实现 | 工程量大，优先级低于生成质量；见路线图 |
| OMML 公式 | 未实现 | 同上 |
| 真·母版视觉层 | 部分 | `PPT_AGENT_MASTER` 已携带品牌背景/强调条/页码字段，但页面全幅内容覆盖其上——价值在 PowerPoint 母版视图与删除背景后可见 |
| SmartArt / 视频 / 宏 | 排除 | 与 PPT Master 同立场：跨渲染器退化正是要规避的问题 |
| 多栏文本流 / 文字绕图 | 未实现 | PptxGenJS 无对应模型；长文本按行手排 |

## 画布格式

SVG viewBox 是页面几何唯一真值，PPTX 版面英寸 = 像素 / 96：

| 格式 | viewBox | 版面 |
|---|---|---|
| PPT 16:9（默认） | 1280×720 | 13.333×7.5 in |
| 小红书 3:4 | 1080×1440 | 11.25×15 in |
| 方图 1:1 | 1080×1080 | 11.25×11.25 in |

注意：render-ir 回退渲染（无 SVG 的历史页）仅支持 16:9。

## 质量与一致性闸门

- 每页：几何越界 / 内容必现性 / 图表数据完整 / 预设形状合法（error 阻断 → 重画）
- 跨页（early gate，前 5 页 cohort）：配色/字体越锁、字号锚点偏离
- 导入场景：图表数值与来源原文比对（`chart_data_unverified` soft 项）
- 导出前：deck 质量检查（cover/closing/重复标题/空图表/页数偏差…）

## 更新本指南的约定

改动 translator 能力（新增映射、新增近似、新增排除）时必须同步更新此表，
并保持「诚实」：近似写近似，排除写排除。
