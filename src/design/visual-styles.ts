import type { ThemeFonts, ThemeFontSize, Spacing } from "../types/theme";

export interface VisualStyleDef {
  id: string;
  name: string;
  character: string;
  fonts: ThemeFonts;
  fontSize: ThemeFontSize;
  spacing: Spacing;
  decoration: {
    cornerRadius: number;
    shadows: boolean;
    density: "sparse" | "supportive" | "core";
  };
  pairedImageRendering: string;
}

export const VISUAL_STYLES: VisualStyleDef[] = [
  {
    id: "swiss-minimal",
    name: "瑞士极简",
    character:
      "严格网格、锐利几何、零装饰、激进留白；形状圆角 rx=0；无渐变无阴影；字重对比(900/300)而非字体对比；主色仅占极小区域。",
    fonts: {
      title: "'Source Han Sans CN', sans-serif",
      body: "'Source Han Sans CN', sans-serif",
    },
    fontSize: { h1: 44, h2: 32, body: 18, caption: 14 },
    spacing: "airy",
    decoration: { cornerRadius: 0, shadows: false, density: "sparse" },
    pairedImageRendering: "minimalist-swiss",
  },
  {
    id: "dark-tech",
    name: "暗黑科技",
    character:
      "深色画布、发光强调色、几何精密；形状圆角小(≤4)；轻微辉光但不滥用阴影；数据感强，多用线条与网格。",
    fonts: {
      title: "'Source Han Sans CN', sans-serif",
      body: "'Source Han Sans CN', sans-serif",
    },
    fontSize: { h1: 42, h2: 30, body: 18, caption: 14 },
    spacing: "comfortable",
    decoration: { cornerRadius: 4, shadows: true, density: "sparse" },
    pairedImageRendering: "digital-dashboard",
  },
  {
    id: "soft-rounded",
    name: "柔和圆角",
    character: "圆角卡片(≥12)、轻投影、亲和；留白适中；适合产品/SaaS/培训。",
    fonts: {
      title: "'Source Han Sans CN', sans-serif",
      body: "'Source Han Sans CN', sans-serif",
    },
    fontSize: { h1: 40, h2: 30, body: 18, caption: 14 },
    spacing: "comfortable",
    decoration: { cornerRadius: 12, shadows: true, density: "supportive" },
    pairedImageRendering: "flat",
  },
  {
    id: "editorial",
    name: "杂志编辑",
    character: "杂志层级、分栏与分隔线、衬线/无衬线混排；规则感强；留白克制。",
    fonts: {
      title: "'Noto Serif SC', serif",
      body: "'Source Han Sans CN', sans-serif",
    },
    fontSize: { h1: 44, h2: 32, body: 18, caption: 14 },
    spacing: "comfortable",
    decoration: { cornerRadius: 0, shadows: false, density: "supportive" },
    pairedImageRendering: "editorial",
  },
  {
    id: "blueprint",
    name: "蓝图工程",
    character: "深色纸上的示意线条、等距图、注释；几何精密；适合技术/架构。",
    fonts: {
      title: "'Source Han Sans CN', monospace",
      body: "'Source Han Sans CN', sans-serif",
    },
    fontSize: { h1: 40, h2: 30, body: 17, caption: 13 },
    spacing: "comfortable",
    decoration: { cornerRadius: 2, shadows: false, density: "supportive" },
    pairedImageRendering: "blueprint",
  },
  {
    id: "glassmorphism",
    name: "玻璃拟态",
    character:
      "半透明玻璃面板、渐变光、悬浮景深；圆角大(≥16)；适合现代 SaaS/发布会。",
    fonts: {
      title: "'Source Han Sans CN', sans-serif",
      body: "'Source Han Sans CN', sans-serif",
    },
    fontSize: { h1: 44, h2: 32, body: 18, caption: 14 },
    spacing: "comfortable",
    decoration: { cornerRadius: 16, shadows: true, density: "sparse" },
    pairedImageRendering: "glassmorphism",
  },
];

export function getVisualStyle(id: string): VisualStyleDef | undefined {
  return VISUAL_STYLES.find((s) => s.id === id);
}
