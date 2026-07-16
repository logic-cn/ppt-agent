import { runJob } from "@/store/job";
import { generateImage } from "@/services/image";
import { exportDeck, exportDeckToBlob } from "@/engine/pptx";
import type { Deck, Slide } from "@/types/deck";
import type { DesignLock } from "@/types/design";
import type { ImageGenRequest } from "@/types/llm";
import { DEFAULT_DESIGN } from "@/types/design";
import { buildDeckSvgs } from "@/engine/svg/pipeline";

export function runOutlineGeneration(params: {
  topic: string;
  design: DesignLock;
  audience?: string;
  pageCount?: number;
  docContent?: string;
  signal?: AbortSignal;
  contextualPrompt?: string;
}): Promise<Slide[]> {
  return runJob(
    { type: "outline.generate", title: "生成大纲", canCancel: true },
    async (job) => {
      job.update({ progress: 0.2, message: "正在请求 AI…" });
      // X1 管线：用 buildDeckSvgs 生成 svg 设计真相（构造临时 deck 供对齐页数）
      const tempDeck: Deck = {
        id: "x1-temp",
        title: params.topic,
        design: params.design ?? DEFAULT_DESIGN,
        slides: [],
        version: 2,
        createdAt: 0,
        updatedAt: 0,
      };
      const newDeck = await buildDeckSvgs(
        tempDeck,
        params.design ?? DEFAULT_DESIGN,
        {
          topic: params.topic,
          audience: params.audience,
          pageCount: params.pageCount,
          docContent: params.docContent,
          signal: job.signal,
        },
      );
      job.update({ progress: 0.8, message: "校验完成" });
      return newDeck.slides;
    },
  );
}

export function runImageGeneration(params: {
  req: ImageGenRequest;
  slideTitle: string;
  design?: DesignLock;
}): Promise<{ url: string; revisedPrompt?: string }> {
  return runJob(
    {
      type: "image.generate",
      title: `生成配图「${params.slideTitle}」`,
      canCancel: true,
    },
    async (job) => {
      job.update({ progress: 0.3, message: "正在生成图片…" });
      const result = await generateImage(
        params.req,
        params.design ?? DEFAULT_DESIGN,
        job.signal,
      );
      job.update({ progress: 0.9, message: "图片生成完成" });
      return result;
    },
  );
}

export function runPptxExport(params: {
  deck: Deck;
  savePath?: string;
}): Promise<void> {
  return runJob(
    { type: "pptx.export", title: `导出「${params.deck.title}」` },
    async (job) => {
      job.update({ progress: 0.3, message: "正在生成 PPTX…" });
      if (params.savePath) {
        await exportDeck(params.deck, params.savePath);
      } else {
        const blob = await exportDeckToBlob(params.deck);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${params.deck.title}.pptx`;
        a.click();
        URL.revokeObjectURL(url);
      }
      job.update({ progress: 1, message: "导出完成" });
    },
  );
}
