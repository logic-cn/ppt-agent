import type { ChartSpec, SlideSourceRef } from "@/types/deck";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextStyle {
  fontSize: number;
  fontFamily: string;
  color: string;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
}

export interface RichTextRun {
  text: string;
  style?: Partial<TextStyle>;
}

export interface ChartStyle {
  showLegend: boolean;
  showTitle: boolean;
  colors: string[];
}

export interface RenderBaseNode {
  id: string;
  rect: Rect;
  zIndex?: number;
}

export interface RenderTextNode extends RenderBaseNode {
  type: "text";
  text: string | RichTextRun[];
  style: TextStyle;
  overflow: "fit" | "clip" | "shrink";
}

export interface RenderShapeNode extends RenderBaseNode {
  type: "shape";
  shape: "rect" | "line" | "circle";
  fill?: string;
  stroke?: string;
  radius?: number;
}

export interface RenderImageNode extends RenderBaseNode {
  type: "image";
  src?: string;
  alt: string;
  fit: "cover" | "contain" | "fill";
}

export interface RenderChartNode extends RenderBaseNode {
  type: "chart";
  chart: ChartSpec;
  style: ChartStyle;
}

export interface RenderGroupNode extends RenderBaseNode {
  type: "group";
  children: RenderNode[];
}

export type RenderNode =
  | RenderTextNode
  | RenderShapeNode
  | RenderImageNode
  | RenderChartNode
  | RenderGroupNode;

export interface RenderSlide {
  id: string;
  background: string;
  nodes: RenderNode[];
  notes?: string;
  sourceRefs?: SlideSourceRef[];
}
