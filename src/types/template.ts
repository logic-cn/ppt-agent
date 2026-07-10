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
  suggestedTheme?: string;
  suggestedPageCount: number;
  slides: TemplateSlide[];
}
