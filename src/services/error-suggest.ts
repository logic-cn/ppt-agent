/**
 * 错误 → 行动建议（C6，参照 PPT Master error_helper）：
 * 把常见错误模式映射为用户可执行的建议文案（i18n key），
 * 在 AI 生成 / 导入等长任务的失败提示处追加，降低排障成本。
 */

export type ErrorSuggestKey =
  | "errorSuggest.apiKey"
  | "errorSuggest.rateLimit"
  | "errorSuggest.timeout"
  | "errorSuggest.network"
  | "errorSuggest.model";

/** 按错误消息模式返回建议的 i18n key；无法识别时返回 null（不加建议） */
export function suggestForError(message: string): ErrorSuggestKey | null {
  const m = message.toLowerCase();
  if (
    m.includes("401") ||
    m.includes("403") ||
    m.includes("unauthorized") ||
    m.includes("invalid api key") ||
    m.includes("incorrect api key")
  ) {
    return "errorSuggest.apiKey";
  }
  if (m.includes("429") || m.includes("rate limit") || m.includes("限流")) {
    return "errorSuggest.rateLimit";
  }
  if (
    m.includes("超时") ||
    m.includes("timeout") ||
    m.includes("timed out") ||
    (m.includes("abort") && !m.includes("取消"))
  ) {
    return "errorSuggest.timeout";
  }
  if (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("cors") ||
    m.includes("enotfound") ||
    m.includes("econnrefused")
  ) {
    return "errorSuggest.network";
  }
  if (
    m.includes("model") &&
    (m.includes("not found") || m.includes("不存在"))
  ) {
    return "errorSuggest.model";
  }
  return null;
}

/** 组装「原始错误 + 建议」的追加片段（无建议时返回空串） */
export function appendErrorSuggestion(
  message: string,
  translate: (key: ErrorSuggestKey) => string,
): string {
  const key = suggestForError(message);
  return key ? `\n\n💡 ${translate(key)}` : "";
}
