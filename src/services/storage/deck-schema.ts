import { z } from "zod/v4";

export const CURRENT_DECK_VERSION = 2;

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
  type: z.enum(["ai", "icon", "url"]),
  prompt: z.string().optional(),
  url: z.string().optional(),
  alt: z.string(),
  position: z.enum(["full", "right", "background"]).optional(),
});

const slideSourceRefSchema = z.object({
  sourceId: z.string(),
  sectionId: z.string().optional(),
  chunkId: z.string().optional(),
  quote: z.string().optional(),
});

const slideSchema = z.object({
  id: z.string(),
  layout: z.enum([
    "cover", "section", "content", "two-column", "chart", "image",
    "closing", "cols-2", "cols-3", "cols-4", "cols-5", "cols-6",
  ]),
  title: z.string(),
  subtitle: z.string().optional(),
  body: z.string().optional(),
  bullets: z.array(bulletNodeSchema).optional(),
  items: z.array(slideContentItemSchema).optional(),
  elements: z.array(slideElementSchema).optional(),
  chart: chartSpecSchema.optional(),
  image: imageSpecSchema.optional(),
  notes: z.string().optional(),
  sourceRefs: z.array(slideSourceRefSchema).optional(),
});

export const deckSchema = z.object({
  id: z.string(),
  version: z.number(),
  title: z.string(),
  themeId: z.string(),
  themeOverrides: z.record(z.string(), z.unknown()).optional(),
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
