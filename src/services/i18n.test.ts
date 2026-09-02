import { describe, it, expect } from "vitest";
import { translate } from "@/services/i18n";
import { en } from "@/locales/en";
import { zh } from "@/locales/zh";

describe("translate", () => {
  it("按语言返回对应文案", () => {
    expect(translate("zh", "common.cancel")).toBe("取消");
    expect(translate("en", "common.cancel")).toBe("Cancel");
  });

  it("支持 `{name}` 占位符插值", () => {
    expect(translate("zh", "editor.pageOf", { n: 3, total: 10 })).toBe(
      "第 3 / 10 页",
    );
    expect(translate("en", "editor.pageOf", { n: 3, total: 10 })).toBe(
      "Page 3 of 10",
    );
  });

  it("中英字典 key 完全一致（类型层由 Record<TranslationKey,string> 保证）", () => {
    Object.keys(en).forEach((key) => {
      expect(zh[key as keyof typeof en]).toBeDefined();
    });
  });
});
