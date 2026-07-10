import type { SlideLayout, ChartType } from "./deck";

export interface TemplateBullet {
  text: string;
  level: number;
  children?: { text: string; level: number }[];
}

export interface TemplateSlide {
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  bullets?: TemplateBullet[];
  body?: string;
  items?: { title?: string; bullets?: string[]; body?: string }[];
  chart?: {
    type: ChartType;
    title?: string;
    data: { label: string; value: number }[];
  };
  image?: { type: "icon" | "url"; url?: string; alt: string };
  notes?: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  scenario: string;
  suggestedTheme?: string;
  suggestedPageCount: number;
  slides: TemplateSlide[];
}

// --- P2: TemplatePack 升级 ---

export interface GenerationOptions {
  topic: string;
  audience?: string;
  scenario?: "business_review" | "pitch" | "training" | "market_analysis" | "proposal" | "custom";
  pageCount?: number;
  tone?: "formal" | "consulting" | "concise" | "storytelling";
  density?: "low" | "medium" | "high";
  includeCharts?: boolean;
  includeImages?: boolean;
  language?: "zh-CN" | "en-US";
  /** 模板结构上下文——注入 LLM 后引导生成遵循模板编排 */
  contextualPrompt?: string;
}

export interface TemplatePack {
  id: string;
  name: string;
  description: string;
  scenario: string;
  suggestedTheme: string;
  defaultOptions: GenerationOptions;
  slides: TemplateSlide[];
  promptHints?: string[];
  qualityRules?: string[];
}

export interface TemplateSlidePlan {
  role: "cover" | "agenda" | "insight" | "analysis" | "chart" | "summary" | "closing";
  suggestedLayout: SlideLayout;
  instruction: string;
}

export interface TemplateGenerationContext {
  templateId: string;
  defaultOptions: GenerationOptions;
  slidePlan: TemplateSlidePlan[];
  promptHints: string[];
}
