import { useSettingsStore } from "@/store/settings";
import type { ImageGenRequest, ImageGenResponse } from "@/types/llm";
import type { DesignLock } from "@/types/design";
import { getVisualStyle } from "@/design/visual-styles";
import { getPalette } from "@/design/palettes";
import { httpRequest } from "@/services/http-client";
import { decideRecovery } from "@/services/recovery";

export function buildImagePrompt(subject: string, design: DesignLock): string {
  const style = getVisualStyle(design.visualStyle)!;
  const palette = getPalette(design.palette)!;
  return `为${subject}生成插画，渲染风格=${style.pairedImageRendering}；配色仅用主色${palette.colors.primary}与强调色${palette.colors.accent}，保持与整份演示一致；扁平/无文字。`;
}

/**
 * 调用 OpenAI DALL-E 兼容的文生图 API。
 * 默认使用当前 LLM provider 的 baseUrl 和 key。
 * 如果 settings.imageProvider 有配置则优先使用。
 */
export async function generateImage(
  req: ImageGenRequest,
  design: DesignLock,
  signal?: AbortSignal,
): Promise<ImageGenResponse> {
  const { settings } = useSettingsStore.getState();
  const cfg =
    settings.imageProvider ?? settings.providers[settings.activeProvider];

  if (!cfg?.apiKey) {
    throw new Error("未配置图片生成 API Key，请前往设置页开启 AI 配图功能。");
  }

  const body = {
    model: cfg.model || "dall-e-3",
    prompt: buildImagePrompt(req.prompt, design),
    n: 1,
    size: req.size ?? "1024x1024",
  };

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= 2; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(1000 * 2 ** attempt, 8000);
      await new Promise((r) => setTimeout(r, delay));
    }
    try {
      const res = await httpRequest(`${cfg.baseUrl}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "未知错误");
        if (decideRecovery("image", attempt) === "retry") {
          lastError = new Error(`图片生成失败: ${err}`);
          continue;
        }
        // 降级为占位图，避免中断整份演示
        return { url: "", placeholder: true };
      }

      const data = await res.json();
      return {
        url: data.data?.[0]?.url ?? "",
        revisedPrompt: data.data?.[0]?.revised_prompt,
      };
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      if (decideRecovery("image", attempt, e) === "retry") {
        lastError = e instanceof Error ? e : new Error(String(e));
        continue;
      }
      return { url: "", placeholder: true };
    }
  }
  throw lastError ?? new Error("图片生成重试失败");
}
