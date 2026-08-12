import { z } from "zod/v4";
import { SLIDE_LAYOUTS } from "@/types/layouts";

const bulletNodeDraftSchema = z.object({
  text: z.string(),
  level: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  children: z
    .array(
      z.object({
        text: z.string(),
        level: z.union([z.literal(1), z.literal(2)]),
      }),
    )
    .optional(),
});

const slideContentItemDraftSchema = z.object({
  title: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  body: z.string().optional(),
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

const metricSpecSchema = z.object({
  value: z.string(),
  unit: z.string().optional(),
  label: z.string(),
  kicker: z.string().optional(),
});

const slideLayoutSchema = z.enum(SLIDE_LAYOUTS);

const slideDraftSchema = z.object({
  layout: slideLayoutSchema,
  title: z.string(),
  subtitle: z.string().optional(),
  body: z.string().optional(),
  bullets: z.array(bulletNodeDraftSchema).optional(),
  items: z.array(slideContentItemDraftSchema).optional(),
  chart: chartSpecSchema.optional(),
  image: imageSpecSchema.optional(),
  metric: metricSpecSchema.optional(),
  quote: z.string().optional(),
  attribution: z.string().optional(),
  notes: z.string().optional(),
});

const slidePatchSchema = z.object({
  layout: slideLayoutSchema.optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  body: z.string().optional(),
  bullets: z.array(bulletNodeDraftSchema).optional(),
  items: z.array(slideContentItemDraftSchema).optional(),
  elements: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["text", "image", "chart", "shape"]),
        x: z.number(),
        y: z.number(),
        w: z.number(),
        h: z.number(),
        content: z.string().optional(),
      }),
    )
    .optional(),
  chart: chartSpecSchema.optional(),
  image: imageSpecSchema.optional(),
  metric: metricSpecSchema.optional(),
  quote: z.string().optional(),
  attribution: z.string().optional(),
  notes: z.string().optional(),
});

export const deckPatchSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_deck_title"), title: z.string() }),
  z.object({
    op: z.literal("insert_slide"),
    index: z.number(),
    slide: slideDraftSchema,
  }),
  z.object({ op: z.literal("delete_slide"), slideId: z.string() }),
  z.object({
    op: z.literal("move_slide"),
    slideId: z.string(),
    toIndex: z.number(),
  }),
  z.object({
    op: z.literal("update_slide"),
    slideId: z.string(),
    patch: slidePatchSchema,
  }),
  z.object({
    op: z.literal("replace_slide"),
    slideId: z.string(),
    slide: slideDraftSchema,
  }),
  z.object({
    op: z.literal("split_slide"),
    slideId: z.string(),
    slides: z.array(slideDraftSchema).min(2),
  }),
  z.object({
    op: z.literal("merge_slides"),
    slideIds: z.array(z.string()).min(2),
    slide: slideDraftSchema,
  }),
]);

export const deckPatchesResponseSchema = z.object({
  patches: z.array(deckPatchSchema),
});
