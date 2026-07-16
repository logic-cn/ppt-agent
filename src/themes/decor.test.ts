import { describe, it, expect } from "vitest";
import { resolveTheme } from "@/themes";
import { buildRenderSlide } from "@/engine/render-ir/build";
import type { Slide } from "@/types/deck";

describe("主题装饰差异化（方向3）", () => {
  it("dark-tech 注入网格背景且正文用侧边栏", () => {
    const theme = resolveTheme("default", "dark-tech");
    expect(theme.decor?.grid).toBe(true);
    expect(theme.decor?.coverAccent).toBe("side-bar");

    const slide: Slide = {
      id: "s1",
      layout: "content",
      title: "正文",
      bullets: [{ id: "b1", text: "要点", level: 0 }],
    };
    const rs = buildRenderSlide(slide, {} as never, theme);
    const grid = rs.nodes.filter(
      (n) => n.type === "shape" && n.shape === "circle",
    );
    expect(grid.length).toBeGreaterThan(10);
    const sideBar = rs.nodes.find((n) => n.id === "deco-side-bar");
    expect(sideBar).toBeDefined();
  });

  it("soft-rounded 无分隔线（separator:none）", () => {
    const theme = resolveTheme("default", "soft-rounded");
    expect(theme.decor?.separator).toBe("none");
    const slide: Slide = {
      id: "s2",
      layout: "two-column",
      title: "对比",
      items: [
        { id: "a", title: "左", bullets: ["x"] },
        { id: "b", title: "右", bullets: ["y"] },
      ],
    };
    const rs = buildRenderSlide(slide, {} as never, theme);
    const seps = rs.nodes.filter((n) => n.id.startsWith("sep-"));
    expect(seps.length).toBe(0);
  });

  it("swiss-minimal 封面用顶部条、正文无侧栏", () => {
    const theme = resolveTheme("default", "swiss-minimal");
    expect(theme.decor?.coverAccent).toBe("top-bar");
    expect(theme.decor?.bodyAccent).toBe("none");

    const slide: Slide = {
      id: "s3",
      layout: "content",
      title: "正文",
      bullets: [{ id: "b", text: "要点", level: 0 }],
    };
    const rs = buildRenderSlide(slide, {} as never, theme);
    expect(rs.nodes.find((n) => n.id === "deco-side-bar")).toBeUndefined();
  });

  it("soft-rounded 封面用 corner 装饰形态", () => {
    const theme = resolveTheme("default", "soft-rounded");
    expect(theme.decor?.coverAccent).toBe("corner");
    const slide: Slide = {
      id: "s4",
      layout: "cover",
      title: "封面",
      subtitle: "副标题",
    };
    const rs = buildRenderSlide(slide, {} as never, theme);
    expect(rs.nodes.find((n) => n.id === "deco-cover-corner")).toBeDefined();
  });
});
