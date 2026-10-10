export type NarrativeModeId =
  | "pyramid"
  | "narrative"
  | "instructional"
  | "showcase"
  | "briefing"
  | "custom";

export type VisualStyleId =
  | "swiss-minimal"
  | "dark-tech"
  | "soft-rounded"
  | "editorial"
  | "blueprint"
  | "glassmorphism"
  | "magazine-bold"
  | "ink-wash"
  | "pastel-soft"
  | "data-dense"
  | "nature-calm"
  | "mono-luxury";

export type PaletteId = string;

export interface DesignLock {
  mode: NarrativeModeId;
  visualStyle: VisualStyleId;
  palette: PaletteId;
  /** 画布格式（B5 画布格式系统）；缺省 16:9，历史 deck 兼容 */
  canvasFormat?: import("./canvas").CanvasFormatId;
  templateId?: string;
  modeBehavior?: string;
  visualStyleBehavior?: string;
}

export const NARRATIVE_MODE_IDS: NarrativeModeId[] = [
  "pyramid",
  "narrative",
  "instructional",
  "showcase",
  "briefing",
  "custom",
];
export const VISUAL_STYLE_IDS: VisualStyleId[] = [
  "swiss-minimal",
  "dark-tech",
  "soft-rounded",
  "editorial",
  "blueprint",
  "glassmorphism",
  "magazine-bold",
  "ink-wash",
  "pastel-soft",
  "data-dense",
  "nature-calm",
  "mono-luxury",
];

export function isDesignLock(v: unknown): v is DesignLock {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    NARRATIVE_MODE_IDS.includes(o.mode as NarrativeModeId) &&
    VISUAL_STYLE_IDS.includes(o.visualStyle as VisualStyleId) &&
    typeof o.palette === "string"
  );
}

export const DEFAULT_DESIGN: DesignLock = {
  mode: "briefing",
  visualStyle: "soft-rounded",
  palette: "business-blue",
};
