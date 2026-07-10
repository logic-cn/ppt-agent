// 检测是否在 Tauri 环境中
const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** 在 Tauri 环境中通过 Rust proxy 发起 HTTP 请求，绕过浏览器 CORS */
async function tauriFetch(
  url: string,
  options: RequestInit & { signal?: AbortSignal },
): Promise<{ status: number; body: string }> {
  const { invoke } = await import("@tauri-apps/api/core");
  const headers: Record<string, string> = {};
  if (options.headers instanceof Headers) {
    options.headers.forEach((v, k) => {
      headers[k] = v;
    });
  } else if (Array.isArray(options.headers)) {
    for (const [k, v] of options.headers) {
      headers[k] = v;
    }
  } else if (options.headers) {
    Object.assign(headers, options.headers);
  }

  const body =
    typeof options.body === "string"
      ? options.body
      : options.body
        ? JSON.stringify(options.body)
        : undefined;

  const signal = options.signal;
  if (signal?.aborted) {
    throw new DOMException("The operation was aborted", "AbortError");
  }

  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("The operation was aborted", "AbortError"));
      return;
    }

    const abortHandler = () =>
      reject(new DOMException("The operation was aborted", "AbortError"));
    signal?.addEventListener("abort", abortHandler);

    invoke("http_proxy", {
      req: {
        method: options.method ?? "GET",
        url,
        headers,
        body,
      },
    })
      .then((r) => {
        resolve(r as { status: number; body: string });
      })
      .catch(reject)
      .finally(() => signal?.removeEventListener("abort", abortHandler));
  });
}

/**
 * 跨环境的 HTTP 请求工具。
 * - Tauri 环境：通过 Rust proxy 绕过 CORS
 * - 浏览器环境：直接使用 fetch
 */
export async function httpRequest(
  url: string,
  options: RequestInit & { signal?: AbortSignal } = {},
): Promise<Response> {
  if (isTauri) {
    const result = await tauriFetch(url, options);
    return new Response(result.body, {
      status: result.status,
      headers: { "content-type": "application/json" },
    });
  }
  return fetch(url, options);
}
