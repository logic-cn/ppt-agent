import { describe, it, expect } from "vitest";
import {
  checkSvg,
  checkContentPresence,
  checkChartData,
  svgContainsChart,
  checkTypographyAnchors,
  checkCohortConsistency,
  checkTextGeometry,
  contrastRatio,
  checkAesthetics,
  checkChartGeometry,
  checkColorValues,
  checkLayoutBalance,
  checkVisualRhythm,
  checkPaletteContrast,
  autoPatchSvg,
} from "./checker";
import { buildSpecLock, type SpecLock } from "@/design/spec-lock";
import { DEFAULT_DESIGN } from "@/types/design";

const specLock = buildSpecLock(DEFAULT_DESIGN);

const VALID_VIEWBOX = `viewBox="0 0 1280 720"`;

function wrap(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" ${VALID_VIEWBOX}>${inner}</svg>`;
}

describe("checkSvg", () => {
  it("rect 超出右边界（x+width > 1280）报 error", () => {
    const svg = wrap(
      `<rect x="1200" y="100" width="200" height="50" fill="#111"/>`,
    );
    const issues = checkSvg(svg, specLock);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /右边界|超出|越界/.test(e.message))).toBe(true);
  });

  it("text 越界报 error", () => {
    const svg = wrap(
      `<text x="1300" y="100" font-size="24" fill="#000">hello</text>`,
    );
    const issues = checkSvg(svg, specLock);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors.length).toBeGreaterThan(0);
  });

  it("合法 svg 返回空数组或仅 warn", () => {
    const svg = wrap(
      `<rect x="10" y="10" width="100" height="50" fill="#111"/><text x="20" y="40" font-size="16" fill="#000">标题</text>`,
    );
    const issues = checkSvg(svg, specLock);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("circle 超出右边界报 error", () => {
    const svg = wrap(`<circle cx="1240" cy="360" r="50" fill="#f00"/>`);
    const issues = checkSvg(svg, specLock);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /超出右边界/.test(e.message))).toBe(true);
  });

  it("ellipse 超出下边界报 error", () => {
    const svg = wrap(
      `<ellipse cx="640" cy="700" rx="100" ry="50" fill="#0f0"/>`,
    );
    const issues = checkSvg(svg, specLock);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /超出下边界/.test(e.message))).toBe(true);
  });

  it("line 超出左边界报 error", () => {
    const svg = wrap(
      `<line x1="-50" y1="100" x2="200" y2="100" stroke="#00f"/>`,
    );
    const issues = checkSvg(svg, specLock);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /左边界/.test(e.message))).toBe(true);
  });

  it("多个越界同时报出", () => {
    const svg = wrap(
      `<rect x="-10" y="-10" width="50" height="50" fill="#111"/><circle cx="1300" cy="360" r="30" fill="#f00"/>`,
    );
    const issues = checkSvg(svg, specLock);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });

  it("多 text 元素时各自按自身内容估宽（不被第一个 text 的内容污染）", () => {
    // 第一个 text 短（在界内）；第二个 text 长且靠右，必须单独报越界
    const svg = wrap(
      `<text x="100" y="100" font-size="24" fill="#000">短标题</text><text x="1100" y="100" font-size="24" fill="#000">这是一个很长很长的中文副标题用来把宽度推到边界之外</text>`,
    );
    const issues = checkSvg(svg, specLock);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors.length).toBeGreaterThan(0);
    // 越界消息对应第二个 text（x=1100 长文本），而非第一个（x=100 短标题）
    expect(
      errors.some(
        (e) => /估算宽度/.test(e.message) && e.message.includes("1100"),
      ),
    ).toBe(true);
  });

  it("多 text 元素时靠内的长文本不误报", () => {
    // 第一个 text 长但靠左（在界内），第二个 text 短靠左：均不应报 error
    const svg = wrap(
      `<text x="100" y="100" font-size="24" fill="#000">这是一个很长的中文标题内容用来验证不误报</text><text x="50" y="200" font-size="16" fill="#000">短</text>`,
    );
    const issues = checkSvg(svg, specLock);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors.filter((e) => /text|文本/.test(e.message))).toHaveLength(0);
  });

  it("CJK 中文文本按 1.0 字号估宽，长句溢出报 error（旧 0.6 系数会漏检）", () => {
    // 20 个全角字符 × 24px = 480px 宽，位置 x=900 时 x+480=1380 > 1280
    const cn = "这是一段非常长的中文标题文本用来测试溢出";
    const svg = wrap(
      `<text x="900" y="100" font-size="24" fill="#000">${cn}</text>`,
    );
    const issues = checkSvg(svg, specLock);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors.some((e) => /text 越界|超出/.test(e.message))).toBe(true);
  });

  it("CJK 文本紧贴右边界但未溢出时不报 error", () => {
    // 10 个全角字符 × 24px = 240px + 0.4em 尾距 ≈ 250px，x=1000 时 1250 < 1280
    const cn = "十个字符十个字符十";
    const svg = wrap(
      `<text x="1000" y="100" font-size="24" fill="#000">${cn}</text>`,
    );
    const issues = checkSvg(svg, specLock);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors.filter((e) => /text|文本/.test(e.message))).toHaveLength(0);
  });

  it("多行 text（多个 tspan）行高累加后下越界报 error", () => {
    // 3 个 tspan = 4 行 × 48px font × 1.2 = 230px，y=600 时 830 > 720
    const svg = wrap(
      `<text x="100" y="600" font-size="48" fill="#000">第一行<tspan x="100" dy="58">第二行</tspan><tspan x="100" dy="58">第三行</tspan><tspan x="100" dy="58">第四行</tspan></text>`,
    );
    const issues = checkSvg(svg, specLock);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors.some((e) => /下越界/.test(e.message))).toBe(true);
  });

  it("transform=translate 平移后的元素参与越界检测", () => {
    // 无 translate 时 rect x=1200 正常；translate(100,0) 后 x+width 越界
    const svg = wrap(
      `<rect transform="translate(100,0)" x="1200" y="100" width="200" height="50" fill="#111"/>`,
    );
    const issues = checkSvg(svg, specLock);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors.some((e) => /右边界|越界/.test(e.message))).toBe(true);
  });

  describe("checkChartData", () => {
    function chartG(attrs: string, inner = ""): string {
      return wrap(`<g ${attrs}>${inner}</g>`);
    }

    it("合法 data-chart-type + data-chart-data 无 error", () => {
      const svg = chartG(
        `data-chart-type="bar" data-chart-data='[{"label":"A","value":1},{"label":"B","value":2}]'`,
      );
      const issues = checkChartData(svg);
      expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
    });

    it("缺 data-chart-data 报 error（LLM 渲染了图表但没给数据）", () => {
      const svg = chartG(`data-chart-type="bar"`);
      const issues = checkChartData(svg);
      expect(issues.some((i) => i.severity === "error")).toBe(true);
    });

    it("data-chart-data 非法 JSON 报 error", () => {
      const svg = chartG(`data-chart-type="bar" data-chart-data='[{"label":'`);
      const issues = checkChartData(svg);
      expect(issues.some((i) => i.severity === "error")).toBe(true);
    });

    it("data-chart-data 空数组报 error", () => {
      const svg = chartG(`data-chart-type="pie" data-chart-data='[]'`);
      const issues = checkChartData(svg);
      expect(issues.some((i) => i.severity === "error")).toBe(true);
    });

    it("非法 data-chart-type 报 error", () => {
      const svg = chartG(
        `data-chart-type="scatter" data-chart-data='[{"label":"A","value":1}]'`,
      );
      const issues = checkChartData(svg);
      expect(issues.some((i) => i.severity === "error")).toBe(true);
    });

    it("svgContainsChart 区分有/无图表", () => {
      const withChart = chartG(
        `data-chart-type="line" data-chart-data='[{"label":"A","value":1}]'`,
      );
      expect(svgContainsChart(withChart)).toBe(true);
      expect(svgContainsChart(wrap("<rect width='10' height='10'/>"))).toBe(
        false,
      );
    });
  });
});

