import { useSettingsStore } from "@/store/settings";
import type { ImageGenRequest, ImageGenResponse } from "@/types/llm";
import { httpRequest } from "@/services/http-client";

/**
 * 调用 OpenAI DALL-E 兼容的文生图 API。
 * 默认使用当前 LLM provider 的 baseUrl 和 key。
 * 如果 settings.imageProvider 有配置则优先使用。
 */
export async function generateImage(
  req: ImageGenRequest,
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
    prompt: req.prompt,
    n: 1,
    size: req.size ?? "1024x1024",
  };

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
    throw new Error(`图片生成失败: ${err}`);
  }

  const data = await res.json();
  return {
    url: data.data?.[0]?.url ?? "",
    revisedPrompt: data.data?.[0]?.revised_prompt,
  };
}
