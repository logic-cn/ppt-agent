import type { SlideLayout } from "../types/deck";
import type { LayoutSpec } from "../types/theme";

const cover: LayoutSpec = {
  title: { x: 0.08, y: 0.32, w: 0.84, h: 0.22 },
  body: { x: 0.08, y: 0.58, w: 0.7, h: 0.14 },
};
const section: LayoutSpec = {
  title: { x: 0.08, y: 0.38, w: 0.84, h: 0.2 },
  body: { x: 0.08, y: 0.62, w: 0.5, h: 0.12 },
};
const content: LayoutSpec = {
  title: { x: 0.1, y: 0.1, w: 0.8, h: 0.1 },
  body: { x: 0.14, y: 0.24, w: 0.72, h: 0.64 },
};
const twoColumn: LayoutSpec = {
  title: { x: 0.08, y: 0.08, w: 0.84, h: 0.12 },
  body: { x: 0.06, y: 0.22, w: 0.42, h: 0.7 },
  visual: { x: 0.52, y: 0.22, w: 0.42, h: 0.7 },
};
const chart: LayoutSpec = {
  title: { x: 0.08, y: 0.08, w: 0.84, h: 0.12 },
  visual: { x: 0.1, y: 0.22, w: 0.8, h: 0.68 },
};
const closing: LayoutSpec = { title: { x: 0.08, y: 0.4, w: 0.84, h: 0.2 } };
const cols = (_n: number): LayoutSpec => ({
  title: { x: 0.08, y: 0.08, w: 0.84, h: 0.12 },
  body: { x: 0.06, y: 0.22, w: 0.88, h: 0.7 },
  visual: { x: 0.06, y: 0.22, w: 0.88, h: 0.7 },
});
const image: LayoutSpec = {
  title: { x: 0.08, y: 0.08, w: 0.84, h: 0.12 },
  visual: { x: 0.08, y: 0.22, w: 0.84, h: 0.7 },
};

export const LAYOUT_GEOMETRY: Record<SlideLayout, LayoutSpec> = {
  cover,
  section,
  content,
  "two-column": twoColumn,
  chart,
  closing,
  "cols-2": cols(2),
  "cols-3": cols(3),
  "cols-4": cols(4),
  "cols-5": cols(5),
  "cols-6": cols(6),
  image,
};

export function getLayoutRects(layout: SlideLayout): LayoutSpec {
  return LAYOUT_GEOMETRY[layout];
}
