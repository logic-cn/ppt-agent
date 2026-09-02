import { useSettingsStore } from "@/store/settings";
import { translate, type TranslationKey } from "@/services/i18n";

export type TFunc = (
  key: TranslationKey,
  params?: Record<string, string | number>,
) => string;

/** 订阅当前语言，返回绑定语言的翻译函数（响应式）。 */
export function useT(): TFunc {
  const lang = useSettingsStore((s) => s.settings.lang);
  return (key, params) => translate(lang, key, params);
}
