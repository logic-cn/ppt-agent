import { z } from "zod/v4";
import { NARRATIVE_MODE_IDS, VISUAL_STYLE_IDS } from "@/types/design";
import { SLIDE_LAYOUTS } from "@/types/layouts";

export const CURRENT_DECK_VERSION = 2;

const designSchema = z.object({
  mode: z.enum(NARRATIVE_MODE_IDS as [string, ...string[]]),
  visualStyle: z.enum(VISUAL_STYLE_IDS as [string, ...string[]]),
  palette: z.string(),
  canvasFormat: z.string().optional(),
  templateId: z.string().optional(),
  modeBehavior: z.string().optional(),
  visualStyleBehavior: z.string().optional(),
});

const bulletNodeSchema = z.object({
  id: z.string(),
  text: z.string(),
  level: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  children: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        level: z.union([z.literal(1), z.literal(2)]),
      }),
    )
    .optional(),
});

const slideContentItemSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  body: z.string().optional(),
});

const slideElementSchema = z.object({
  id: z.string(),
  type: z.enum(["text", "image", "chart", "shape"]),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  content: z.string().optional(),
});

const chartSpecSchema = z.object({
  type: z.enum(["bar", "pie", "line", "doughnut"]),
  title: z.string().optional(),
  data: z.array(z.object({ label: z.string(), value: z.number() })),
});

const imageSpecSchema = z.object({
  type: z.enum(["ai", "icon", "url", "web"]),
  prompt: z.string().optional(),
  url: z.string().optional(),
  alt: z.string(),
  position: z.enum(["full", "right", "background"]).optional(),
  attribution: z.string().optional(),
});

const slideSourceRefSchema = z.object({
  sourceId: z.string(),
  sectionId: z.string().optional(),
  chunkId: z.string().optional(),
  quote: z.string().optional(),
});

const metricSpecSchema = z.object({
  value: z.string(),
  unit: z.string().optional(),
  label: z.string(),
  kicker: z.string().optional(),
});

export const slideSchema = z.object({
  id: z.string(),
  layout: z.enum(SLIDE_LAYOUTS),
  title: z.string(),
  subtitle: z.string().optional(),
  body: z.string().optional(),
  bullets: z.array(bulletNodeSchema).optional(),
  items: z.array(slideContentItemSchema).optional(),
  elements: z.array(slideElementSchema).optional(),
  chart: chartSpecSchema.optional(),
  image: imageSpecSchema.optional(),
  metric: metricSpecSchema.optional(),
  quote: z.string().optional(),
  attribution: z.string().optional(),
  notes: z.string().optional(),
  sourceRefs: z.array(slideSourceRefSchema).optional(),
  // X1 链路：设计真相 SVG，必须持久化
  svg: z.string().optional(),
  // SVG 过期标记：结构化内容被编辑后为 true，提示重画同步
  svgStale: z.boolean().optional(),
});

export const deckSchema = z.object({
  id: z.string(),
  version: z.number(),
  title: z.string(),
  design: designSchema,
  transition: z.string().optional(),
  entranceAnimation: z.boolean().optional(),
  narration: z.boolean().optional(),
  slides: z.array(slideSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
  source: z
    .object({
      type: z.enum(["topic", "doc", "url"]),
      ref: z.string(),
    })
    .optional(),
});

export type ValidDeck = z.infer<typeof deckSchema>;

export interface DeckParseResult {
  success: boolean;
  data?: ValidDeck;
  error?: string;
  warnings?: string[];
  migrated?: boolean;
  futureVersion?: boolean;
}
