/**
 * 生成选项辅助（路线图 §7.3）：
 * 将应用界面语言映射为生成输出语言，供各生成入口复用。
 */

import type { Lang } from "@/types/preferences";
import type { GenerationLanguage, GenerationOptions } from "@/types/generation";

/** 应用界面语言 → 生成输出语言 */
export function languageFromAppLang(lang: Lang): GenerationLanguage {
  return lang === "en" ? "en-US" : "zh-CN";
}

/** 合并应用语言到生成选项；选项中已显式指定 language 时不覆盖 */
export function withAppLanguage(
  options: GenerationOptions,
  lang: Lang,
): GenerationOptions {
  return {
    ...options,
    language: options.language ?? languageFromAppLang(lang),
  };
}
