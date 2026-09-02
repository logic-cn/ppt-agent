import { en, type TranslationKey } from "@/locales/en";
import { zh } from "@/locales/zh";
import type { Lang } from "@/types/preferences";
import { useSettingsStore } from "@/store/settings";

export type { TranslationKey };

/**
 * 纯函数：按语言与 key 取文案，支持 `{name}` 占位符插值。
 */
export function translate(
  lang: Lang,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const dict: Record<TranslationKey, string> = lang === "en" ? en : zh;
  let text: string = dict[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

/**
 * 便捷封装：从设置读取当前语言后翻译。
 * 非响应式——仅用于非 React 场景（services/store 等）。
 * React 组件请使用 `useT()` hook 以在切换语言时重渲染。
 */
export function t(
  key: TranslationKey,
  params?: Record<string, string | number>,
) {
  const lang = useSettingsStore.getState().settings.lang;
  return translate(lang, key, params);
}
