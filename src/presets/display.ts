import type { Lang } from "@/types/preferences";
import type { DeckPreset } from "@/types/preset";
import type { TranslationKey } from "@/locales/en";
import { translate } from "@/services/i18n";

export interface PresetDisplay {
  name: string;
  description?: string;
  audience?: string;
}

function localized(lang: Lang, key: string, fallback: string): string {
  const fullKey = key as TranslationKey;
  const text = translate(lang, fullKey);
  return text === fullKey ? fallback : text;
}

/** 模板/示例展示文案按当前语言取 locale key，缺失时回退到内置中文。 */
export function getPresetDisplay(
  preset: DeckPreset,
  lang: Lang,
): PresetDisplay {
  return {
    name: localized(lang, `preset.${preset.id}.name`, preset.name),
    description: preset.description
      ? localized(lang, `preset.${preset.id}.desc`, preset.description)
      : undefined,
    audience: preset.audience
      ? localized(lang, `preset.${preset.id}.audience`, preset.audience)
      : undefined,
  };
}
