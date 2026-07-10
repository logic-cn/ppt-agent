import type { TextStyle } from "./types";

export function resolveTextStyle(
  base: Partial<TextStyle>,
  overrides?: Partial<TextStyle>,
): TextStyle {
  return {
    fontSize: overrides?.fontSize ?? base.fontSize ?? 18,
    fontFamily: overrides?.fontFamily ?? base.fontFamily ?? "sans-serif",
    color: overrides?.color ?? base.color ?? "#333333",
    bold: overrides?.bold ?? base.bold ?? false,
    italic: overrides?.italic ?? base.italic ?? false,
    align: overrides?.align ?? base.align ?? "left",
  };
}

export function getOverflow(
  role: "title" | "subtitle" | "body" | "bullet" | "caption",
): "fit" | "clip" | "shrink" {
  switch (role) {
    case "title":
      return "shrink";
    case "subtitle":
    case "body":
    case "bullet":
      return "fit";
    case "caption":
      return "clip";
  }
}
