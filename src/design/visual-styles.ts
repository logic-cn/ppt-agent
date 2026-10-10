import type { ThemeFonts, ThemeFontSize, Spacing } from "../types/theme";
import type { VisualStyleId } from "../types/design";

export interface VisualStyleDef {
  id: VisualStyleId;
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
  {
    id: "magazine-bold",
    name: "杂志大标",
    character:
      "超大字号标题占画面主体、强字重对比、大色块切版；文字即图形，装饰极少。",
    fonts: {
      title: "'Source Han Sans CN Heavy', 'Noto Serif SC', serif",
      body: "'Source Han Sans CN', sans-serif",
    },
    fontSize: { h1: 64, h2: 40, body: 18, caption: 14 },
    spacing: "airy",
    decoration: { cornerRadius: 0, shadows: false, density: "sparse" },
    pairedImageRendering: "editorial",
  },
  {
    id: "ink-wash",
    name: "东方水墨",
    character:
      "宣纸底、墨色文字、留白即构图；细线分隔、印章式一点朱色；衬线标题，气息疏朗。",
    fonts: {
      title: "'Noto Serif SC', serif",
      body: "'Noto Serif SC', serif",
    },
    fontSize: { h1: 46, h2: 32, body: 18, caption: 14 },
    spacing: "airy",
    decoration: { cornerRadius: 2, shadows: false, density: "sparse" },
    pairedImageRendering: "ink-wash",
  },
  {
    id: "pastel-soft",
    name: "粉彩轻盈",
    character:
      "低饱和粉彩底、大圆角(≥20)软卡片、无硬阴影；间距宽松，语气亲和，适合科普/培训。",
    fonts: {
      title: "'Source Han Sans CN', sans-serif",
      body: "'Source Han Sans CN', sans-serif",
    },
    fontSize: { h1: 38, h2: 28, body: 18, caption: 14 },
    spacing: "airy",
    decoration: { cornerRadius: 20, shadows: true, density: "supportive" },
    pairedImageRendering: "flat",
  },
  {
    id: "data-dense",
    name: "咨询密集",
    character:
      "信息密度优先：多栏小字号、细网格表格、脚注级数据源；装饰让位于数据对齐与标尺。",
    fonts: {
      title: "'Source Han Sans CN', sans-serif",
      body: "'Source Han Sans CN', sans-serif",
    },
    fontSize: { h1: 34, h2: 26, body: 16, caption: 12 },
    spacing: "compact",
    decoration: { cornerRadius: 2, shadows: false, density: "core" },
    pairedImageRendering: "minimalist-swiss",
  },
  {
    id: "nature-calm",
    name: "自然沉静",
    character: "灰绿自然色系、柔和分节、留白充分；低对比不刺眼，适合长文阅读型汇报。",
    fonts: {
      title: "'Noto Serif SC', serif",
      body: "'Source Han Sans CN', sans-serif",
    },
    fontSize: { h1: 42, h2: 30, body: 18, caption: 14 },
    spacing: "airy",
    decoration: { cornerRadius: 8, shadows: false, density: "sparse" },
    pairedImageRendering: "editorial",
  },
  {
    id: "mono-luxury",
    name: "单色高级",
    character:
      "近黑白灰单色、极细线与大量留白、字距拉开；克制到近乎冷淡，适合品牌/发布场合。",
    fonts: {
      title: "'Noto Serif SC', serif",
      body: "'Source Han Sans CN', sans-serif",
    },
    fontSize: { h1: 48, h2: 32, body: 17, caption: 13 },
    spacing: "airy",
    decoration: { cornerRadius: 0, shadows: false, density: "sparse" },
    pairedImageRendering: "editorial",
  },
];

export function getVisualStyle(id: VisualStyleId): VisualStyleDef | undefined {
  return VISUAL_STYLES.find((s) => s.id === id);
}
