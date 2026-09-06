/**
 * 旁白 TTS（D1c，参照 PPT Master notes_to_audio.py / narration_sync.py）：
 * 把每页演讲者备注合成为音频，走当前激活 Provider 的 OpenAI 兼容
 * /audio/speech 端点。音频以 data URL 内嵌进 PPTX，并按音频时长
 * 注入自动换片（advTm），实现「播完自动翻页」。
 */

/** 调用 OpenAI 兼容 speech 端点，返回 mp3 的 base64 data URL */
export async function synthesizeSpeech(
  text: string,
  opts: {
    baseUrl: string;
    apiKey: string;
    model?: string;
    voice?: string;
    signal?: AbortSignal;
  },
): Promise<string> {
  const res = await fetch(`${opts.baseUrl.replace(/\/$/, "")}/audio/speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model ?? "tts-1",
      voice: opts.voice ?? "alloy",
      input: text.slice(0, 4000),
      response_format: "mp3",
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`旁白合成失败（${res.status}）${body.slice(0, 120)}`);
  }
  const buf = await res.arrayBuffer();
  return arrayBufferToDataUrl(buf, "audio/mpeg");
}

function arrayBufferToDataUrl(buf: ArrayBuffer, mime: string): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/** 解码音频时长（毫秒）；解析失败返回 0（导出端退化为点击换片） */
export async function audioDurationMs(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const done = (ms: number) => {
      audio.removeAttribute("src");
      resolve(ms);
    };
    audio.onloadedmetadata = () => {
      const sec = audio.duration;
      done(Number.isFinite(sec) && sec > 0 ? Math.ceil(sec * 1000) + 400 : 0);
    };
    audio.onerror = () => done(0);
    audio.src = dataUrl;
  });
}

export interface NarrationBuild {
  narrations: (string | undefined)[];
  durations: (number | undefined)[];
  failures: number;
}

/** 逐页合成旁白：单页失败不中断整体（该页跳过），返回音频与时长 */
export async function buildNarrations(
  notes: (string | undefined)[],
  opts: {
    baseUrl: string;
    apiKey: string;
    voice?: string;
    signal?: AbortSignal;
    onProgress?: (done: number, total: number) => void;
  },
): Promise<NarrationBuild> {
  const total = notes.filter((n) => n?.trim()).length;
  const narrations: (string | undefined)[] = [];
  const durations: (number | undefined)[] = [];
  let failures = 0;
  let done = 0;
  for (const note of notes) {
    if (!note?.trim() || opts.signal?.aborted) {
      narrations.push(undefined);
      durations.push(undefined);
      continue;
    }
    try {
      const dataUrl = await synthesizeSpeech(note, opts);
      narrations.push(dataUrl);
      durations.push(await audioDurationMs(dataUrl));
    } catch (e) {
      if (opts.signal?.aborted) throw e;
      narrations.push(undefined);
      durations.push(undefined);
      failures += 1;
    }
    done += 1;
    opts.onProgress?.(done, total);
  }
  return { narrations, durations, failures };
}
