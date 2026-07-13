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
  | "glassmorphism";

export type PaletteId = string;

export interface DesignLock {
  mode: NarrativeModeId;
  visualStyle: VisualStyleId;
  palette: PaletteId;
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