describe("checkContentPresence", () => {
  const svgWith = (text: string) =>
    wrap(`<text x="100" y="100" font-size="24" fill="#000">${text}</text>`);

  it("标题未出现在 SVG 文本中时报 error", () => {
    const issues = checkContentPresence(svgWith("其他内容"), {
      title: "Q3 业务复盘",
    });
    expect(issues.filter((i) => i.severity === "error").length).toBe(1);
  });

  it("标题完整出现在 SVG 文本中时无 error", () => {
    const issues = checkContentPresence(svgWith("Q3 业务复盘报告"), {
      title: "Q3 业务复盘",
    });
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("容忍 LLM 在同义改写：标题插入修饰词不判缺失", () => {
    // 标题「成本控制」被渲染为「成本控制策略」，子串包含仍通过
    const issues = checkContentPresence(svgWith("成本控制策略"), {
      title: "成本控制",
    });
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("多个要点中任一缺失都报 error", () => {
    const svg = wrap(`
      <text x="100" y="100" font-size="20" fill="#000">第一点：业绩回暖</text>
      <text x="100" y="140" font-size="20" fill="#000">第三点也写了</text>
    `);
    const issues = checkContentPresence(svg, {
      bullets: ["第一点：业绩回暖", "第二点：成本下降", "第三点也写了"],
    });
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /第二点/.test(e.message))).toBe(true);
  });

  it("tspan 嵌套文本也能被提取（多行正文）", () => {
    const svg = wrap(
      `<text x="100" y="100" font-size="24" fill="#000">利润增长<tspan>40%</tspan><tspan>创历史新高</tspan></text>`,
    );
    const issues = checkContentPresence(svg, {
      title: "利润增长 40%",
    });
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });
});

// ---- 字号锚点 + cohort 一致性门（参照 PPT Master typography anchors / early gate）----

const ANCHOR_SPEC: SpecLock = {
  canvas: { w: 1280, h: 720 },
  colors: {
    primary: "#1D4ED8",
    secondary: "#3B82F6",
    accent: "#F59E0B",
    background: "#FFFFFF",
    surface: "#F3F4F6",
    text: "#111827",
    textMuted: "#6B7280",
  },
  fonts: { title: "Noto Sans SC", body: "Noto Sans SC" },
  typography: { title: 40, section: 30, body: 20, caption: 14, hero: 72 },
  style: "soft-rounded",
  icons: [],
};

describe("checkTypographyAnchors", () => {
  it("锚点字号与 ≤2 处例外不告警", () => {
    const svg = `<svg><text font-size="40">A</text><text font-size="20">B</text><text font-size="15">c1</text><text font-size="16">c2</text></svg>`;
    expect(checkTypographyAnchors(svg, ANCHOR_SPEC)).toHaveLength(0);
  });

  it("偏离锚点超过稀疏上限时告警", () => {
    const svg = `<svg><text font-size="33">A</text><text font-size="33">B</text><text font-size="25">C</text></svg>`;
    const issues = checkTypographyAnchors(svg, ANCHOR_SPEC);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warn");
    expect(issues[0].message).toContain("25/33");
  });

  it("无 typography 定义时跳过", () => {
    const noType = { ...ANCHOR_SPEC, typography: undefined };
    expect(
      checkTypographyAnchors("<svg><text font-size='9'>x</text></svg>", noType),
    ).toHaveLength(0);
  });
});

describe("checkCohortConsistency", () => {
  it("越锁颜色报 error 并给出出现次数", () => {
    const svg = `<svg><rect fill="#123456"/><rect fill="#123456"/></svg>`;
    const issues = checkCohortConsistency([svg], ANCHOR_SPEC);
    expect(
      issues.some(
        (i) => i.severity === "error" && i.message.includes("配色越锁"),
      ),
    ).toBe(true);
  });

  it("越锁字体报 error", () => {
    const svg = `<svg><text font-family="Comic Sans">x</text></svg>`;
    const issues = checkCohortConsistency([svg], ANCHOR_SPEC);
    expect(
      issues.some(
        (i) => i.severity === "error" && i.message.includes("字体越锁"),
      ),
    ).toBe(true);
  });

  it("合规页面返回空", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="1280" height="720" fill="#FFFFFF"/><text x="100" y="100" font-family="Noto Sans SC" font-size="40" fill="#111827">标题</text></svg>`;
    expect(checkCohortConsistency([svg], ANCHOR_SPEC)).toHaveLength(0);
  });
});

describe("画布格式参数化（B5）", () => {
  it("非 16:9 画布：viewBox 与越界判定按 specLock.canvas", () => {
    const specXhs: SpecLock = {
      ...ANCHOR_SPEC,
      canvas: { w: 1080, h: 1440 },
      canvasFormat: "xhs-3-4",
    };
    const good = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1440"><rect x="0" y="0" width="1080" height="1440" fill="#FFFFFF"/><text x="100" y="200" font-size="40" fill="#111827">标题</text></svg>`;
    expect(
      checkSvg(good, specXhs).filter((i) => i.severity === "error"),
    ).toHaveLength(0);

    // 16:9 的 viewBox 在 3:4 画布下应为契约错误
    const wrong = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"><rect x="0" y="0" width="1280" height="720" fill="#FFFFFF"/></svg>`;
    const issues = checkSvg(wrong, specXhs);
    expect(issues.some((i) => i.message.includes("viewBox 必须为"))).toBe(true);

    // 越界判定用 3:4 画布：y 超出 1440 才算越界
    const overflow = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1440"><rect x="0" y="1300" width="100" height="100" fill="#FFFFFF"/></svg>`;
    expect(
      checkSvg(overflow, specXhs).filter((i) => i.severity === "error"),
    ).toHaveLength(0);
  });
});

describe("checkTextGeometry（安全区 + 重叠）", () => {
  it("两段文字包围盒交叠报 error", () => {
    const svg = wrap(
      `<text x="100" y="100" font-size="40">市场规模</text><text x="130" y="115" font-size="40">增长动力</text>`,
    );
    const issues = checkTextGeometry(svg, specLock).filter(
      (i) => i.severity === "error",
    );
    expect(issues.some((i) => /文字重叠/.test(i.message))).toBe(true);
  });

  it("正常间距的两行文字不误报", () => {
    const svg = wrap(
      `<text x="40" y="100" font-size="40">标题行</text><text x="40" y="170" font-size="24">要点行一</text><text x="40" y="210" font-size="24">要点行二</text>`,
    );
    expect(checkTextGeometry(svg, specLock)).toHaveLength(0);
  });

  it("text-anchor=middle 的居中大字不误报", () => {
    const svg = wrap(
      `<text x="640" y="360" font-size="79" text-anchor="middle">970 亿美元</text>`,
    );
    expect(checkTextGeometry(svg, specLock)).toHaveLength(0);
  });

  it("右缘越出安全区（画布宽 − 32px）报 error", () => {
    const svg = wrap(
      `<text x="1100" y="100" font-size="44">这是一个非常长的中文标题检测安全区</text>`,
    );
    const issues = checkTextGeometry(svg, specLock);
    expect(issues.some((i) => /安全区/.test(i.message))).toBe(true);
  });

  it("底部越出下安全区报 error", () => {
    const svg = wrap(`<text x="100" y="712" font-size="40">贴底文字</text>`);
    expect(checkTextGeometry(svg, specLock).length).toBeGreaterThan(0);
  });

  it("多行 tspan 的底部按行数计算", () => {
    // 单行看 y=650 不越界；按 3 行（行高 1.2em）计算底缘 ≈ 713.6 > 704
    const svg = wrap(
      `<text x="100" y="650" font-size="24"><tspan x="100">第一行文字</tspan><tspan x="100" dy="29">第二行文字</tspan><tspan x="100" dy="29">第三行文字</tspan></text>`,
    );
    const issues = checkTextGeometry(svg, specLock);
    expect(issues.some((i) => /安全区/.test(i.message))).toBe(true);
  });

  it("首行直排 + tspan 续行也按行数计算", () => {
    const svg = wrap(
      `<text x="100" y="650" font-size="24">第一行文字<tspan x="100" dy="29">第二行文字</tspan><tspan x="100" dy="29">第三行文字</tspan></text>`,
    );
    expect(
      checkTextGeometry(svg, specLock).some((i) => /安全区/.test(i.message)),
    ).toBe(true);
  });
});

describe("contrastRatio（WCAG）", () => {
  it("黑白为 21:1，同色为 1:1，且对称", () => {
    expect(contrastRatio("FFFFFF", "000000")).toBeCloseTo(21, 0);
    expect(contrastRatio("7B7B7B", "7B7B7B")).toBeCloseTo(1, 5);
    expect(contrastRatio("94A3B8", "F1F5F9")).toBe(
      contrastRatio("F1F5F9", "94A3B8"),
    );
  });
});

describe("checkAesthetics（量化美学）", () => {
  const bg = specLock.colors.background;

  it("浅字压浅底（对比度 2.34）报 error", () => {
    // #94A3B8(textMuted) 压在 #F1F5F9（两者都是色板 token）→ brand 级
    const svg = wrap(
      `<rect x="0" y="0" width="1280" height="720" fill="#F1F5F9"/><text x="100" y="200" font-size="20" fill="#94A3B8">灰色说明文字</text>`,
    );
    const issues = checkAesthetics(svg, specLock);
    expect(
      issues.some(
        (i) => i.severity === "error" && /对比度|不达标/.test(i.message),
      ),
    ).toBe(true);
  });

  it("处置分级：越位用色（非 token）报 page 级、token 组合报 brand 级", () => {
    // #D1D5DB 不是色板 token → page 级「对比度不足」
    const page = wrap(
      `<rect x="0" y="0" width="1280" height="720" fill="#F1F5F9"/><text x="100" y="200" font-size="20" fill="#D1D5DB">乱用浅灰</text>`,
    );
    const pageIssue = checkAesthetics(page, specLock).find(
      (i) => i.severity === "error",
    );
    expect(pageIssue?.kind).toBe("page");
    expect(pageIssue?.message).toContain("对比度不足");

    // 两端都是 token → brand 级「配色组合不达标」
    const brand = wrap(
      `<rect x="0" y="0" width="1280" height="720" fill="#F1F5F9"/><text x="100" y="200" font-size="20" fill="#94A3B8">muted 压 text</text>`,
    );
    const brandIssue = checkAesthetics(brand, specLock).find(
      (i) => i.severity === "error",
    );
    expect(brandIssue?.kind).toBe("brand");
    expect(brandIssue?.message).toContain("整份 deck");
  });

  it("大字（≥26px）容忍 3.0：4.23 对比度不报错，小字报", () => {
    const big = wrap(
      `<rect x="0" y="0" width="1280" height="720" fill="#FFFFFF"/><text x="100" y="200" font-size="30" fill="#7B7B7B">大标题</text>`,
    );
    const small = wrap(
      `<rect x="0" y="0" width="1280" height="720" fill="#FFFFFF"/><text x="100" y="200" font-size="20" fill="#7B7B7B">小正文</text>`,
    );
    expect(
      checkAesthetics(big, specLock).some((i) => /对比度不足/.test(i.message)),
    ).toBe(false);
    expect(
      checkAesthetics(small, specLock).some((i) =>
        /对比度不足/.test(i.message),
      ),
    ).toBe(true);
  });

  it("文字压在深色卡片(surface)上按底面而非画布背景算对比度", () => {
    // 底面 rect 为深色：浅字合法；若错误地按背景回退则会漏报/误报
    const surface = specLock.colors.surface;
    const text = specLock.colors.text;
    const svg = wrap(
      `<rect x="100" y="100" width="400" height="200" fill="${surface}"/><text x="150" y="180" font-size="20" fill="${text}">卡片标题</text>`,
    );
    expect(
      checkAesthetics(svg, specLock).filter(
        (i) => i.severity === "error" && /对比度不足/.test(i.message),
      ),
    ).toHaveLength(0);
  });

  it("accent 面积 >12% 画布 → 60-30-10 warn", () => {
    const accent = specLock.colors.accent;
    const svg = wrap(
      `<rect x="0" y="0" width="1280" height="720" fill="${bg}"/><rect x="0" y="0" width="256" height="720" fill="${accent}"/>`,
    );
    expect(
      checkAesthetics(svg, specLock).some(
        (i) => i.severity === "warn" && /强调色面积/.test(i.message),
      ),
    ).toBe(true);
  });

  it("缺少大面积底色 → 画面发飘 warn", () => {
    const svg = wrap(
      `<rect x="100" y="100" width="200" height="120" fill="${specLock.colors.surface}"/>`,
    );
    expect(
      checkAesthetics(svg, specLock).some((i) =>
        /缺少大面积底色/.test(i.message),
      ),
    ).toBe(true);
  });

  it("flood-opacity 超出 0.03–0.12 参数域 warn，域内不报", () => {
    const heavy = wrap(
      `<rect x="0" y="0" width="1280" height="720" fill="${bg}"/><filter id="s"><feFlood flood-opacity="0.5"/></filter>`,
    );
    const ok = wrap(
      `<rect x="0" y="0" width="1280" height="720" fill="${bg}"/><filter id="s"><feFlood flood-opacity="0.08"/></filter>`,
    );
    expect(
      checkAesthetics(heavy, specLock).some((i) => /阴影浓度/.test(i.message)),
    ).toBe(true);
    expect(
      checkAesthetics(ok, specLock).some((i) => /阴影浓度/.test(i.message)),
    ).toBe(false);
  });

  it("合规页面（大底 + 高对比文字）无 error", () => {
    const svg = wrap(
      `<rect x="0" y="0" width="1280" height="720" fill="${bg}"/><text x="100" y="120" font-size="40" fill="${specLock.colors.text}">市场规模与增速</text><text x="100" y="180" font-size="20" fill="${specLock.colors.textMuted}">近三年复合增长率</text>`,
    );
    expect(
      checkAesthetics(svg, specLock).filter((i) => i.severity === "error"),
    ).toHaveLength(0);
  });
});

describe("checkChartGeometry（柱图几何回算）", () => {
  function bars(
    data: { label: string; value: number }[],
    heights: number[],
    type = "bar",
  ): string {
    const rects = heights
      .map(
        (h, i) =>
          `<rect x="${100 + i * 120}" y="${400 - h}" width="80" height="${h}" fill="#3B82F6"/>`,
      )
      .join("");
    return wrap(
      `<g data-chart-type="${type}" data-chart-data='${JSON.stringify(data)}'>${rects}</g>`,
    );
  }

  it("柱高比例与数值比例一致 → 无问题", () => {
    const svg = bars(
      [
        { label: "A", value: 10 },
        { label: "B", value: 5 },
        { label: "C", value: 20 },
      ],
      [100, 50, 200],
    );
    expect(checkChartGeometry(svg)).toHaveLength(0);
  });

  it("柱数与数据点数不一致 → error", () => {
    const svg = bars(
      [
        { label: "A", value: 10 },
        { label: "B", value: 5 },
        { label: "C", value: 20 },
      ],
      [100, 50],
    );
    expect(
      checkChartGeometry(svg).some((i) => /柱图几何不符/.test(i.message)),
    ).toBe(true);
  });

  it("柱高比例偏离数值比例 >12% → error（只报第一根）", () => {
    const svg = bars(
      [
        { label: "A", value: 10 },
        { label: "B", value: 20 },
      ],
      [100, 100],
    );
    const issues = checkChartGeometry(svg).filter((i) =>
      /柱图几何失真/.test(i.message),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("第 1 根柱");
  });

  it("非柱图类型（pie）不做几何回算", () => {
    const svg = bars([{ label: "A", value: 10 }], [100, 50], "pie");
    expect(checkChartGeometry(svg)).toHaveLength(0);
  });

  it("未画柱体（仅数据标记）不报错，导出端原生图表兜底", () => {
    const svg = wrap(
      `<g data-chart-type="bar" data-chart-data='[{"label":"A","value":10}]'></g>`,
    );
    expect(checkChartGeometry(svg)).toHaveLength(0);
  });
});

describe("checkLayoutBalance（版面失衡/对齐统计）", () => {
  const bg = specLock.colors.background;

  it("内容全部堆在上半部、底部大面积空白 → warn", () => {
    const svg = wrap(
      `<rect x="0" y="0" width="1280" height="720" fill="${bg}"/>` +
        [100, 150, 200]
          .map(
            (y, i) =>
              `<text x="100" y="${y}" font-size="24" fill="${specLock.colors.text}">要点行${i}</text>`,
          )
          .join(""),
    );
    expect(
      checkLayoutBalance(svg, specLock).some((i) => /版面失衡/.test(i.message)),
    ).toBe(true);
  });

  it("内容纵向铺满 → 不报失衡", () => {
    const svg = wrap(
      `<rect x="0" y="0" width="1280" height="720" fill="${bg}"/><text x="100" y="100" font-size="40" fill="${specLock.colors.text}">标题</text><text x="100" y="620" font-size="24" fill="${specLock.colors.text}">底部结论</text>`,
    );
    expect(checkLayoutBalance(svg, specLock)).toHaveLength(0);
  });

  it("左缘出现 5 个以上碎片化簇 → warn", () => {
    const xs = [50, 120, 200, 280, 360, 440];
    const svg = wrap(
      `<rect x="0" y="0" width="1280" height="720" fill="${bg}"/>` +
        xs
          .map(
            (x, i) =>
              `<text x="${x}" y="${300 + i * 50}" font-size="24" fill="${specLock.colors.text}">行${i}</text>`,
          )
          .join(""),
    );
    expect(
      checkLayoutBalance(svg, specLock).some((i) =>
        /左缘对齐碎片化/.test(i.message),
      ),
    ).toBe(true);
  });

  it("统一栏位左缘不报碎片化", () => {
    const svg = wrap(
      `<rect x="0" y="0" width="1280" height="720" fill="${bg}"/>` +
        [120, 220, 320, 420, 520]
          .map(
            (y, i) =>
              `<text x="80" y="${y}" font-size="24" fill="${specLock.colors.text}">行${i}</text>`,
          )
          .join(""),
    );
    expect(
      checkLayoutBalance(svg, specLock).some((i) =>
        /左缘对齐碎片化/.test(i.message),
      ),
    ).toBe(false);
  });
});

describe("checkVisualRhythm（软性视觉节奏 S4/S5/S6）", () => {
  it("S6：CJK letter-spacing >5% 字号 → warn", () => {
    const svg = wrap(
      `<text x="100" y="120" font-size="20" letter-spacing="6" fill="#F1F5F9">中文要点文字</text>`,
    );
    expect(
      checkVisualRhythm(svg, specLock).some((i) =>
        /CJK 字距过大/.test(i.message),
      ),
    ).toBe(true);
  });

  it("S6：拉丁字距不报（无 CJK）", () => {
    const svg = wrap(
      `<text x="100" y="120" font-size="20" letter-spacing="6" fill="#F1F5F9">hello world</text>`,
    );
    expect(
      checkVisualRhythm(svg, specLock).some((i) =>
        /CJK 字距过大/.test(i.message),
      ),
    ).toBe(false);
  });

  it("S4：两处左缘相差 4-24px → 对齐漂移 warn", () => {
    const svg = wrap(
      `<text x="100" y="120" font-size="20" fill="#F1F5F9">甲</text><text x="118" y="180" font-size="20" fill="#F1F5F9">乙</text>`,
    );
    expect(
      checkVisualRhythm(svg, specLock).some((i) =>
        /左缘对齐漂移/.test(i.message),
      ),
    ).toBe(true);
  });

  it("S4：精确同栏（差<4px）不报漂移", () => {
    const svg = wrap(
      `<text x="100" y="120" font-size="20" fill="#F1F5F9">甲</text><text x="100" y="180" font-size="20" fill="#F1F5F9">乙</text>`,
    );
    expect(
      checkVisualRhythm(svg, specLock).some((i) =>
        /左缘对齐漂移/.test(i.message),
      ),
    ).toBe(false);
  });

  it("S5：同排卡片间距不均 → warn", () => {
    const svg = wrap(
      `<rect x="40" y="300" width="200" height="100" fill="#1A2D42"/><rect x="300" y="300" width="200" height="100" fill="#1A2D42"/><rect x="600" y="300" width="200" height="100" fill="#1A2D42"/>`,
    );
    expect(
      checkVisualRhythm(svg, specLock).some((i) =>
        /卡片间距不均/.test(i.message),
      ),
    ).toBe(true);
  });

  it("S5：等距卡片不报", () => {
    const svg = wrap(
      `<rect x="40" y="300" width="200" height="100" fill="#1A2D42"/><rect x="280" y="300" width="200" height="100" fill="#1A2D42"/><rect x="520" y="300" width="200" height="100" fill="#1A2D42"/>`,
    );
    expect(
      checkVisualRhythm(svg, specLock).some((i) =>
        /卡片间距不均/.test(i.message),
      ),
    ).toBe(false);
  });
});

describe("checkPaletteContrast（brand token 组合静态体检）", () => {
  it("合规色板返回空", () => {
    expect(checkPaletteContrast(specLock)).toHaveLength(0);
  });

  it("浅灰 text 压白底（<4.5）→ brand 级 warn", () => {
    const bad: SpecLock = {
      ...specLock,
      colors: {
        ...specLock.colors,
        background: "#FFFFFF",
        surface: "#F9FAFB",
        text: "#D1D5DB",
        textMuted: "#E5E7EB",
      },
    };
    const issues = checkPaletteContrast(bad);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((i) => i.kind === "brand")).toBe(true);
  });
});

describe("autoPatchSvg（确定性原子修复）", () => {
  it("越锁颜色吸附到最近色板 token，<text> 内取色不动", () => {
    const svg = wrap(
      `<rect x="0" y="0" width="1280" height="720" fill="#13203A"/><text x="100" y="200" font-size="20" fill="#F0F4FA">字</text>`,
    );
    const { svg: out, changed } = autoPatchSvg(svg, specLock);
    expect(changed).toBeGreaterThan(0);
    // 非文字元素的越锁色吸附回最近 token
    expect(out).not.toContain("#13203A");
    expect(out).toContain("#1A2D42"); // #13203A → surface
    // 文字色**不**盲吸：page 塌陷被吸附成 brand 会绕过重画环却锁死导出，
    // 对比度修复必须由反馈驱动模型选对 token（C4 回归）
    expect(out).toContain("#F0F4FA");
  });

  it("CJK 超标 letter-spacing 被移除，拉丁保留", () => {
    const cjk = wrap(
      `<text x="100" y="200" font-size="20" letter-spacing="6" fill="#F1F5F9">中文要点</text>`,
    );
    const latin = wrap(
      `<text x="100" y="200" font-size="20" letter-spacing="6" fill="#F1F5F9">hello</text>`,
    );
    expect(autoPatchSvg(cjk, specLock).svg).not.toContain("letter-spacing");
    expect(autoPatchSvg(latin, specLock).svg).toContain("letter-spacing");
  });

  it("纯合规页 changed=0 原样返回", () => {
    const svg = wrap(
      `<text x="100" y="200" font-size="20" fill="#F1F5F9">正常文字</text>`,
    );
    const r = autoPatchSvg(svg, specLock);
    expect(r.changed).toBe(0);
    expect(r.svg).toBe(svg);
  });
});

describe("review 修复回归（Code Review (c) 条目逐条验证）", () => {
  it("C1a 高而窄的柱不再被当底板剔除（w12/h400 三柱三点不误报）", () => {
    const bars = [400, 200, 80]
      .map(
        (h, i) =>
          `<rect x="${100 + i * 30}" y="${500 - h}" width="12" height="${h}" fill="#3B82F6"/>`,
      )
      .join("");
    const svg = wrap(
      `<g data-chart-type="bar" data-chart-data='[{"label":"a","value":10},{"label":"b","value":5},{"label":"c","value":2}]'>${bars}</g>`,
    );
    expect(checkChartGeometry(svg)).toHaveLength(0);
  });

  it("C1b 铺底大板按宽度离群剔除；嵌套 <g> 不再截断切片", () => {
    const svg = wrap(
      `<g data-chart-type="bar" data-chart-data='[{"label":"a","value":10},{"label":"b","value":5}]'>` +
        `<rect x="0" y="0" width="1000" height="500" fill="#1A2D42"/>` +
        `<g><rect x="50" y="100" width="120" height="400"/><rect x="250" y="300" width="120" height="200"/></g>` +
        `</g>`,
    );
    expect(checkChartGeometry(svg)).toHaveLength(0);
  });

  it("C2 <g fill=…> 继承色参与对比度检查", () => {
    const svg = wrap(
      `<rect x="0" y="0" width="1280" height="720" fill="#FFFFFF"/><g fill="#D1D5DB"><text x="100" y="200" font-size="20">继承浅灰</text></g>`,
    );
    expect(
      checkAesthetics(svg, specLock).some(
        (i) => i.severity === "error" && /对比度不足/.test(i.message),
      ),
    ).toBe(true);
  });

  it("C3 三行长段落按最宽行估，不判右缘越界", () => {
    // 30 CJK × 24px = 720px + 尾距，单行远在画布内；旧拼接口径会算成 ~2160px 假越界
    const line = "市场规模持续增长近三年复合年增长率保持两位数高位运行态势良好";
    expect([...line].length).toBe(30);
    const tspans = [0, 1, 2]
      .map((i) => `<tspan x="80" dy="${i === 0 ? 0 : 29}">${line}</tspan>`)
      .join("");
    const svg = wrap(
      `<text x="80" y="120" font-size="24" fill="#F1F5F9">${tspans}</text>`,
    );
    const rightOverflow = checkTextGeometry(svg, specLock).filter((i) =>
      /右缘/.test(i.message),
    );
    expect(rightOverflow).toHaveLength(0);
  });

  it("C5 style 内联与裸值 letter-spacing 同口径（S6 warn + autoPatch 移除）", () => {
    const styleSvg = wrap(
      `<text x="100" y="120" font-size="20" style="letter-spacing:6px" fill="#F1F5F9">中文要点</text>`,
    );
    const bareSvg = wrap(
      `<text x="100" y="120" font-size="20" letter-spacing=6 fill="#F1F5F9">中文要点</text>`,
    );
    expect(
      checkVisualRhythm(styleSvg, specLock).some((i) =>
        /CJK 字距过大/.test(i.message),
      ),
    ).toBe(true);
    expect(
      checkVisualRhythm(bareSvg, specLock).some((i) =>
        /CJK 字距过大/.test(i.message),
      ),
    ).toBe(true);
    expect(autoPatchSvg(styleSvg, specLock).svg).not.toContain(
      "letter-spacing",
    );
    expect(autoPatchSvg(bareSvg, specLock).svg).not.toContain("letter-spacing");
  });

  it("C6 骨架自身版式（标题 40px x=40 / 要点 24px x=48）不触发漂移 warn", () => {
    const svg = wrap(
      `<rect x="0" y="0" width="1280" height="720" fill="${specLock.colors.background}"/>` +
        `<text x="40" y="80" font-size="40" fill="${specLock.colors.text}">标题带</text>` +
        `<text x="48" y="160" font-size="24" fill="${specLock.colors.text}">要点一</text>` +
        `<text x="48" y="220" font-size="24" fill="${specLock.colors.text}">要点二</text>`,
    );
    expect(
      checkVisualRhythm(svg, specLock).filter((i) =>
        /左缘对齐漂移/.test(i.message),
      ),
    ).toHaveLength(0);
  });
});

describe("端侧实跑第 5 轮回归（E2E 实锤问题）", () => {
  it("图表区单块满区底板不误判为柱体（1 底板 + 3 数据点 → 无 error）", () => {
    // 实跑复现：模型在图表组里画一整块 rect 作底板（589×588 满区），
    // 旧逻辑把它数成「1 根柱」报 hard 锁死导出，且重画环修不掉
    const svg = wrap(
      `<g data-chart-type="bar" data-chart-data='[{"label":"a","value":3},{"label":"b","value":3},{"label":"c","value":3}]' x="651" y="92" width="589" height="588">` +
        `<rect x="651" y="92" width="589" height="588" fill="#2563EB"/>` +
        `</g>`,
    );
    expect(checkChartGeometry(svg)).toHaveLength(0);
  });

  it("图表区底板 + 正确柱体仍按柱数与比例对账", () => {
    const bars = [300, 150]
      .map(
        (h, i) =>
          `<rect x="${660 + i * 90}" y="${600 - h}" width="60" height="${h}" fill="#3B82F6"/>`,
      )
      .join("");
    const svg = wrap(
      `<g data-chart-type="bar" data-chart-data='[{"label":"a","value":10},{"label":"b","value":5}]' x="651" y="92" width="589" height="588">` +
        `<rect x="651" y="92" width="589" height="588" fill="#2563EB"/>${bars}</g>`,
    );
    expect(checkChartGeometry(svg)).toHaveLength(0);
  });

  it("窄柱 ≠ 数据点数仍报错（底板剔除不放过真实缺柱）", () => {
    const svg = wrap(
      `<g data-chart-type="bar" data-chart-data='[{"label":"a","value":3},{"label":"b","value":3},{"label":"c","value":3}]' x="651" y="92" width="589" height="588">` +
        `<rect x="660" y="400" width="80" height="200" fill="#2563EB"/>` +
        `</g>`,
    );
    expect(
      checkChartGeometry(svg).some((i) => /柱图几何不符/.test(i.message)),
    ).toBe(true);
  });

  it("checkColorValues：命名色报 error，token 名/HEX/none/url 放行", () => {
    const bad = wrap(
      `<rect x="0" y="0" width="100" height="50" fill="white"/>`,
    );
    expect(
      checkColorValues(bad).some((i) => /颜色值非法/.test(i.message)),
    ).toBe(true);
    const good = wrap(
      `<rect x="0" y="0" width="100" height="50" fill="background"/>` +
        `<rect x="0" y="60" width="100" height="50" fill="#0C1929"/>` +
        `<rect x="0" y="120" width="100" height="50" fill="none"/>` +
        `<rect x="0" y="180" width="100" height="50" stroke="url(#g1)" fill="#123456"/>`,
    );
    expect(checkColorValues(good)).toHaveLength(0);
  });

  it("autoPatchSvg：token 名颜色确定性兑换为色板 HEX（含 text 元素）", () => {
    const svg = wrap(
      `<rect x="0" y="0" width="1280" height="720" fill="background"/>` +
        `<text x="100" y="200" font-size="20" fill="text">字</text>`,
    );
    const { svg: out, changed } = autoPatchSvg(svg, specLock);
    expect(changed).toBe(2);
    expect(out).not.toContain('fill="background"');
    expect(out).not.toContain('fill="text"');
    expect(out).toContain(
      `fill="#${specLock.colors.background.replace("#", "")}"`,
    );
    expect(out).toContain(`fill="#${specLock.colors.text.replace("#", "")}"`);
  });

  it("checkLayoutBalance：居中文本（text-anchor=middle）不触发左缘碎片化", () => {
    // 实跑复现：封面页 6 个居中文本被误判成 5 个「不同左缘」
    const svg = wrap(
      `<rect x="0" y="0" width="1280" height="720" fill="${specLock.colors.background}"/>` +
        [300, 380, 470, 540, 590, 660]
          .map(
            (y, i) =>
              `<text x="640" y="${y}" text-anchor="middle" font-size="${40 - i * 6}" fill="${specLock.colors.text}">标题行${i}${i === 0 ? "更长一些" : ""}</text>`,
          )
          .join(""),
    );
    expect(
      checkLayoutBalance(svg, specLock).some((i) =>
        /左缘对齐碎片化/.test(i.message),
      ),
    ).toBe(false);
  });
});

describe("checker 误报回归（attr 词边界 + text-anchor 越界口径）", () => {
  it("attr 匹配不受同名前缀属性干扰：rx/stroke-width 在前时 x/width 仍取正确值", () => {
    // rx= 在 x= 之前、stroke-width= 在 width= 之前（旧正则会把 rx 当 x、
    // stroke-width 当 width 读取，产生错误越界判定）
    const svg = wrap(
      `<rect rx="8" x="40" ry="4" y="60" stroke-width="2" width="200" height="80" fill="#111"/>`,
    );
    const issues = checkSvg(svg, specLock);
    const errors = issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("text-anchor=middle 的居中长标题不再误报水平越界", () => {
    // 44px 中文标题约 15 字（≈660px），中心锚点 x=640 时实际跨度 310–970，
    // 旧逻辑按左缘 640 + 660 = 1300 > 1280 误判越界（error 级，会硬锁导出）
    const svg = wrap(
      `<text x="640" y="120" font-size="44" fill="#111" text-anchor="middle">三季度经营复盘与增长分析汇报</text>`,
    );
    const issues = checkSvg(svg, specLock);
    const bounds = issues.filter((i) => i.code === "svg.textOutOfBounds");
    expect(bounds).toHaveLength(0);
  });

  it("text-anchor=end 的右对齐文本按右缘判定（真越界仍报错）", () => {
    // end 锚点 x=1200，估宽约 320px → 左缘 880，右缘 1200，不越界
    const ok = wrap(
      `<text x="1200" y="100" font-size="28" fill="#111" text-anchor="end">季度数据对比分析</text>`,
    );
    expect(
      checkSvg(ok, specLock).filter((i) => i.code === "svg.textOutOfBounds"),
    ).toHaveLength(0);

    // end 锚点 x=1300 → 右缘 1300 > 1280，真越界必须照报
    const bad = wrap(
      `<text x="1300" y="100" font-size="28" fill="#111" text-anchor="end">季度数据对比分析</text>`,
    );
    expect(
      checkSvg(bad, specLock).filter((i) => i.code === "svg.textOutOfBounds")
        .length,
    ).toBeGreaterThan(0);
  });

  it("无锚点 text 仍按左缘判定越界（行为不变）", () => {
    const svg = wrap(
      `<text x="1300" y="100" font-size="24" fill="#000">hello</text>`,
    );
    expect(
      checkSvg(svg, specLock).filter((i) => i.code === "svg.textOutOfBounds")
        .length,
    ).toBeGreaterThan(0);
  });
});
