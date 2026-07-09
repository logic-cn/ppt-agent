import type { Theme } from "./theme";

export type SlideLayout =
  | "cover"
  | "section"
  | "content"
  | "two-column"
  | "chart"
  | "image"
  | "closing";

export type ChartType = "bar" | "pie" | "line" | "doughnut";

export type ImagePosition = "full" | "right" | "background";
export type ImageSource = "ai" | "icon" | "url";

export interface BulletNode {
  id: string;
  text: string;
  level: 0 | 1 | 2;
  children?: BulletNode[];
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ChartSpec {
  type: ChartType;
  title?: string;
  data: ChartDataPoint[];
}

export interface ImageSpec {
  type: ImageSource;
  prompt?: string;
  url?: string;
  alt: string;
  position?: ImagePosition;
}

export interface SlideElement {
  id: string;
  type: "text" | "image" | "chart" | "shape";
  x: number;
  y: number;
  w: number;
  h: number;
  content?: string;
}

export interface Slide {
  id: string;
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  body?: string;
  bullets?: BulletNode[];
  elements?: SlideElement[];
  chart?: ChartSpec;
  image?: ImageSpec;
  notes?: string;
}

export type DeckSource = "topic" | "doc" | "url";

export interface Deck {
  id: string;
  version: number;
  title: string;
  themeId: string;
  themeOverrides?: Partial<Theme>;
  slides: Slide[];
  createdAt: number;
  updatedAt: number;
  source?: { type: DeckSource; ref: string };
}

export interface DeckMeta {
  id: string;
  title: string;
  slidesCount: number;
  createdAt: number;
  updatedAt: number;
}
